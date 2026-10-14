"use client";

import { useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [local, setLocal] = useState<{ sku?: string; unitPrice?: string; ivaRateCode?: string }>({});
  const [created, setCreated] = useState<string | undefined>(undefined);

  if (!active) {
    return <NoTenant />;
  }

  function set(name: keyof typeof EMPTY, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
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
    setCreated(undefined);
    try {
      const product = await unwrap(
        api.POST("/products", {
          body: {
            sku: form.sku,
            name: form.name.trim(),
            unitPrice: format(price, Math.max(2, price.scale)),
            ivaRateCode: form.ivaRateCode,
          },
        }),
      );
      setCreated(product.name);
      setForm(EMPTY);
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
        <p className="empty">{q ? "Ningún producto coincide con la búsqueda." : "Aún no hay productos."}</p>
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
              </tr>
            </thead>
            <tbody>
              {products.data.items.map((product) => (
                <tr key={product.id}>
                  <td>{product.sku}</td>
                  <td>{product.name}</td>
                  <td className="num">{formatUnitPrice(product.unitPrice)}</td>
                  <td>{rateLabel(product.ivaRateCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {products.data ? <Pager page={page} size={PAGE_SIZE} total={products.data.total} onPage={setPage} /> : null}

      {canWrite(active) ? (
        <>
          <h2>Registrar un producto</h2>
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
                Registrar producto
              </button>
            </div>
          </form>
          {created ? <Notice kind="success">Producto registrado: {created}.</Notice> : null}
          {error !== undefined && code !== "PRODUCT_SKU_TAKEN" ? <ErrorNotice error={error} /> : null}
        </>
      ) : null}
    </>
  );
}
