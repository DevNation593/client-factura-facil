"use client";

import { useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { Pager } from "@/components/Pager";
import { format, formatUnitPrice, parse } from "@/lib/decimal";
import { canWrite, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";
import { useDebounced } from "@/lib/useDebounced";

const PAGE_SIZE = 20;

const SKU = /^[A-Za-z0-9._-]{1,25}$/;

const EMPTY = { sku: "", name: "", unitPrice: "", ivaRateCode: "" };
type Product = components["schemas"]["Product"];

/** Productos y servicios que se facturan, cada uno con su precio y su tarifa de IVA. */
export default function ProductosPage() {
  const { active } = useTenant();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const q = useDebounced(search.trim(), 300);
  const products = useApi(
    () => unwrap(api.GET("/products", { params: { query: { page, size: PAGE_SIZE, ...(q ? { q } : {}) } } })),
    [active?.id, q, page],
  );
  const rates = useApi(() => unwrap(api.GET("/catalogs/tax-rates")), []);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [local, setLocal] = useState<{ sku?: string; unitPrice?: string; ivaRateCode?: string }>({});
  const [notice, setNotice] = useState<string | undefined>(undefined);

  if (!active) {
    return <NoTenant />;
  }

  function set(name: keyof typeof EMPTY, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function edit(product: Product) {
    setEditingId(product.id);
    setForm({ sku: product.sku, name: product.name, unitPrice: formatUnitPrice(product.unitPrice), ivaRateCode: product.ivaRateCode });
    setLocal({});
    setError(undefined);
    setNotice(undefined);
  }

  function cancelEdit() {
    setEditingId(undefined);
    setForm(EMPTY);
    setLocal({});
    setError(undefined);
  }

  async function remove(product: Product) {
    if (deletingId || !window.confirm(`¿Eliminar ${product.name}? Sus comprobantes anteriores se conservarán.`)) {
      return;
    }
    setDeletingId(product.id);
    setError(undefined);
    setNotice(undefined);
    try {
      await unwrap(api.DELETE("/products/{id}", { params: { path: { id: product.id } } }));
      if (editingId === product.id) {
        cancelEdit();
      }
      setNotice(`Producto eliminado: ${product.name}.`);
      if (page > 0 && products.data?.items.length === 1) {
        setPage(page - 1);
      } else {
        await products.reload({ quiet: true });
      }
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setDeletingId(undefined);
    }
  }

  const rateLabel = (code: string) => rates.data?.find((rate) => rate.rateCode === code)?.description ?? code;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) {
      return;
    }
    const price = parse(form.unitPrice, 6);
    const problems: { sku?: string; unitPrice?: string; ivaRateCode?: string } = {};
    if (!SKU.test(form.sku)) {
      problems.sku = "Hasta 25 caracteres: letras, números, punto, guion y guion bajo.";
    }
    if (price === null) {
      problems.unitPrice = "Escriba el precio con punto decimal y sin signos, por ejemplo 12.50 (hasta 6 decimales).";
    }
    if (form.ivaRateCode === "") {
      // No se elige por el usuario: la primera del catálogo es 0 %, y un producto mal gravado se nota tarde.
      problems.ivaRateCode = "Elija la tarifa de IVA.";
    }
    setLocal(problems);
    if (price === null || problems.sku || problems.ivaRateCode) {
      return;
    }
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const body = {
        sku: form.sku,
        name: form.name.trim(),
        unitPrice: format(price, Math.max(2, price.scale)),
        ivaRateCode: form.ivaRateCode,
      };
      const product = editingId
        ? await unwrap(api.PUT("/products/{id}", { params: { path: { id: editingId } }, body }))
        : await unwrap(api.POST("/products", { body }));
      setNotice(`Producto ${editingId ? "actualizado" : "registrado"}: ${product.name}.`);
      setForm(EMPTY);
      setEditingId(undefined);
      await products.reload({ quiet: true });
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setSaving(false);
    }
  }

  const code = error instanceof ApiError ? error.errorCode : undefined;
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
  const skuError = local.sku ?? (code === "PRODUCT_SKU_TAKEN" ? "Ya existe un producto con ese código." : fieldErrors.sku);

  return (
    <>
      <div className="sheet-head">
        <h1>Productos</h1>
      </div>
      <form className="form" role="search" onSubmit={(event) => event.preventDefault()}>
        <Field label="Buscar producto" hint="Por nombre o por código.">
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
      <ErrorNotice error={products.error} />
      {products.data && products.data.items.length === 0 ? (
        <EmptyState icon="box">{q ? "Ningún producto coincide con la búsqueda." : "Aún no hay productos."}</EmptyState>
      ) : null}
      {products.data && products.data.items.length > 0 ? (
        <div className="table-scroll">
          <table className="ruled">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nombre</th>
                <th scope="col" className="num">
                  Precio unitario
                </th>
                <th scope="col">IVA</th>
                {canWrite(active) ? <th scope="col">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {products.data.items.map((product) => (
                <tr key={product.id}>
                  <td>{product.sku}</td>
                  <td>{product.name}</td>
                  <td className="num">{formatUnitPrice(product.unitPrice)}</td>
                  <td>{rateLabel(product.ivaRateCode)}</td>
                  {canWrite(active) ? (
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn-link" onClick={() => edit(product)} aria-label={`Editar a ${product.name}`}>
                          Editar
                        </button>
                        <button type="button" className="btn-link" onClick={() => void remove(product)} disabled={deletingId === product.id} aria-label={`Eliminar a ${product.name}`}>
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
      {products.data ? <Pager page={page} size={PAGE_SIZE} total={products.data.total} onPage={setPage} /> : null}

      {canWrite(active) ? (
        <>
          <h2>{editingId ? "Editar producto" : "Registrar un producto"}</h2>
          <ErrorNotice error={rates.error} />
          <form className="form" onSubmit={submit} noValidate>
            <Field label="Código" error={skuError}>
              <input value={form.sku} onChange={(event) => set("sku", event.target.value.trim())} maxLength={25} required />
            </Field>
            <Field label="Nombre" error={fieldErrors.name}>
              <input value={form.name} onChange={(event) => set("name", event.target.value)} maxLength={300} required />
            </Field>
            <Field label="Precio unitario sin IVA" hint="En dólares, con punto decimal." error={local.unitPrice ?? fieldErrors.unitPrice}>
              <input value={form.unitPrice} onChange={(event) => set("unitPrice", event.target.value)} inputMode="decimal" maxLength={20} required />
            </Field>
            <Field label="Tarifa de IVA" error={local.ivaRateCode ?? fieldErrors.ivaRateCode}>
              <select value={form.ivaRateCode} onChange={(event) => set("ivaRateCode", event.target.value)} required>
                <option value="">Elija la tarifa</option>
                {rates.data?.map((rate) => (
                  <option key={rate.rateCode} value={rate.rateCode}>
                    {rate.description}
                  </option>
                ))}
              </select>
            </Field>
            <div className="actions wide">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {editingId ? "Guardar cambios" : "Registrar producto"}
              </button>
              {editingId ? <button type="button" className="btn" onClick={cancelEdit}>Cancelar edición</button> : null}
            </div>
          </form>
          {notice ? <Notice kind="success">{notice}</Notice> : null}
          {error !== undefined && code !== "PRODUCT_SKU_TAKEN" ? <ErrorNotice error={error} /> : null}
        </>
      ) : null}
    </>
  );
}
