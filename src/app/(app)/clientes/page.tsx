"use client";

import { useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
import { Field } from "@/components/Field";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { Pager } from "@/components/Pager";
import { catalogLabel } from "@/lib/catalogLabels";
import { canBill, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";
import { useDebounced } from "@/lib/useDebounced";

const PAGE_SIZE = 20;

const EMPTY = { idType: "", idNumber: "", name: "", email: "", address: "", phone: "" };

/** Clientes de la empresa: a quién se le factura. */
export default function ClientesPage() {
  const { active } = useTenant();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const q = useDebounced(search.trim(), 300);
  const customers = useApi(
    () => unwrap(api.GET("/customers", { params: { query: { page, size: PAGE_SIZE, ...(q ? { q } : {}) } } })),
    [active?.id, q, page],
  );
  const idTypes = useApi(() => unwrap(api.GET("/catalogs/identification-types")), []);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [created, setCreated] = useState<string | undefined>(undefined);

  if (!active) {
    return <NoTenant />;
  }

  function set(name: keyof typeof EMPTY, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setSaving(true);
    setError(undefined);
    setCreated(undefined);
    try {
      const customer = await unwrap(
        api.POST("/customers", {
          body: {
            idType: form.idType || (idTypes.data?.[0]?.code ?? ""),
            idNumber: form.idNumber.trim(),
            name: form.name.trim(),
            email: form.email.trim() || null,
            address: form.address.trim() || null,
            phone: form.phone.trim() || null,
          },
        }),
      );
      setCreated(customer.name);
      setForm(EMPTY);
      await customers.reload({ quiet: true });
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setSaving(false);
    }
  }

  const code = error instanceof ApiError ? error.errorCode : undefined;
  const idNumberError
    = code === "IDENTIFICATION_INVALID" ? "El número no corresponde al tipo de identificación elegido."
    : code === "CUSTOMER_ALREADY_EXISTS" ? "Ya existe un cliente con esa identificación."
    : error instanceof ApiError ? error.fieldErrors.idNumber
    : undefined;
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};

  return (
    <>
      <div className="sheet-head">
        <h1>Clientes</h1>
      </div>
      <form className="form" role="search" onSubmit={(event) => event.preventDefault()}>
        <Field label="Buscar cliente" hint="Por nombre o por el comienzo de la identificación.">
          <input
            type="search"
            value={search}
            maxLength={100}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </Field>
      </form>
      <ErrorNotice error={customers.error} />
      {customers.data && customers.data.items.length === 0 ? (
        <p className="empty">{q ? "Ningún cliente coincide con la búsqueda." : "Aún no hay clientes. Registre el primero más abajo."}</p>
      ) : null}
      {customers.data && customers.data.items.length > 0 ? (
        <div className="table-scroll">
          <table className="ruled">
            <thead>
              <tr>
                <th scope="col">Identificación</th>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
              </tr>
            </thead>
            <tbody>
              {customers.data.items.map((customer) => (
                <tr key={customer.id}>
                  <td className="code">{customer.idNumber}</td>
                  <td>{customer.name}</td>
                  <td>{customer.email ?? "Sin correo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {customers.data ? <Pager page={page} size={PAGE_SIZE} total={customers.data.total} onPage={setPage} /> : null}

      {canBill(active) ? (
        <>
          <h2>Registrar un cliente</h2>
          <p className="lead">Con el correo, el cliente recibe la factura y su RIDE en cuanto el SRI la autoriza.</p>
          <ErrorNotice error={idTypes.error} />
          <form className="form" onSubmit={submit} noValidate>
            <Field label="Tipo de identificación" error={fieldErrors.idType}>
              <select value={form.idType || (idTypes.data?.[0]?.code ?? "")} onChange={(event) => set("idType", event.target.value)}>
                {idTypes.data?.map((type) => (
                  <option key={type.code} value={type.code}>
                    {catalogLabel(type.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Número de identificación" error={idNumberError}>
              <input value={form.idNumber} onChange={(event) => set("idNumber", event.target.value)} maxLength={20} required />
            </Field>
            <Field label="Nombre o razón social" className="wide" error={fieldErrors.name}>
              <input value={form.name} onChange={(event) => set("name", event.target.value)} maxLength={300} required />
            </Field>
            <Field label="Correo" hint="Opcional." error={fieldErrors.email}>
              <input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} maxLength={254} />
            </Field>
            <Field label="Teléfono" hint="Opcional." error={fieldErrors.phone}>
              <input value={form.phone} onChange={(event) => set("phone", event.target.value)} maxLength={30} />
            </Field>
            <Field label="Dirección" hint="Opcional." className="wide" error={fieldErrors.address}>
              <input value={form.address} onChange={(event) => set("address", event.target.value)} maxLength={300} />
            </Field>
            <div className="actions wide">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                Registrar cliente
              </button>
            </div>
          </form>
          {created ? <Notice kind="success">Cliente registrado: {created}.</Notice> : null}
          {error !== undefined && idNumberError === undefined ? <ErrorNotice error={error} /> : null}
        </>
      ) : null}
    </>
  );
}
