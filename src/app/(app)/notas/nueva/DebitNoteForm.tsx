"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { Field } from "@/components/Field";
import { ErrorNotice } from "@/components/Notice";
import { PreviewTotals } from "@/components/PreviewTotals";
import { catalogLabel } from "@/lib/catalogLabels";
import { compare, parse, ZERO } from "@/lib/decimal";
import { normalizeInvoiceNumber } from "@/lib/invoiceNumber";
import { previewInvoice, sumAmounts } from "@/lib/invoicePreview";
import { loadIssuer, type Point } from "@/lib/issuer";
import { useApi } from "@/lib/useApi";

import { AuthorizedInvoice, emptyManualInvoice, InvoiceFacts, ManualInvoiceFields, ManualInvoiceNotice, type ManualInvoice } from "./NoteSource";
import { IssuerNotices, NoteActions, NoteProblem, PointField, selectedPoint, useNoteEmit } from "./NoteShared";

type Document = components["schemas"]["Document"];
type DebitNoteRequest = components["schemas"]["IssueDebitNoteRequest"];
type TaxRate = components["schemas"]["TaxRate"];

const MAX_REASONS = 20;
const FIELDS: Record<string, string> = {
  customerId: "Cliente",
  issueDate: "Fecha de emisión",
  "modifiedDocument.number": "Número de la factura",
  "modifiedDocument.issueDate": "Fecha de la factura",
};
const REASON_FIELDS: Record<string, string> = { reason: "razón", value: "valor", ivaRateCode: "tarifa de IVA" };
const PAYMENT_FIELDS: Record<string, string> = { methodCode: "forma de pago", amount: "importe" };

/** Nombre, para el usuario, del dato de la nota que el servidor rechazó. */
function fieldLabel(field: string): string {
  const reason = /^reasons\[(\d+)\]\.(\w+)$/.exec(field);
  if (reason) {
    return `Motivo ${Number(reason[1]) + 1}, ${REASON_FIELDS[reason[2] ?? ""] ?? reason[2]}`;
  }
  const payment = /^payments\[\d+\]\.(\w+)$/.exec(field);
  if (payment) {
    return `Pago, ${PAYMENT_FIELDS[payment[1] ?? ""] ?? payment[1]}`;
  }
  return FIELDS[field] ?? field;
}

/** Motivo del cobro: su razón, su valor y la tarifa de IVA (vacía mientras no se elige, la de por defecto). */
type Reason = { key: number; reason: string; value: string; rateCode: string };

/** La tarifa del 15 % si el catálogo la trae; si no, la primera. */
function defaultRate(rates: TaxRate[]): TaxRate | undefined {
  return rates.find((rate) => rate.rate === "15.00") ?? rates[0];
}

/** Valor de un motivo: un importe positivo de hasta dos decimales. */
function validValue(value: string): boolean {
  const parsed = parse(value.trim(), 2);
  return parsed !== null && compare(parsed, ZERO) > 0;
}

/**
 * Formulario de una nota de débito. Con `invoiceId`, sobre esa factura de la plataforma, de la que
 * toma su comprador; sin ella, sobre una factura escrita a mano, con su número, su fecha y un cliente.
 */
export function DebitNoteForm({ tenantId, invoiceId }: { tenantId: string; invoiceId: string | null }) {
  if (invoiceId) {
    return <AuthorizedInvoice tenantId={tenantId} invoiceId={invoiceId}>{(invoice) => <Editor tenantId={tenantId} invoice={invoice} />}</AuthorizedInvoice>;
  }
  return <Editor tenantId={tenantId} invoice={null} />;
}

