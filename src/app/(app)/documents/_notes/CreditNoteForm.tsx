"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { Field } from "@/components/Field";
import { ErrorNotice, Notice } from "@/components/Notice";
import { PreviewTotals } from "@/components/PreviewTotals";
import { emptyProductLine, ProductLines, type ProductLine } from "@/components/ProductLines";
import { availableBalance, prorateDiscount } from "@/lib/creditNote";
import { compare, formatUnitPrice, parse, plainDecimal, ZERO } from "@/lib/decimal";
import { normalizeInvoiceNumber } from "@/lib/invoiceNumber";
import { previewInvoice } from "@/lib/invoicePreview";
import { loadIssuer, type Point } from "@/lib/issuer";
import { useApi } from "@/lib/useApi";

import { AuthorizedInvoice, emptyManualInvoice, InvoiceFacts, ManualInvoiceFields, ManualInvoiceNotice, type ManualInvoice } from "./NoteSource";
import { IssuerNotices, NoteActions, NoteProblem, PointField, selectedPoint, useNoteEmit } from "./NoteShared";

type Document = components["schemas"]["Document"];
type Product = components["schemas"]["Product"];
type CreditNoteRequest = components["schemas"]["IssueCreditNoteRequest"];

const LINE_FIELDS: Record<string, string> = {
  invoiceLineNo: "línea de la factura",
  productId: "producto",
  quantity: "cantidad",
  unitPrice: "precio unitario",
  discount: "descuento",
};
const FIELDS: Record<string, string> = {
  reason: "Motivo",
  customerId: "Cliente",
  issueDate: "Fecha de emisión",
  "modifiedDocument.number": "Número de la factura",
  "modifiedDocument.issueDate": "Fecha de la factura",
};

/** Nombre, para el usuario, del dato de la nota que el servidor rechazó; `lineNumbers` numera las líneas enviadas. */
function fieldLabel(field: string, lineNumbers: number[]): string {
  const line = /^lines\[(\d+)\]\.(\w+)$/.exec(field);
  if (line) {
    const index = Number(line[1]);
    return `Línea ${lineNumbers[index] ?? index + 1}, ${LINE_FIELDS[line[2] ?? ""] ?? line[2]}`;
  }
  return FIELDS[field] ?? field;
}

/** Línea de la factura tal como se acredita: si se marca, y con qué cantidad, precio y descuento. */
type CreditLine = { selected: boolean; quantity: string; unitPrice: string; discount: string; discountEdited: boolean };

function creditLines(invoice: Document): CreditLine[] {
  return invoice.lines.map((line) => ({
    selected: false,
    quantity: plainDecimal(line.quantity),
    unitPrice: formatUnitPrice(line.unitPrice),
    discount: line.discount,
    discountEdited: false,
  }));
}

/** Errores de una línea marcada, por campo. */
type LineErrors = { quantity?: string; unitPrice?: string; discount?: string };

/**
 * Errores de una línea marcada que superaría a la de la factura: más cantidad, más precio o menos
 * descuento que el original prorrateado por la cantidad (un descuento vacío se envía como 0.00).
 */
function lineError(line: CreditLine, original: Document["lines"][number]): LineErrors {
  const quantity = parse(line.quantity, 6);
  const unitPrice = parse(line.unitPrice, 6);
  const discount = line.discount.trim() === "" ? ZERO : parse(line.discount, 2);
  const originalQuantity = parse(original.quantity, 6);
  const originalPrice = parse(original.unitPrice, 6);
  const minimumDiscount = prorateDiscount(original.discount, line.quantity, original.quantity);
  const minimum = minimumDiscount === null ? null : parse(minimumDiscount, 2);
  return {
    quantity: quantity && originalQuantity && compare(quantity, originalQuantity) > 0
      ? `No puede superar la cantidad facturada (${plainDecimal(original.quantity)})`
      : undefined,
    unitPrice: unitPrice && originalPrice && compare(unitPrice, originalPrice) > 0
      ? `No puede superar el precio facturado (${formatUnitPrice(original.unitPrice)})`
      : undefined,
    discount: discount && minimum && compare(discount, minimum) < 0
      ? `El descuento no puede ser menor que ${minimumDiscount}`
      : undefined,
  };
}

/**
 * Formulario de una nota de crédito. Con `invoiceId`, sobre esa factura de la plataforma: sus líneas,
 * su comprador y su saldo. Sin ella, sobre una factura escrita a mano, con su número, su fecha y un
 * cliente del catálogo.
 */
