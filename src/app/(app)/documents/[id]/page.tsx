"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";
import { Field } from "@/components/Field";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { StateStamp } from "@/components/StateBadge";
import { formatInstant, formatIssueDate } from "@/lib/dates";
import { formatUnitPrice, plainDecimal } from "@/lib/decimal";
import { availableArtifacts, canReissue, canRetry, describeState } from "@/lib/documentStates";
import { documentTypeLabel } from "@/lib/documentTypes";
import { catalogLabel } from "@/lib/catalogLabels";
import { newDraft, saveDraft } from "@/lib/drafts";
import { canBill, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";
import { usePolling } from "@/lib/usePolling";

type Document = components["schemas"]["Document"];
type SriAttempt = components["schemas"]["SriAttempt"];
type Delivery = components["schemas"]["Delivery"];

const OPERATIONS: Record<string, string> = { RECEPTION: "Recepción", AUTHORIZATION: "Autorización" };

const OUTCOMES: Record<string, string> = {
  RECEIVED: "Recibida",
  ALREADY_REGISTERED: "El SRI ya la tenía",
  RETURNED: "Devuelta",
  UNCERTAIN: "Sin respuesta válida",
  ABANDONED: "Envío interrumpido",
  AUTHORIZED: "Autorizada",
  NOT_AUTHORIZED: "No autorizada",
  PROCESSING: "En procesamiento",
  NOT_FOUND: "El SRI aún no la conoce",
  MISMATCH: "Respuesta que no corresponde a este comprobante",
};

const DELIVERY_STATUS: Record<string, string> = {
  PENDING: "Pendiente",
  SENDING: "Enviando",
  SENT: "Aceptado por el servidor de correo",
  FAILED: "No se pudo enviar",
};

const ENVIRONMENTS: Record<string, string> = { "1": "Pruebas", "2": "Producción" };

/** Cuánto se sigue refrescando la hoja después de pedir un reintento o un envío. */
const WATCH_AFTER_ACTION_MS = 60_000;

/** La hoja de un comprobante: sus datos, su estado ante el SRI, sus entregas y sus archivos. */
export default function DocumentoPage() {
  const { active } = useTenant();
  const { id } = useParams<{ id: string }>();
  const document = useApi(() => unwrap(api.GET("/documents/{id}", { params: { path: { id } } })), [active?.id, id]);
  const attempts = useApi(() => unwrap(api.GET("/documents/{id}/sri-attempts", { params: { path: { id } } })), [active?.id, id]);
  const deliveries = useApi(() => unwrap(api.GET("/documents/{id}/deliveries", { params: { path: { id } } })), [active?.id, id]);

  const state = document.data?.state;
  const pendingDelivery = deliveries.data?.some((delivery) => delivery.status === "PENDING" || delivery.status === "SENDING") ?? false;
  function refresh() {
    void document.reload({ quiet: true });
    void attempts.reload({ quiet: true });
    void deliveries.reload({ quiet: true });
  }
  // Tras pedir un reintento o un envío, el cambio lo hace el worker unos segundos después: la hoja
  // se sigue refrescando durante un minuto aunque el estado de partida fuera uno "en reposo".
  const [watching, setWatching] = useState(false);
  useEffect(() => {
    if (!watching) {
      return;
    }
    const timer = setTimeout(() => setWatching(false), WATCH_AFTER_ACTION_MS);
    return () => clearTimeout(timer);
  }, [watching]);
  function afterAction() {
    setWatching(true);
    refresh();
  }
  usePolling(refresh, (state !== undefined && !describeState(state).final) || pendingDelivery || watching);

  if (!active) {
    return <NoTenant />;
  }
  if (document.error instanceof ApiError && document.error.status === 404) {
    return (
      <Notice kind="error">
        No se encontró ese comprobante en esta empresa. <Link href="/documents">Volver a los comprobantes</Link>.
      </Notice>
    );
  }
  if (!document.data) {
    return document.error ? <ErrorNotice error={document.error} /> : <p>Cargando…</p>;
  }

  const invoice = document.data;
  const info = describeState(invoice.state);
  const billing = canBill(active);
  const isInvoice = invoice.documentType === "01";
  const modified = invoice.modifiedDocument;
  return (
    <>
      <div className="sheet-head">
        <h1>
          {documentTypeLabel(invoice.documentType)} <span className="num">{invoice.number}</span>
        </h1>
        <StateStamp state={invoice.state} />
      </div>
      <p className="lead">{info.help}</p>
      {modified ? (
        <p>
          Modifica a:{" "}
          {modified.documentId ? <Link href={`/documents/${modified.documentId}`}>Factura {modified.number}</Link> : <>Factura {modified.number}</>} del{" "}
          {formatIssueDate(modified.issueDate)}
        </p>
      ) : null}

      <dl className="facts">
        <dt>Cliente</dt>
        <dd>
          {invoice.customer.name} ({invoice.customer.idNumber})
        </dd>
        {invoice.reason ? (
          <>
            <dt>Motivo</dt>
            <dd>{invoice.reason}</dd>
          </>
        ) : null}
        <dt>Fecha de emisión</dt>
        <dd>{formatIssueDate(invoice.issueDate)}</dd>
        <dt>Ambiente</dt>
        <dd>{ENVIRONMENTS[invoice.environment] ?? invoice.environment}</dd>
        <dt>Clave de acceso</dt>
        <dd className="num">{invoice.accessKey}</dd>
        {invoice.authorizationNumber ? (
          <>
            <dt>Autorización</dt>
            <dd className="num">
              {invoice.authorizationNumber}
              {invoice.authorizedAt ? `, el ${formatInstant(invoice.authorizedAt)}` : ""}
            </dd>
          </>
        ) : null}
      </dl>

      {billing && canRetry(invoice.state) ? <RetryAction id={invoice.id} onDone={afterAction} /> : null}
      {invoice.replacesDocumentId ? (
        <Notice>
          Esta factura reemplaza a <Link href={`/documents/${invoice.replacesDocumentId}`}>un comprobante que el SRI rechazó</Link>.
        </Notice>
      ) : null}
      {invoice.replacedByDocumentId ? (
        <Notice>
          Este comprobante fue rechazado y ya se emitió <Link href={`/documents/${invoice.replacedByDocumentId}`}>la factura que lo reemplazó</Link>.
        </Notice>
      ) : null}
      {isInvoice && billing && invoice.state === "AUTHORIZED" ? <NoteActions invoice={invoice} /> : null}
      {isInvoice && billing && canReissue(invoice.state) && !invoice.replacedByDocumentId ? <ReissueAction invoice={invoice} tenantId={active.id} /> : null}

      <Downloads id={invoice.id} state={invoice.state} />

      {invoice.reasons ? <Reasons reasons={invoice.reasons} /> : <Lines lines={invoice.lines} />}
      <table className="ruled totals">
        <tbody>
          <tr>
            <td>Subtotal sin impuestos</td>
            <td className="num">{invoice.subtotal}</td>
          </tr>
          <tr>
            <td>Descuento</td>
            <td className="num">{invoice.totalDiscount}</td>
          </tr>
          {invoice.taxes.map((tax) => (
            <tr key={tax.rateCode}>
              <td>IVA {Number(tax.rate)}%</td>
              <td className="num">{tax.amount}</td>
            </tr>
          ))}
          <tr>
            <td>Total</td>
            <td className="num">{invoice.total}</td>
          </tr>
        </tbody>
      </table>

      {invoice.reasons ? <PaymentSummary payments={invoice.payments} /> : null}

      <h2>Ante el SRI</h2>
      <ErrorNotice error={attempts.error} />
      <Attempts attempts={attempts.data ?? []} />

      <h2>Entrega al cliente</h2>
      <ErrorNotice error={deliveries.error} />
      <Deliveries deliveries={deliveries.data ?? []} />
      {billing && invoice.state === "AUTHORIZED" ? <ResendAction id={invoice.id} onDone={afterAction} /> : null}
    </>
  );
}

type Line = Document["lines"][number];

function Lines({ lines }: { lines: Line[] }) {
  return (
    <>
      <h2>Detalle</h2>
      <div className="table-scroll">
        <table className="ruled">
          <thead>
            <tr>
              <th scope="col">Código</th>
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
            {lines.map((line) => (
              <tr key={line.lineNo}>
                <td>{line.mainCode}</td>
                <td>{line.description}</td>
                <td className="num">{plainDecimal(line.quantity)}</td>
                <td className="num">{formatUnitPrice(line.unitPrice)}</td>
                <td className="num">{line.discount}</td>
                <td className="num">{line.subtotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Los motivos de una nota de débito: cada uno con su valor y su IVA. */
function Reasons({ reasons }: { reasons: NonNullable<Document["reasons"]> }) {
  return (
    <>
      <h2>Motivos</h2>
      <div className="table-scroll">
        <table className="ruled">
          <thead>
            <tr>
              <th scope="col">Motivo</th>
              <th scope="col" className="num">
                Valor
              </th>
              <th scope="col" className="num">
                IVA
              </th>
            </tr>
          </thead>
          <tbody>
            {reasons.map((reason, index) => (
              <tr key={index}>
                <td>{reason.reason}</td>
                <td className="num">{reason.value}</td>
                <td className="num">{reason.taxAmount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Forma de pago de una nota de débito, con el nombre que le da el catálogo del SRI. */
function PaymentSummary({ payments }: { payments: Document["payments"] }) {
  const methods = useApi(() => unwrap(api.GET("/catalogs/payment-methods")), []);
  return (
    <>
      <h2>Forma de pago</h2>
      <ul>
        {payments.map((payment, index) => {
          const name = methods.data?.find((method) => method.code === payment.methodCode)?.name;
          return (
            <li key={index}>
              {name ? catalogLabel(name) : payment.methodCode}: {payment.amount}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Desde una factura autorizada se emiten sus notas de crédito y de débito. */
function NoteActions({ invoice }: { invoice: Document }) {
  return (
    <>
      {invoice.creditedTotal != null ? (
        <p className="lead">
          Acreditado ${invoice.creditedTotal} de ${invoice.total}
        </p>
      ) : null}
      <p className="actions">
        <Link className="btn" href={`/notes/new?tipo=credito&factura=${invoice.id}`}>
          Nota de crédito
        </Link>
        <Link className="btn" href={`/notes/new?tipo=debito&factura=${invoice.id}`}>
          Nota de débito
        </Link>
      </p>
    </>
  );
}

function Downloads({ id, state }: { id: string; state: string }) {
  const artifacts = availableArtifacts(state);
  if (artifacts.length === 0) {
    return null;
  }
  return (
    <>
      <h2>Archivos</h2>
      {state === "AUTHORIZED" ? (
        <p className="field-hint">El RIDE y el XML autorizado se generan unos instantes después de la autorización.</p>
      ) : null}
      <p className="actions">
        {artifacts.map((artifact) => (
          <a key={artifact.kind} className="btn" href={`/api/backend/documents/${id}/artifacts/${artifact.kind}`} download>
            {artifact.label}
          </a>
        ))}
      </p>
    </>
  );
}

/**
 * Un comprobante rechazado no se corrige: se emite otro. Esto prepara un borrador con su cliente y
 * sus líneas, que al emitirse quedará enlazado con el rechazado.
 */
function ReissueAction({ invoice, tenantId }: { invoice: Document; tenantId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  function reissue() {
    const draft = {
      ...newDraft(),
      customerId: invoice.customerId ?? "",
      customerName: invoice.customer.name,
      lines: invoice.lines.map((line) => ({
        productId: line.productId ?? "",
        quantity: plainDecimal(line.quantity),
        unitPrice: plainDecimal(line.unitPrice),
        discount: line.discount,
      })),
      replacesDocumentId: invoice.id,
    };
    if (!saveDraft(tenantId, draft)) {
      setFailed(true);
      return;
    }
    router.push(`/invoices/new?borrador=${draft.id}`);
  }

  return (
    <>
      <p className="actions">
        <button type="button" className="btn btn-primary" onClick={reissue}>
          Corregir y emitir de nuevo
        </button>
        <span className="field-hint">
          Abre una factura nueva con estos mismos datos para corregirla. Llevará otro número; este comprobante queda como está.
        </span>
      </p>
      {failed ? <Notice kind="error">No se pudo guardar el borrador en este navegador. Libere espacio o descarte borradores antiguos.</Notice> : null}
    </>
  );
}

function RetryAction({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [done, setDone] = useState(false);

  async function retry() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    setDone(false);
    try {
      await unwrap(api.POST("/documents/{id}/retry", { params: { path: { id } } }));
      setDone(true);
      onDone();
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="actions">
        <button type="button" className="btn" onClick={retry} disabled={busy}>
          Reintentar
        </button>
        <span className="field-hint">Retoma el comprobante donde quedó. Nunca lo envía dos veces al SRI.</span>
      </p>
      {done ? <Notice kind="success">Reintento solicitado. El estado se actualizará en unos segundos.</Notice> : null}
      <ErrorNotice error={error} />
    </>
  );
}

function Attempts({ attempts }: { attempts: SriAttempt[] }) {
  if (attempts.length === 0) {
    return <p className="empty">Todavía no se ha hecho ninguna llamada al SRI por este comprobante.</p>;
  }
  return (
    <div className="table-scroll">
      <table className="ruled">
        <thead>
          <tr>
            <th scope="col">Cuándo</th>
            <th scope="col">Servicio</th>
            <th scope="col">Resultado</th>
            <th scope="col">Mensajes del SRI</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => (
            <tr key={attempt.id}>
              <td>{formatInstant(attempt.startedAt)}</td>
              <td>{OPERATIONS[attempt.operation] ?? attempt.operation}</td>
              <td>
                {attempt.outcome ? (OUTCOMES[attempt.outcome] ?? attempt.outcome) : "En curso"}
                {attempt.sriStatus ? ` (${attempt.sriStatus})` : ""}
              </td>
              <td>
                {attempt.messages.length === 0
                  ? "Ninguno"
                  : attempt.messages.map((message, index) => (
                      <div key={index}>
                        <strong>
                          {message.identifier} {message.message}
                        </strong>
                        {message.additionalInfo ? `: ${message.additionalInfo}` : ""}
                      </div>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Deliveries({ deliveries }: { deliveries: Delivery[] }) {
  if (deliveries.length === 0) {
    return <p className="empty">Este comprobante no se ha enviado por correo.</p>;
  }
  return (
    <div className="table-scroll">
      <table className="ruled">
        <thead>
          <tr>
            <th scope="col">Destinatario</th>
            <th scope="col">Estado</th>
            <th scope="col" className="num">
              Intentos
            </th>
            <th scope="col">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => (
            <tr key={delivery.id}>
              <td>{delivery.recipient}</td>
              <td>{DELIVERY_STATUS[delivery.status] ?? delivery.status}</td>
              <td className="num">{delivery.attemptCount}</td>
              <td>
                {delivery.status === "SENT" && delivery.sentAt ? `El ${formatInstant(delivery.sentAt)}` : (delivery.lastError ?? "")}
                {delivery.automatic ? "" : " (envío pedido a mano)"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResendAction({ id, onDone }: { id: string; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [sentTo, setSentTo] = useState<string | undefined>(undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    setSentTo(undefined);
    try {
      const address = email.trim();
      const delivery = await unwrap(
        api.POST("/documents/{id}/deliveries", { params: { path: { id } }, body: address ? { email: address } : {} }),
      );
      setSentTo(delivery.recipient);
      setEmail("");
      onDone();
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Enviar a otra dirección" hint="Déjelo vacío para enviarlo al correo del cliente.">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} />
        </Field>
        <div className="actions">
          <button type="submit" className="btn" disabled={busy}>
            Enviar por correo
          </button>
        </div>
      </form>
      {sentTo ? <Notice kind="success">Envío solicitado a {sentTo}. Saldrá en unos segundos.</Notice> : null}
      <ErrorNotice error={error} />
    </>
  );
}