function Editor({ tenantId, invoice }: { tenantId: string; invoice: Document | null }) {
  const router = useRouter();
  const note = useNoteEmit((id) => router.push(`/documentos/${id}`));
  const [chosenPoint, setChosenPoint] = useState<Point | undefined>(undefined);
  const [manual, setManual] = useState<ManualInvoice>(emptyManualInvoice);
  const nextKey = useRef(1);
  const [reasons, setReasons] = useState<Reason[]>(() => [{ key: 0, reason: "", value: "", rateCode: "" }]);
  const [methodChoice, setMethodChoice] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<string | null>(null);


  const issuer = useApi(() => loadIssuer(invoice?.taxpayerId), [tenantId, invoice?.taxpayerId ?? null]);
  const rates = useApi(() => unwrap(api.GET("/catalogs/tax-rates")), []);
  const methods = useApi(() => unwrap(api.GET("/catalogs/payment-methods")), []);

  function changeReason(key: number, patch: Partial<Reason>) {
    setReasons((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const points = issuer.data?.points ?? [];
  const point = selectedPoint(points, chosenPoint);
  const rateList = rates.data ?? [];
  const fallbackRate = defaultRate(rateList)?.rateCode ?? "";
  const rateDescriptions = new Map(rateList.map((rate) => [rate.rateCode, rate.description]));
  const ratePercents = new Map(rateList.map((rate) => [rate.rateCode, rate.rate]));
  const methodCode = methodChoice || methods.data?.[0]?.code || "";
  const rows = reasons.map((row) => ({ ...row, rateCode: row.rateCode || fallbackRate }));

  // Cada motivo es una línea de cantidad 1: el IVA se agrupa por tarifa como en la factura.
  const preview = previewInvoice(
    rows.map((row) => ({
      quantity: "1",
      unitPrice: validValue(row.value) ? row.value : "",
      discount: "0",
      rateCode: row.rateCode,
      ratePercent: ratePercents.get(row.rateCode) ?? "",
    })),
  );
  const amount = paymentAmount ?? preview.total;
  const paid = sumAmounts([amount]);
  const paymentMatches = paid !== null && paid === preview.total;
  const numberValid = normalizeInvoiceNumber(manual.number) !== null;
  const reasonsComplete = rows.every((row) => row.reason.trim() !== "");

  // Con el botón deshabilitado, se dice por qué.
  const missing = [
    ...(issuer.data !== undefined && (issuer.data === null || point === undefined) ? ["registrar el emisor y un punto de emisión"] : []),
    ...(invoice
      ? []
      : [
        ...(!numberValid ? ["escribir el número de la factura"] : []),
        ...(manual.date === "" ? ["indicar la fecha de la factura"] : []),
        ...(manual.customerId === "" ? ["elegir un cliente"] : []),
      ]),
    ...(!reasonsComplete ? ["escribir la razón de cada motivo"] : []),
    ...(!preview.complete ? ["indicar el valor de cada motivo"] : []),
    ...(preview.complete && !paymentMatches ? ["que el pago sume el total"] : []),
    ...(methodCode === "" ? ["elegir la forma de pago"] : []),
  ];
  const ready = missing.length === 0 && issuer.data != null && point !== undefined;

  function emit(event: FormEvent) {
    return note.submit(event, ready && !!issuer.data && !!point, (idempotencyKey) => {
      if (!issuer.data || !point) {
        throw new Error("Falta el emisor");
      }
      const header = {
        taxpayerId: issuer.data.taxpayerId,
        establishmentCode: point.establishmentCode,
        emissionPointCode: point.emissionPointCode,
        reasons: rows.map((row) => ({ reason: row.reason.trim(), value: row.value.trim(), ivaRateCode: row.rateCode })),
        payments: [{ methodCode, amount: amount.trim() }],
      };
      const body: DebitNoteRequest = invoice
        ? { ...header, invoiceId: invoice.id }
        : {
          ...header,
          modifiedDocument: { code: "01", number: normalizeInvoiceNumber(manual.number) ?? manual.number.trim(), issueDate: manual.date },
          customerId: manual.customerId,
        };
      return unwrap(api.POST("/debit-notes", { params: { header: { "Idempotency-Key": idempotencyKey } }, body }));
    });
  }

  return (
    <form onSubmit={emit} noValidate>
      <ErrorNotice error={issuer.error ?? rates.error ?? methods.error} />
      <IssuerNotices issuer={issuer.data} points={points} />

      {invoice ? <InvoiceFacts invoice={invoice} /> : <ManualInvoiceNotice />}

      <div className="form">
        <PointField points={points} point={point} onChange={setChosenPoint} />
        {invoice ? null : <ManualInvoiceFields tenantId={tenantId} value={manual} onChange={setManual} />}
      </div>

      <h2>Motivos</h2>
      <div className="table-scroll">
        <table className="ruled lines">
          <thead>
            <tr>
              <th scope="col">Razón</th>
              <th scope="col" className="num">
                Valor
              </th>
              <th scope="col">Tarifa de IVA</th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td className="field">
                  <input
                    aria-label={`Razón del motivo ${index + 1}`}
                    maxLength={300}
                    value={row.reason}
                    onChange={(event) => changeReason(row.key, { reason: event.target.value.replace(/[\r\n]+/g, " ") })}
                  />
                </td>
                <td className="field">
                  <input
                    aria-label={`Valor del motivo ${index + 1}`}
                    className="num"
                    inputMode="decimal"
                    size={10}
                    value={row.value}
                    onChange={(event) => changeReason(row.key, { value: event.target.value })}
                  />
                </td>
                <td className="field">
                  <select aria-label={`Tarifa de IVA del motivo ${index + 1}`} value={row.rateCode} onChange={(event) => changeReason(row.key, { rateCode: event.target.value })}>
                    {rateList.map((rate) => (
                      <option key={rate.rateCode} value={rate.rateCode}>
                        {rate.description}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button type="button" className="btn" aria-label={`Quitar el motivo ${index + 1}`} disabled={reasons.length === 1} onClick={() => setReasons((current) => current.filter((candidate) => candidate.key !== row.key))}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <button
          type="button"
          className="btn"
          disabled={reasons.length >= MAX_REASONS}
          onClick={() => setReasons((current) => [...current, { key: nextKey.current++, reason: "", value: "", rateCode: "" }])}
        >
          Agregar motivo
        </button>
      </p>

      <div className="split">
        <div>
          <h2>Pago</h2>
          <div className="form">
            <Field label="Forma de pago" className="wide">
              <select value={methodCode} onChange={(event) => setMethodChoice(event.target.value)}>
                {methods.data?.map((method) => (
                  <option key={method.code} value={method.code}>
                    {catalogLabel(method.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Importe pagado"
              hint="Debe ser igual al total."
              error={preview.complete && !paymentMatches ? `El pago debe sumar ${preview.total}.` : undefined}
            >
              <input className="num" inputMode="decimal" value={amount} onChange={(event) => setPaymentAmount(event.target.value)} />
            </Field>
          </div>
        </div>
        <div>
          <PreviewTotals preview={preview} rateDescriptions={rateDescriptions} />
        </div>
      </div>

      <NoteProblem error={note.error} fieldLabel={fieldLabel} />
      <NoteActions label="Emitir nota de débito" ready={ready} sending={note.sending} missing={missing} />
    </form>
  );
}