export function CreditNoteForm({ tenantId, invoiceId }: { tenantId: string; invoiceId: string | null }) {
  if (invoiceId) {
    return <InvoiceCreditNote tenantId={tenantId} invoiceId={invoiceId} />;
  }
  return <Editor tenantId={tenantId} invoice={null} />;
}

function InvoiceCreditNote({ tenantId, invoiceId }: { tenantId: string; invoiceId: string }) {
  return <AuthorizedInvoice tenantId={tenantId} invoiceId={invoiceId}>{(invoice) => <Editor tenantId={tenantId} invoice={invoice} />}</AuthorizedInvoice>;
}

function Editor({ tenantId, invoice }: { tenantId: string; invoice: Document | null }) {
  const router = useRouter();
  const note = useNoteEmit((id) => router.push(`/documents/${id}`));
  const [chosenPoint, setChosenPoint] = useState<Point | undefined>(undefined);
  const [reason, setReason] = useState("");
  // Con factura de la plataforma.
  const [lines, setLines] = useState<CreditLine[]>(() => (invoice ? creditLines(invoice) : []));
  // Con factura escrita a mano.
  const [manual, setManual] = useState<ManualInvoice>(emptyManualInvoice);
  const { number: invoiceNumber, date: invoiceDate, customerId } = manual;
  const [productLines, setProductLines] = useState<ProductLine[]>(() => [emptyProductLine()]);
  const [known, setKnown] = useState<Map<string, Product>>(() => new Map());

  /** Número (de la factura, o de orden) de cada línea enviada, para nombrar las que rechace el servidor. */
  const [sentLineNumbers, setSentLineNumbers] = useState<number[]>([]);

  const issuer = useApi(() => loadIssuer(invoice?.taxpayerId), [tenantId, invoice?.taxpayerId ?? null]);
  const rates = useApi(() => unwrap(api.GET("/catalogs/tax-rates")), []);

  function changeLine(index: number, patch: Partial<CreditLine>) {
    setLines((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  }

  function changeQuantity(index: number, quantity: string) {
    const original = invoice?.lines[index];
    const line = lines[index];
    if (!original || !line) {
      return;
    }
    // Mientras el usuario no escribe el descuento, sigue a la cantidad como lo prorratearía el servidor.
    const discount = line.discountEdited ? line.discount : (prorateDiscount(original.discount, quantity, original.quantity) ?? line.discount);
    changeLine(index, { quantity, discount });
  }

  const points = issuer.data?.points ?? [];
  const point = selectedPoint(points, chosenPoint);
  const rateDescriptions = new Map((rates.data ?? []).map((rate) => [rate.rateCode, rate.description]));
  const ratePercents = new Map((rates.data ?? []).map((rate) => [rate.rateCode, rate.rate]));

  // Con factura: solo cuentan las líneas marcadas.
  const selected = invoice ? lines.flatMap((line, index) => (line.selected ? [index] : [])) : [];
  const errors: LineErrors[] = invoice ? lines.map((line, index) => (line.selected && invoice.lines[index] ? lineError(line, invoice.lines[index]) : {})) : [];
  const hasLineErrors = errors.some((lineErrors) => Object.values(lineErrors).some((message) => message !== undefined));
  const preview = invoice
    ? previewInvoice(
      selected.map((index) => ({
        quantity: lines[index]?.quantity ?? "",
        unitPrice: lines[index]?.unitPrice ?? "",
        discount: lines[index]?.discount ?? "",
        rateCode: invoice.lines[index]?.taxRateCode ?? "",
        ratePercent: invoice.lines[index]?.taxRate ?? "",
      })),
    )
    : previewInvoice(
      productLines.map((line) => {
        const product = known.get(line.productId);
        return {
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          rateCode: product?.ivaRateCode ?? "",
          ratePercent: (product ? ratePercents.get(product.ivaRateCode) : undefined) ?? "",
        };
      }),
    );
  const balance = invoice && invoice.total ? availableBalance(invoice.total, invoice.creditedTotal) : null;
  const total = parse(preview.total, 2);
  const balanceValue = balance === null ? null : parse(balance, 2);
  const exceedsBalance = preview.complete && total !== null && balanceValue !== null && compare(total, balanceValue) > 0;
  const normalizedNumber = normalizeInvoiceNumber(invoiceNumber);
  const numberValid = normalizedNumber !== null;
  const reasonText = reason.trim();

  // Con el botón deshabilitado, se dice por qué.
  const missing = [
    ...(issuer.data !== undefined && (issuer.data === null || point === undefined) ? ["registrar el emisor y un punto de emisión"] : []),
    ...(invoice
      ? [
        ...(selected.length === 0 ? ["marcar al menos una línea de la factura"] : []),
        ...(selected.length > 0 && !preview.complete ? ["completar la cantidad y el precio de cada línea marcada"] : []),
        ...(hasLineErrors ? ["que ninguna línea supere a la de la factura"] : []),
        ...(exceedsBalance ? [`no superar el saldo disponible ($${balance})`] : []),
      ]
      : [
        ...(!numberValid ? ["escribir el número de la factura"] : []),
        ...(invoiceDate === "" ? ["indicar la fecha de la factura"] : []),
        ...(customerId === "" ? ["elegir un cliente"] : []),
        ...(!preview.complete ? ["completar el detalle (producto, cantidad y precio de cada línea)"] : []),
      ]),
    ...(reasonText === "" ? ["escribir el motivo"] : []),
  ];
  const ready = missing.length === 0 && issuer.data != null && point !== undefined;

  function emit(event: FormEvent) {
    return note.submit(event, ready && !!issuer.data && !!point, async (idempotencyKey) => {
      if (!issuer.data || !point) {
        throw new Error("Falta el emisor");
      }
      const header = { taxpayerId: issuer.data.taxpayerId, establishmentCode: point.establishmentCode, emissionPointCode: point.emissionPointCode, reason: reasonText };
      // Sin los espacios que pueda traer un valor pegado: la vista previa los ignora, la API no.
      // El descuento se envía siempre, el que muestra la pantalla, para que la vista previa y el servidor coincidan.
      let body: CreditNoteRequest;
      if (invoice) {
        setSentLineNumbers(selected.map((index) => invoice.lines[index]?.lineNo ?? index + 1));
        body = {
          ...header,
          invoiceId: invoice.id,
          lines: selected.map((index) => {
            const line = lines[index]!;
            return {
              invoiceLineNo: invoice.lines[index]!.lineNo,
              quantity: line.quantity.trim(),
              unitPrice: line.unitPrice.trim(),
              discount: line.discount.trim() === "" ? "0.00" : line.discount.trim(),
            };
          }),
        };
      }
      else {
        setSentLineNumbers(productLines.map((_, index) => index + 1));
        body = {
          ...header,
          modifiedDocument: { code: "01", number: normalizedNumber ?? invoiceNumber.trim(), issueDate: invoiceDate },
          customerId,
          lines: productLines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity.trim(),
            unitPrice: line.unitPrice.trim(),
            discount: line.discount.trim() === "" ? "0.00" : line.discount.trim(),
          })),
        };
      }
      return unwrap(api.POST("/credit-notes", { params: { header: { "Idempotency-Key": idempotencyKey } }, body }));
    });
  }

  return (
    <form onSubmit={emit} noValidate>
      <ErrorNotice error={issuer.error ?? rates.error} />
      <IssuerNotices issuer={issuer.data} points={points} />

      {invoice ? (
        <>
          <InvoiceFacts invoice={invoice} />
          <p className="lead">Saldo disponible ${balance}</p>
        </>
      ) : (
        <ManualInvoiceNotice />
      )}

      <div className="form">
        <PointField points={points} point={point} onChange={setChosenPoint} />
        {invoice ? null : <ManualInvoiceFields tenantId={tenantId} value={manual} onChange={setManual} />}
        <Field label="Motivo" className="wide" hint="La razón de la modificación, como aparecerá en la nota.">
          <input maxLength={300} value={reason} onChange={(event) => setReason(event.target.value.replace(/[\r\n]+/g, " "))} />
        </Field>
      </div>

      <h2>Detalle</h2>
      {invoice ? (
        <InvoiceLines
          invoice={invoice}
          lines={lines}
          errors={errors}
          subtotals={selected.reduce((map, index, position) => map.set(index, preview.lines[position] ?? null), new Map<number, string | null>())}
          onToggle={(index, checked) => changeLine(index, { selected: checked })}
          onQuantity={changeQuantity}
          onUnitPrice={(index, unitPrice) => changeLine(index, { unitPrice })}
          onDiscount={(index, discount) => changeLine(index, { discount, discountEdited: true })}
        />
      ) : (
        <ProductLines
          tenantId={tenantId}
          lines={productLines}
          products={known}
          subtotals={preview.lines}
          onChange={setProductLines}
          onProductSeen={(product) => setKnown((current) => new Map(current).set(product.id, product))}
        />
      )}

      <div className="split">
        <div>
          {exceedsBalance ? (
            <Notice kind="warning">La nota supera el saldo disponible de la factura (${balance}).</Notice>
          ) : null}
        </div>
        <div>
          <PreviewTotals preview={preview} rateDescriptions={rateDescriptions} />
        </div>
      </div>

      <NoteProblem error={note.error} fieldLabel={(field) => fieldLabel(field, sentLineNumbers)} />
      <NoteActions label="Emitir nota de crédito" ready={ready} sending={note.sending} missing={missing} />
    </form>
  );
}

