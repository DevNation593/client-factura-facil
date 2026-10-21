"use client";

import { useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";
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
type Customer = components["schemas"]["Customer"];

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
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  if (!active) {
    return <NoTenant />;
  }

  function set(name: keyof typeof EMPTY, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function edit(customer: Customer) {
    setEditingId(customer.id);
    setForm({
      idType: customer.idType,
      idNumber: customer.idNumber,
      name: customer.name,
      email: customer.email ?? "",
      address: customer.address ?? "",
      phone: customer.phone ?? "",
    });
    setError(undefined);
    setNotice(undefined);
  }

  function cancelEdit() {
    setEditingId(undefined);
    setForm(EMPTY);
    setError(undefined);
  }

  async function remove(customer: Customer) {
    if (deletingId || !window.confirm(`¿Eliminar a ${customer.name}? Sus comprobantes anteriores se conservarán.`)) {
      return;
    }
    setDeletingId(customer.id);
    setError(undefined);
    setNotice(undefined);
    try {
      await unwrap(api.DELETE("/customers/{id}", { params: { path: { id: customer.id } } }));
      if (editingId === customer.id) {
        cancelEdit();
      }
      setNotice(`Cliente eliminado: ${customer.name}.`);
      if (page > 0 && customers.data?.items.length === 1) {
        setPage(page - 1);
      } else {
        await customers.reload({ quiet: true });
      }
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setDeletingId(undefined);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const body = {
        idType: form.idType || (idTypes.data?.[0]?.code ?? ""),
        idNumber: form.idNumber.trim(),
        name: form.name.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      };
      const customer = editingId
        ? await unwrap(api.PUT("/customers/{id}", { params: { path: { id: editingId } }, body }))
        : await unwrap(api.POST("/customers", { body }));
      setNotice(`Cliente ${editingId ? "actualizado" : "registrado"}: ${customer.name}.`);
      setForm(EMPTY);
      setEditingId(undefined);
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
                {canBill(active) ? <th scope="col">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {customers.data.items.map((customer) => (
                <tr key={customer.id}>
                  <td className="code">{customer.idNumber}</td>
                  <td>{customer.name}</td>
                  <td>{customer.email ?? "Sin correo"}</td>
                  {canBill(active) ? (
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn-link" onClick={() => edit(customer)} aria-label={`Editar a ${customer.name}`}>
                          Editar
                        </button>
                        <button type="button" className="btn-link" onClick={() => void remove(customer)} disabled={deletingId === customer.id} aria-label={`Eliminar a ${customer.name}`}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {customers.data ? <Pager page={page} size={PAGE_SIZE} total={customers.data.total} onPage={setPage} /> : null}

      {canBill(active) ? (
        <>
          <h2>{editingId ? "Editar cliente" : "Registrar un cliente"}</h2>
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
                {editingId ? "Guardar cambios" : "Registrar cliente"}
              </button>
              {editingId ? <button type="button" className="btn" onClick={cancelEdit}>Cancelar edición</button> : null}
            </div>
          </form>
          {notice ? <Notice kind="success">{notice}</Notice> : null}
          {error !== undefined && idNumberError === undefined ? <ErrorNotice error={error} /> : null}
        </>
      ) : null}
    </>
  );
}
