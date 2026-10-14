"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { Field } from "@/components/Field";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { formatInstant } from "@/lib/dates";
import { canWrite, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";

type Subscription = components["schemas"]["WebhookSubscription"];
type EventType = components["schemas"]["WebhookEventType"];
type Delivery = components["schemas"]["WebhookDelivery"];

/** Los avisos que se pueden pedir, en el orden en que le pasan a un comprobante. */
const EVENTS: { type: EventType; label: string }[] = [
  { type: "document.received", label: "El SRI recibió el comprobante" },
  { type: "document.authorized", label: "El SRI lo autorizó" },
  { type: "document.rejected", label: "El SRI lo devolvió o no lo autorizó" },
  { type: "document.delivered", label: "Se envió por correo al cliente" },
];

const DELIVERY_STATUS: Record<Delivery["status"], { label: string; tone: string }> = {
  SENT: { label: "Entregado", tone: "success" },
  PENDING: { label: "Pendiente", tone: "warning" },
  SENDING: { label: "Enviando", tone: "warning" },
  FAILED: { label: "Falló", tone: "danger" },
};

const HISTORY_SIZE = 20;

function eventLabel(type: string): string {
  return EVENTS.find((event) => event.type === type)?.label ?? type;
}

/** Un secreto recién creado o cambiado: es la única vez que se puede ver. */
type Revealed = { secret: string; note: string };

/** A qué sistemas de la empresa se avisa de lo que pasa con sus comprobantes. */
export default function IntegracionesPage() {
  const { active } = useTenant();
  if (!active) {
    return <NoTenant />;
  }
  if (!canWrite(active)) {
    return (
      <Notice>Su rol en esta empresa no permite gestionar las integraciones. Lo hacen el propietario y los administradores.</Notice>
    );
  }
  return <Integrations key={active.id} />;
}

function Integrations() {
  const subscriptions = useApi(() => unwrap(api.GET("/webhooks/subscriptions")), []);
  const [error, setError] = useState<unknown>(undefined);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Revealed | undefined>(undefined);
  const [historyOf, setHistoryOf] = useState<string | undefined>(undefined);

  /** Una operación sobre una dirección: sin dobles envíos, con su error a la vista y la lista releída. */
  async function run(action: () => Promise<unknown>) {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await subscriptions.reload({ quiet: true });
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setBusy(false);
    }
  }

  function toggle(subscription: Subscription) {
    if (
      subscription.status === "ACTIVE"
      && !window.confirm(
        `¿Apagar ${subscription.url}? Los avisos pendientes no se enviarán, y lo que pase mientras esté apagada no se avisará después.`,
      )
    ) {
      return;
    }
    void run(() =>
      unwrap(
        api.PUT("/webhooks/subscriptions/{id}", {
          params: { path: { id: subscription.id } },
          body: {
            url: subscription.url,
            eventTypes: subscription.eventTypes,
            description: subscription.description ?? null,
            enabled: subscription.status !== "ACTIVE",
          },
        }),
      ),
    );
  }

  function rotate(subscription: Subscription) {
    if (
      !window.confirm(
        `¿Cambiar el secreto de ${subscription.url}? El anterior seguirá valiendo un tiempo (24 horas, salvo que la instalación diga otra cosa), para que pueda cambiarlo en su sistema sin perder avisos.`,
      )
    ) {
      return;
    }
    void run(async () => {
      const rotated = await unwrap(api.POST("/webhooks/subscriptions/{id}/secret", { params: { path: { id: subscription.id } } }));
      setRevealed({
        secret: rotated.secret,
        note: `Secreto nuevo de ${subscription.url}. El secreto anterior sigue valiendo hasta el ${formatInstant(rotated.previousSecretExpiresAt)}.`,
      });
    });
  }

  function remove(subscription: Subscription) {
    if (!window.confirm(`¿Borrar ${subscription.url}? Dejará de recibir avisos y se borrará su historial.`)) {
      return;
    }
    if (historyOf === subscription.id) {
      setHistoryOf(undefined);
    }
    void run(() => unwrap(api.DELETE("/webhooks/subscriptions/{id}", { params: { path: { id: subscription.id } } })));
  }

  const open = subscriptions.data?.find((subscription) => subscription.id === historyOf);

  return (
    <>
      <div className="sheet-head">
        <h1>Integraciones</h1>
      </div>
      <p className="lead">
        Su sistema (contabilidad, tienda, ERP) puede enterarse solo de lo que pasa con cada comprobante: registre aquí la dirección a la
        que avisarle. Cada aviso lleva el identificador y el estado del comprobante, nunca datos del cliente ni importes.
      </p>
      <ErrorNotice error={subscriptions.error} />
      <ErrorNotice error={error} />
      {revealed ? <SecretNotice revealed={revealed} /> : null}

      <h2 id="direcciones">Direcciones registradas</h2>
      {subscriptions.loading ? <p>Cargando…</p> : null}
      {subscriptions.data?.length === 0 ? <p className="empty">Todavía no hay direcciones registradas.</p> : null}
      {subscriptions.data && subscriptions.data.length > 0 ? (
        <div className="table-scroll">
          <table className="ruled" aria-labelledby="direcciones">
            <thead>
              <tr>
                <th scope="col">Dirección</th>
                <th scope="col">Se le avisa cuando</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.data.map((subscription) => (
                <tr key={subscription.id}>
                  <td>
                    <span className="break">{subscription.url}</span>
                    {subscription.description ? <p className="field-hint">{subscription.description}</p> : null}
                  </td>
                  <td>
                    <ul className="plain">
                      {subscription.eventTypes.map((type) => (
                        <li key={type}>{eventLabel(type)}</li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <SubscriptionStatus subscription={subscription} />
                  </td>
                  <td>
                    <p className="actions">
                      <button type="button" className="btn-link" onClick={() => setHistoryOf(subscription.id)}>
                        Ver avisos <span className="sr-only">de {subscription.url}</span>
                      </button>
                      <button type="button" className="btn-link" disabled={busy} onClick={() => toggle(subscription)}>
                        {subscription.status === "ACTIVE" ? "Apagar" : "Encender"} <span className="sr-only">{subscription.url}</span>
                      </button>
                      <button type="button" className="btn-link" disabled={busy} onClick={() => rotate(subscription)}>
                        Cambiar el secreto <span className="sr-only">de {subscription.url}</span>
                      </button>
                      <button type="button" className="btn-link" disabled={busy} onClick={() => remove(subscription)}>
                        Borrar <span className="sr-only">{subscription.url}</span>
                      </button>
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {open ? <History key={open.id} subscription={open} /> : null}

      <h2>Registrar una dirección</h2>
      <RegisterForm
        onRegistered={(secret, url) => {
          setRevealed({ secret, note: `Dirección registrada: ${url}.` });
          void subscriptions.reload({ quiet: true });
        }}
      />

      <h2>Cómo comprobar que un aviso es nuestro</h2>
      <ol className="steps">
        <li>
          Cada aviso es un <code>POST</code> con un cuerpo JSON y tres cabeceras: <code>webhook-id</code>, <code>webhook-timestamp</code> y{" "}
          <code>webhook-signature</code>.
        </li>
        <li>
          Calcule el HMAC-SHA256 del texto <code>id.timestamp.cuerpo</code> (las dos cabeceras y el cuerpo tal como llegó, unidos con
          puntos) usando como clave el secreto, sin el prefijo <code>whsec_</code> y decodificado de Base64.
        </li>
        <li>
          El resultado, en Base64 y precedido de <code>v1,</code>, debe ser una de las firmas de <code>webhook-signature</code>. Rechace
          los avisos cuya firma no coincida o cuya hora sea de hace más de cinco minutos, y responda con un código 2xx en menos de diez
          segundos: si no, lo volveremos a intentar con el mismo <code>webhook-id</code>.
        </li>
      </ol>
    </>
  );
}

function SubscriptionStatus({ subscription }: { subscription: Subscription }) {
  if (subscription.status === "ACTIVE") {
    return (
      <>
        <span className="state state-success">Activa</span>
        {subscription.consecutiveFailures > 0 ? (
          <p className="field-hint">Lleva {subscription.consecutiveFailures} intentos fallidos seguidos.</p>
        ) : null}
      </>
    );
  }
  if (subscription.disabledReason === "TOO_MANY_FAILURES") {
    return (
      <>
        <span className="state state-danger">Se apagó sola</span>
        <p className="field-hint">
          Falló {subscription.consecutiveFailures} intentos seguidos. Revise su sistema y vuelva a encenderla.
        </p>
      </>
    );
  }
  return <span className="state state-warning">Apagada</span>;
}

function SecretNotice({ revealed }: { revealed: Revealed }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(revealed.secret);
      setCopied(true);
    }
    catch {
      // Sin permiso para el portapapeles: el secreto sigue a la vista para copiarlo a mano.
      setCopied(false);
    }
  }

  return (
    <Notice kind="success">
      <p>
        {revealed.note} Guarde este secreto en su sistema: con él comprobará que los avisos son nuestros, y{" "}
        <strong>no se volverá a mostrar</strong>.
      </p>
      <Field label="Secreto de firma">
        <input value={revealed.secret} readOnly onFocus={(event) => event.target.select()} />
      </Field>
      <p className="actions">
        <button type="button" className="btn" onClick={copy}>
          Copiar secreto
        </button>
        {copied ? <span role="status">Secreto copiado.</span> : null}
      </p>
    </Notice>
  );
}

function RegisterForm({ onRegistered }: { onRegistered: (secret: string, url: string) => void }) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [chosen, setChosen] = useState<EventType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [missingEvents, setMissingEvents] = useState(false);

  function choose(type: EventType, checked: boolean) {
    setMissingEvents(false);
    setChosen((current) => (checked ? [...current, type] : current.filter((other) => other !== type)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || url.trim() === "") {
      return;
    }
    if (chosen.length === 0) {
      setMissingEvents(true);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const created = await unwrap(
        api.POST("/webhooks/subscriptions", {
          body: {
            url: url.trim(),
            // En el orden de la lista, no en el que se marcaron.
            eventTypes: EVENTS.map((option) => option.type).filter((type) => chosen.includes(type)),
            ...(description.trim() ? { description: description.trim() } : {}),
          },
        }),
      );
      setUrl("");
      setDescription("");
      setChosen([]);
      onRegistered(created.secret, created.url);
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form className="form" onSubmit={submit}>
        <Field
          label="Dirección de su sistema"
          hint="Debe empezar por https:// y ser accesible desde internet. No sirven direcciones de una red interna."
          className="wide"
        >
          <input type="text" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={2048} required />
        </Field>
        <fieldset className="wide">
          <legend>Avisar cuando</legend>
          {EVENTS.map((option) => (
            <label key={option.type} className="check">
              <input type="checkbox" checked={chosen.includes(option.type)} onChange={(event) => choose(option.type, event.target.checked)} />
              {option.label}
            </label>
          ))}
          {missingEvents ? <p className="field-error">Elija al menos un aviso.</p> : null}
        </fieldset>
        <Field label="Descripción (opcional)" hint="Para reconocerla en esta lista." className="wide">
          <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} />
        </Field>
        <div className="actions wide">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Registrar
          </button>
        </div>
      </form>
      <ErrorNotice error={error} />
    </>
  );
}

function History({ subscription }: { subscription: Subscription }) {
  const deliveries = useApi(
    () =>
      unwrap(
        api.GET("/webhooks/subscriptions/{id}/deliveries", {
          params: { path: { id: subscription.id }, query: { page: 0, size: HISTORY_SIZE } },
        }),
      ),
    [subscription.id],
  );
  const [error, setError] = useState<unknown>(undefined);
  const [busy, setBusy] = useState(false);

  async function retry(delivery: Delivery) {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await unwrap(api.POST("/webhooks/deliveries/{id}/retry", { params: { path: { id: delivery.id } } }));
      await deliveries.reload({ quiet: true });
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 id="avisos">
        Avisos enviados a <span className="break">{subscription.url}</span>
      </h2>
      <ErrorNotice error={deliveries.error} />
      <ErrorNotice error={error} />
      {deliveries.loading ? <p>Cargando…</p> : null}
      {deliveries.data?.items.length === 0 ? <p className="empty">Todavía no se le ha enviado ningún aviso.</p> : null}
      {deliveries.data && deliveries.data.items.length > 0 ? (
        <>
          <div className="table-scroll">
            <table className="ruled" aria-labelledby="avisos">
              <thead>
                <tr>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Aviso</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Intentos</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {deliveries.data.items.map((delivery) => {
                  const status = DELIVERY_STATUS[delivery.status];
                  return (
                    <tr key={delivery.id}>
                      <td>{formatInstant(delivery.occurredAt)}</td>
                      <td>{eventLabel(delivery.eventType)}</td>
                      <td>
                        <span className={`state state-${status.tone}`}>{status.label}</span>
                        {delivery.status !== "SENT" && delivery.lastError ? <p className="field-hint">{delivery.lastError}</p> : null}
                        {delivery.status === "PENDING" && delivery.nextAttemptAt ? (
                          <p className="field-hint">Próximo intento: {formatInstant(delivery.nextAttemptAt)}</p>
                        ) : null}
                      </td>
                      <td>{delivery.attemptCount}</td>
                      <td>
                        <p className="actions">
                          <Link href={`/documentos/${delivery.documentId}`}>
                            Ver comprobante <span className="sr-only">del aviso de {formatInstant(delivery.occurredAt)}</span>
                          </Link>
                          {delivery.status === "FAILED" ? (
                            <button type="button" className="btn-link" disabled={busy} onClick={() => retry(delivery)}>
                              Reintentar <span className="sr-only">el aviso de {formatInstant(delivery.occurredAt)}</span>
                            </button>
                          ) : null}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {deliveries.data.total > deliveries.data.items.length ? (
            <p className="field-hint">
              Se muestran los {HISTORY_SIZE} más recientes de {deliveries.data.total}.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
