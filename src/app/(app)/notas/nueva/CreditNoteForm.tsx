"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";
import { CatalogPicker } from "@/components/CatalogPicker";
import { Field } from "@/components/Field";
import { ErrorNotice, Notice } from "@/components/Notice";
import { PointSelect } from "@/components/PointSelect";
import { PreviewTotals } from "@/components/PreviewTotals";
import { emptyProductLine, ProductLines, type ProductLine } from "@/components/ProductLines";
import { availableBalance, prorateDiscount } from "@/lib/creditNote";
import { formatIssueDate } from "@/lib/dates";
import { compare, formatUnitPrice, parse, plainDecimal } from "@/lib/decimal";
import { normalizeInvoiceNumber } from "@/lib/invoiceNumber";
import { previewInvoice } from "@/lib/invoicePreview";
import { loadIssuer, type Point } from "@/lib/issuer";
import { useApi } from "@/lib/useApi";

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

/** Errores de una línea marcada que superaría a la de la factura. */
function lineError(line: CreditLine, original: Document["lines"][number]): { quantity?: string; unitPrice?: string } {
  const quantity = parse(line.quantity, 6);
  const unitPrice = parse(line.unitPrice, 6);
  const originalQuantity = parse(original.quantity, 6);
  const originalPrice = parse(original.unitPrice, 6);
  return {
    quantity: quantity && originalQuantity && compare(quantity, originalQuantity) > 0
      ? `No puede superar la cantidad facturada (${plainDecimal(original.quantity)})`
      : undefined,
    unitPrice: unitPrice && originalPrice && compare(unitPrice, originalPrice) > 0
      ? `No puede superar el precio facturado (${formatUnitPrice(original.unitPrice)})`
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
  const invoice = useApi(() => unwrap(api.GET("/documents/{id}", { params: { path: { id: invoiceId } } })), [tenantId, invoiceId]);
  if (invoice.error) {
    return <ErrorNotice error={invoice.error} />;
  }
  if (!invoice.data) {
    return <p className="lead">Cargando la factura…</p>;
  }
  if (invoice.data.documentType !== "01") {
    return <Notice kind="warning">El comprobante elegido no es una factura. Elija una factura desde los <Link href="/documentos">comprobantes</Link>.</Notice>;
  }
  if (invoice.data.state !== "AUTHORIZED") {
    return (
      <Notice kind="warning">
        Solo se puede emitir una nota sobre una factura autorizada. <Link href={`/documentos/${invoice.data.id}`}>Vea el estado de la factura {invoice.data.number}</Link>.
      </Notice>
    );
  }
  return <Editor tenantId={tenantId} invoice={invoice.data} />;
}

function Editor({ tenantId, invoice }: { tenantId: string; invoice: Document | null }) {
  const router = useRouter();
  // La clave nace con el formulario: un doble clic o un reintento tras un fallo emiten la misma nota.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [chosenPoint, setChosenPoint] = useState<Point | undefined>(undefined);
  const [reason, setReason] = useState("");
  // Con factura de la plataforma.
  const [lines, setLines] = useState<CreditLine[]>(() => (invoice ? creditLines(invoice) : []));
  // Con factura escrita a mano.
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState("");
  const [productLines, setProductLines] = useState<ProductLine[]>(() => [emptyProductLine()]);
  const [known, setKnown] = useState<Map<string, Product>>(() => new Map());

  const missingHint = useId();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  /** Evita un segundo envío antes de que React vuelva a pintar el botón desactivado. */
  const inFlight = useRef(false);
  /** Número (de la factura, o de orden) de cada línea enviada, para nombrar las que rechace el servidor. */
  const [sentLineNumbers, setSentLineNumbers] = useState<number[]>([]);

  const issuer = useApi(() => loadIssuer(invoice?.taxpayerId), [tenantId, invoice?.taxpayerId ?? null]);
  const rates = useApi(() => unwrap(api.GET("/catalogs/tax-rates")), []);

  async function searchCustomers(query: string) {
    const page = await unwrap(api.GET("/customers", { params: { query: { size: 20, ...(query ? { q: query } : {}) } } }));
    return page.items;
  }

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
  const point = points.find((candidate) => candidate.establishmentCode === chosenPoint?.establishmentCode && candidate.emissionPointCode === chosenPoint.emissionPointCode) ?? points[0];
  const rateDescriptions = new Map((rates.data ?? []).map((rate) => [rate.rateCode, rate.description]));
  const ratePercents = new Map((rates.data ?? []).map((rate) => [rate.rateCode, rate.rate]));

  // Con factura: solo cuentan las líneas marcadas.
  const selected = invoice ? lines.flatMap((line, index) => (line.selected ? [index] : [])) : [];
  const errors = invoice ? lines.map((line, index) => (line.selected && invoice.lines[index] ? lineError(line, invoice.lines[index]) : {})) : [];
  const hasLineErrors = errors.some((lineErrors) => lineErrors.quantity !== undefined || lineErrors.unitPrice !== undefined);
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

  async function emit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !ready || !issuer.data || !point) {
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError(undefined);
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
    try {
      const issued = await unwrap(api.POST("/credit-notes", { params: { header: { "Idempotency-Key": idempotencyKey } }, body }));
      router.push(`/documentos/${issued.id}`);
    }
    catch (problem) {
      setError(problem);
      inFlight.current = false;
      setSending(false);
    }
  }

  const keyReused = error instanceof ApiError && error.errorCode === "IDEMPOTENCY_KEY_REUSED";
  // No hay un campo por cada dato que el servidor valida: se dice aquí cuál rechazó.
  const rejected = error instanceof ApiError ? Object.entries(error.fieldErrors) : [];

  return (
    <form onSubmit={emit} noValidate>
      <ErrorNotice error={issuer.error ?? rates.error} />
      {issuer.data === null ? (
        <Notice kind="warning">
          Antes de emitir hay que <Link href="/configuracion/emisor">registrar el emisor</Link>.
        </Notice>
      ) : null}
      {issuer.data && points.length === 0 ? (
        <Notice kind="warning">
          El emisor no tiene ningún punto de emisión habilitado. <Link href="/configuracion/emisor">Añada uno</Link> para poder emitir.
        </Notice>
      ) : null}

      {invoice ? (
        <>
          <dl className="facts">
            <dt>Modifica a</dt>
            <dd>
              <Link href={`/documentos/${invoice.id}`}>
                Factura {invoice.number} del {formatIssueDate(invoice.issueDate)}
              </Link>
            </dd>
            <dt>Cliente</dt>
            <dd>
              {invoice.customer.name} ({invoice.customer.idNumber})
            </dd>
          </dl>
          <p className="lead">Saldo disponible ${balance}</p>
        </>
      ) : (
        <Notice>
          ¿La factura se emitió aquí? <Link href="/documentos">Ábrela desde Comprobantes</Link>
        </Notice>
      )}

      <div className="form">
        <Field label="Punto de emisión" hint="El número de la nota se asigna al emitirla.">
          <PointSelect points={points} value={point} onChange={setChosenPoint} />
        </Field>
        {invoice ? null : (
          <>
            <Field
              label="Número de la factura"
              hint="EEE-PPP-SSSSSSSSS: establecimiento, punto de emisión y secuencial. Puede escribir los 15 dígitos sin guiones."
              error={invoiceNumber.trim() !== "" && !numberValid ? "Escriba el número completo, por ejemplo 001-001-000000123." : undefined}
            >
              {/* Teclado numérico en el teléfono: no tiene guion, así que se aceptan los 15 dígitos y al salir se muestran con guiones. */}
              <input
                inputMode="numeric"
                placeholder="001-001-000000123"
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                onBlur={() => setInvoiceNumber((current) => normalizeInvoiceNumber(current) ?? current)}
              />
            </Field>
            <Field label="Fecha de la factura">
              <input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
            </Field>
            <Field label="Cliente" className="wide">
              <CatalogPicker
                tenantId={tenantId}
                value={customerId}
                selectedLabel={customerLabel}
                placeholder="Elija o busque un cliente"
                load={searchCustomers}
                optionLabel={(customer) => `${customer.name} (${customer.idNumber})`}
                onSearchStart={() => {
                  setCustomerLabel("");
                  setCustomerId("");
                }}
                onSelect={(customer) => {
                  setCustomerLabel(`${customer.name} (${customer.idNumber})`);
                  setCustomerId(customer.id);
                }}
              />
            </Field>
          </>
        )}
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

      {keyReused ? (
        <Notice kind="error">
          Esta nota ya se había emitido con otro contenido. Revise los <Link href="/documentos">comprobantes</Link> antes de volver a emitir.
        </Notice>
      ) : rejected.length > 0 ? (
        <Notice kind="error">
          El servidor no aceptó estos datos de la nota:
          <ul>
            {rejected.map(([field, message]) => (
              <li key={field}>
                {fieldLabel(field, sentLineNumbers)}: {message}
              </li>
            ))}
          </ul>
        </Notice>
      ) : (
        <ErrorNotice error={error} />
      )}
      <p className="actions">
        <button type="submit" className="btn btn-primary" disabled={!ready || sending} aria-describedby={missing.length > 0 ? missingHint : undefined}>
          {sending ? "Emitiendo…" : "Emitir nota de crédito"}
        </button>
      </p>
      {missing.length > 0 ? (
        <p className="field-hint" id={missingHint}>
          Para emitir falta: {missing.join("; ")}.
        </p>
      ) : null}
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
  errors: { quantity?: string; unitPrice?: string }[];
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
                    onChange={(event) => onDiscount(index, event.target.value)}
                  />
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