/** Líneas de la factura: se marcan las que se acreditan y se ajusta su cantidad, precio y descuento. */
function InvoiceLines({
  invoice,
  lines,
  errors,
  subtotals,
  onToggle,
  onQuantity,
  onUnitPrice,
  onDiscount,
}: {
  invoice: Document;
  lines: CreditLine[];
  errors: LineErrors[];
  subtotals: Map<number, string | null>;
  onToggle: (index: number, checked: boolean) => void;
  onQuantity: (index: number, value: string) => void;
  onUnitPrice: (index: number, value: string) => void;
  onDiscount: (index: number, value: string) => void;
}) {
  const id = useId();
  return (
    <div className="table-scroll">
      <table className="ruled lines">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Acreditar</span>
            </th>
            <th scope="col">Descripción</th>
            <th scope="col" className="num">
              Cantidad
            </th>
            <th scope="col" className="num">
              Precio unitario
            </th>
            <th scope="col" className="num">
              Descuento
            </th>
            <th scope="col" className="num">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((original, index) => {
            const line = lines[index];
            if (!line) {
              return null;
            }
            const lineErrors = errors[index] ?? {};
            const quantityError = `${id}-cantidad-${index}`;
            const priceError = `${id}-precio-${index}`;
            const discountError = `${id}-descuento-${index}`;
            return (
              <tr key={original.lineNo} className={line.selected ? undefined : "muted"}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Acreditar la línea ${original.lineNo}: ${original.description}`}
                    checked={line.selected}
                    onChange={(event) => onToggle(index, event.target.checked)}
                  />
                </td>
                <td>
                  {original.description} <span className="code">{original.mainCode}</span>
                </td>
                <td className="field">
                  <input
                    aria-label={`Cantidad de la línea ${original.lineNo}`}
                    className="num"
                    inputMode="decimal"
                    size={8}
                    disabled={!line.selected}
                    value={line.quantity}
                    aria-invalid={lineErrors.quantity ? true : undefined}
                    aria-describedby={lineErrors.quantity ? quantityError : undefined}
                    onChange={(event) => onQuantity(index, event.target.value)}
                  />
                  {lineErrors.quantity ? (
                    <p className="field-error" id={quantityError}>
                      {lineErrors.quantity}
                    </p>
                  ) : null}
                </td>
                <td className="field">
                  <input
                    aria-label={`Precio unitario de la línea ${original.lineNo}`}
                    className="num"
                    inputMode="decimal"
                    size={10}
                    disabled={!line.selected}
                    value={line.unitPrice}
                    aria-invalid={lineErrors.unitPrice ? true : undefined}
                    aria-describedby={lineErrors.unitPrice ? priceError : undefined}
                    onChange={(event) => onUnitPrice(index, event.target.value)}
                  />
                  {lineErrors.unitPrice ? (
                    <p className="field-error" id={priceError}>
                      {lineErrors.unitPrice}
                    </p>
                  ) : null}
                </td>
                <td className="field">
                  <input
                    aria-label={`Descuento de la línea ${original.lineNo}`}
                    className="num"
                    inputMode="decimal"
                    size={8}
                    disabled={!line.selected}
                    value={line.discount}
                    aria-invalid={lineErrors.discount ? true : undefined}
                    aria-describedby={lineErrors.discount ? discountError : undefined}
                    onChange={(event) => onDiscount(index, event.target.value)}
                  />
                  {lineErrors.discount ? (
                    <p className="field-error" id={discountError}>
                      {lineErrors.discount}
                    </p>
                  ) : null}
                </td>
                <td className="num">{line.selected ? (subtotals.get(index) ?? "Incompleta") : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
