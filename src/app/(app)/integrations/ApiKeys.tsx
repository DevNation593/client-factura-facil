"use client";

import { useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { Field } from "@/components/Field";
import { ErrorNotice } from "@/components/Notice";
import { SecretNotice } from "@/components/SecretNotice";
import { formatInstant } from "@/lib/dates";
import { useApi } from "@/lib/useApi";

type ApiKey = components["schemas"]["ApiKey"];
type CreatedApiKey = components["schemas"]["CreatedApiKey"];

/** Las llaves con las que un sistema externo llama a la API sin pasar por la web. */
export function ApiKeys() {
  const keys = useApi(() => unwrap(api.GET("/api-keys")), []);
  const [error, setError] = useState<unknown>(undefined);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedApiKey | undefined>(undefined);

  /** Una operación sobre las keys: sin dobles envíos, con su error a la vista y la lista releída. */
  async function run(action: () => Promise<unknown>) {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await keys.reload({ quiet: true });
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy || name.trim() === "") {
      return;
    }
    setCreated(undefined);
    await run(async () => {
      const result = await unwrap(api.POST("/api-keys", { body: { name: name.trim() } }));
      setCreated(result);
      setName("");
    });
  }

  function revoke(key: ApiKey) {
    if (
      !window.confirm(
        `¿Revocar la key «${key.name}»? Los sistemas que usen esta key dejarán de poder facturar, y no se puede volver a activar.`,
      )
    ) {
      return;
    }
    void run(() => unwrap(api.DELETE("/api-keys/{id}", { params: { path: { id: key.id } } })));
  }

  return (
    <section>
      <h2 id="api-keys">API keys</h2>
      <p className="lead">
        Una API key permite que un sistema suyo (ERP, tienda) emita comprobantes llamando directamente a la API, sin iniciar sesión.
        Cree una por sistema para poder revocarla sin afectar a los demás.
      </p>
      <ErrorNotice error={keys.error} />
      <ErrorNotice error={error} />
      {created ? (
        <SecretNotice label="API key" value={created.key} copyLabel="Copiar key">
          <p>API key «{created.name}» creada. Guárdala ahora: no volverás a verla.</p>
        </SecretNotice>
      ) : null}

      {keys.loading ? <p>Cargando…</p> : null}
      {keys.data?.length === 0 ? <p className="empty">Todavía no hay API keys.</p> : null}
      {keys.data && keys.data.length > 0 ? (
        <div className="table-scroll">
          <table className="ruled" aria-labelledby="api-keys">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Key</th>
                <th scope="col">Creada</th>
                <th scope="col">Creada por</th>
                <th scope="col">Último uso</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.data.map((key) => (
                <tr key={key.id} className={key.revokedAt ? "muted" : undefined}>
                  <td>{key.name}</td>
                  <td>
                    <code>{`efk_${key.publicId}_…`}</code>
                  </td>
                  <td>{formatInstant(key.createdAt)}</td>
                  <td>{key.createdBy ?? ""}</td>
                  <td>{key.lastUsedAt ? formatInstant(key.lastUsedAt) : "Nunca"}</td>
                  <td>
                    {key.revokedAt ? (
                      <span className="state state-danger">Revocada el {formatInstant(key.revokedAt)}</span>
                    ) : (
                      <button type="button" className="btn-link" disabled={busy} onClick={() => revoke(key)}>
                        Revocar <span className="sr-only">{key.name}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <h3>Crear una API key</h3>
      <form className="form" onSubmit={create}>
        <Field label="Nombre de la key" hint="Para reconocerla en esta lista, por ejemplo el sistema que la usará." className="wide">
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        </Field>
        <div className="actions wide">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Crear API key
          </button>
        </div>
      </form>
    </section>
  );
}
