"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";
import { Field } from "@/components/Field";
import { ErrorNotice, Notice } from "@/components/Notice";
import { PointSelect } from "@/components/PointSelect";
import { PreviewTotals } from "@/components/PreviewTotals";
import { catalogLabel } from "@/lib/catalogLabels";
import { compare, parse, ZERO } from "@/lib/decimal";
import { normalizeInvoiceNumber } from "@/lib/invoiceNumber";
import { previewInvoice, sumAmounts } from "@/lib/invoicePreview";
import { loadIssuer, type Point } from "@/lib/issuer";
import { useApi } from "@/lib/useApi";

import { AuthorizedInvoice, emptyManualInvoice, InvoiceFacts, ManualInvoiceFields, ManualInvoiceNotice, type ManualInvoice } from "./NoteSource";

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
  // La clave nace con el formulario: un doble clic o un reintento tras un fallo emiten la misma nota.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [chosenPoint, setChosenPoint] = useState<Point | undefined>(undefined);
  const [manual, setManual] = useState<ManualInvoice>(emptyManualInvoice);
  const nextKey = useRef(1);
  const [reasons, setReasons] = useState<Reason[]>(() => [{ key: 0, reason: "", value: "", rateCode: "" }]);
  const [methodChoice, setMethodChoice] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<string | null>(null);

  const missingHint = useId();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  /** Evita un segundo envío antes de que React vuelva a pintar el botón desactivado. */
  const inFlight = useRef(false);

  const issuer = useApi(() => loadIssuer(invoice?.taxpayerId), [tenantId, invoice?.taxpayerId ?? null]);
  const rates = useApi(() => unwrap(api.GET("/catalogs/tax-rates")), []);
  const methods = useApi(() => unwrap(api.GET("/catalogs/payment-methods")), []);

  function changeReason(key: number, patch: Partial<Reason>) {
    setReasons((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const points = issuer.data?.points ?? [];
  const point = points.find((candidate) => candidate.establishmentCode === chosenPoint?.establishmentCode && candidate.emissionPointCode === chosenPoint.emissionPointCode) ?? points[0];
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

  async function emit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !ready || !issuer.data || !point) {
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError(undefined);
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
    try {
      const issued = await unwrap(api.POST("/debit-notes", { params: { header: { "Idempotency-Key": idempotencyKey } }, body }));
      router.push(`/documentos/${issued.id}`);
    }
    catch (problem) {
      setError(problem);
      inFlight.current = false;
      setSending(false);
    }
  }

  const keyReused = error instanceof ApiError && error.errorCode === "IDEMPOTENCY_KEY_REUSED";
  const rejected = error instanceof ApiError ? Object.entries(error.fieldErrors) : [];

  return (
    <form onSubmit={emit} noValidate>
      <ErrorNotice error={issuer.error ?? rates.error ?? methods.error} />
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

      {invoice ? <InvoiceFacts invoice={invoice} /> : <ManualInvoiceNotice />}

      <div className="form">
        <Field label="Punto de emisión" hint="El número de la nota se asigna al emitirla.">
          <PointSelect points={points} value={point} onChange={setChosenPoint} />
        </Field>
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
                {fieldLabel(field)}: {message}
              </li>
            ))}
          </ul>
        </Notice>
      ) : (
        <ErrorNotice error={error} />
      )}
      <p className="actions">
        <button type="submit" className="btn btn-primary" disabled={!ready || sending} aria-describedby={missing.length > 0 ? missingHint : undefined}>
          {sending ? "Emitiendo…" : "Emitir nota de débito"}
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
