"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { Field } from "@/components/Field";
import { ErrorNotice, Notice } from "@/components/Notice";
import { ROLE_LABELS } from "@/lib/roles";
import { useTenant } from "@/lib/tenantContext";

/** Elegir la empresa con la que se trabaja, o crear una nueva. */
export default function EmpresasPage() {
  const { tenants, active, loading, error, select, reload } = useTenant();
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<unknown>(undefined);

  function use(id: string) {
    select(id);
    router.push("/documentos");
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (saving || name.trim() === "") {
      return;
    }
    setSaving(true);
    setFailure(undefined);
    try {
      const created = await unwrap(api.POST("/tenants", { body: { name: name.trim() } }));
      setName("");
      await reload();
      select(created.id);
      router.push("/configuracion/emisor");
    }
    catch (problem) {
      setFailure(problem);
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sheet-head">
        <h1>Empresas</h1>
      </div>
      <ErrorNotice error={error} />
      {loading ? <p>Cargando…</p> : null}
      {!loading && tenants.length === 0 && !error ? (
        <Notice>Todavía no pertenece a ninguna empresa. Cree la suya para empezar a facturar.</Notice>
      ) : null}
      {tenants.length > 0 ? (
        <table className="ruled">
          <thead>
            <tr>
              <th scope="col">Empresa</th>
              <th scope="col">Su rol</th>
              <th scope="col">
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td>{tenant.name}</td>
                <td>{ROLE_LABELS[tenant.role] ?? tenant.role}</td>
                <td>
                  {active?.id === tenant.id ? (
                    <span>En uso</span>
                  ) : (
                    <button type="button" className="btn-link" onClick={() => use(tenant.id)}>
                      Usar {tenant.name}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <h2>Crear una empresa</h2>
      <p className="lead">Quien la crea queda como propietario.</p>
      <form className="form" onSubmit={create}>
        <Field label="Nombre de la empresa" className="wide">
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required />
        </Field>
        <div className="actions wide">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Crear empresa
          </button>
        </div>
      </form>
      <ErrorNotice error={failure} />
    </>
  );
}
