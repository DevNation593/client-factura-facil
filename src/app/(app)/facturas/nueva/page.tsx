"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";
import { Field } from "@/components/Field";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { catalogLabel } from "@/lib/catalogLabels";
import { formatUnitPrice } from "@/lib/decimal";
import { deleteDraft, findDraft, newDraft, saveDraft, type Draft, type DraftLine } from "@/lib/drafts";
import { previewInvoice, sumAmounts } from "@/lib/invoicePreview";
import { canBill, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";
import { useDebounced } from "@/lib/useDebounced";

type Product = components["schemas"]["Product"];

const LINE_FIELDS: Record<string, string> = { productId: "producto", quantity: "cantidad", unitPrice: "precio unitario", discount: "descuento" };
const PAYMENT_FIELDS: Record<string, string> = { methodCode: "forma de pago", amount: "importe" };

/** Nombre, para el usuario, del dato de la factura que el servidor rechazó. */
function fieldLabel(field: string): string {
  const line = /^lines\[(\d+)\]\.(\w+)$/.exec(field);
  if (line) {
    return `Línea ${Number(line[1]) + 1}, ${LINE_FIELDS[line[2] ?? ""] ?? line[2]}`;
  }
  const payment = /^payments\[\d+\]\.(\w+)$/.exec(field);
  if (payment) {
    return `Pago, ${PAYMENT_FIELDS[payment[1] ?? ""] ?? payment[1]}`;
  }
  return field === "customerId" ? "Cliente" : field;
}

/** Punto de emisión habilitado, con el código de su establecimiento. */
type Point = { establishmentCode: string; emissionPointCode: string };

async function loadIssuer(): Promise<{ taxpayerId: string; points: Point[] } | null> {
  const taxpayer = (await unwrap(api.GET("/taxpayers")))[0];
  if (!taxpayer) {
    return null;
  }
  const establishments = await unwrap(
    api.GET("/taxpayers/{taxpayerId}/establishments", { params: { path: { taxpayerId: taxpayer.id } } }),
  );
  const points: Point[] = [];
  for (const establishment of establishments) {
    const list = await unwrap(api.GET("/emission-points", { params: { query: { establishmentId: establishment.id } } }));
    for (const point of list) {
      if (point.enabled) {
        points.push({ establishmentCode: establishment.code, emissionPointCode: point.code });
      }
    }
  }
  return { taxpayerId: taxpayer.id, points };
}

/** Editor de una factura. Lo que se escribe se guarda como borrador en este navegador hasta emitirla. */
export default function NuevaFacturaPage() {
  const { active } = useTenant();
  const draftId = useSearchParams().get("borrador");
  if (!active) {
    return <NoTenant />;
  }
  if (!canBill(active)) {
    return <Notice>Su rol en esta empresa no permite emitir facturas.</Notice>;
  }
  return <Editor key={`${active.id}:${draftId ?? ""}`} tenantId={active.id} draftId={draftId} />;
}

function Editor({ tenantId, draftId }: { tenantId: string; draftId: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => (draftId ? findDraft(tenantId, draftId) : undefined) ?? newDraft());
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);
  /** Lo escrito no se pudo guardar como borrador (no hay sitio, o el navegador no deja). */
  const [unsaved, setUnsaved] = useState(false);
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  /** Productos que este editor ya ha visto: los de cada búsqueda y los de las líneas del borrador. */
  const [known, setKnown] = useState<Map<string, Product>>(() => new Map());
  const missingHint = useId();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  /** Evita un segundo envío antes de que React vuelva a pintar el botón desactivado. */
  const inFlight = useRef(false);
  /** Tras emitir, el borrador ya no existe: no hay que volver a guardarlo. */
  const emitted = useRef(false);

  const q = useDebounced(search.trim(), 300);
  const issuer = useApi(loadIssuer, [tenantId]);
  const customers = useApi(() => unwrap(api.GET("/customers", { params: { query: { size: 20, ...(q ? { q } : {}) } } })), [tenantId, q]);
  const productQuery = useDebounced(productSearch.trim(), 300);

  function remember(products: Product[]) {
    setKnown((current) => {
      const next = new Map(current);
      products.forEach((product) => next.set(product.id, product));
      return next;
    });
  }

  // Los productos se buscan, como los clientes: un catálogo real no cabe en una lista.
  const products = useApi(async () => {
    const page = await unwrap(api.GET("/products", { params: { query: { size: 20, ...(productQuery ? { q: productQuery } : {}) } } }));
    remember(page.items);
    return page;
  }, [tenantId, productQuery]);
  // Los de las líneas de un borrador retomado pueden no estar en ninguna búsqueda: se piden por su id.
  const unknownIds = [...new Set(draft.lines.map((line) => line.productId).filter((id) => id !== "" && !known.has(id)))].sort();
  const lineProducts = useApi(async () => {
    const found = await Promise.all(
      unknownIds.map((id) =>
        unwrap(api.GET("/products/{id}", { params: { path: { id } } })).catch((problem: unknown) => {
          // Un producto que ya no existe deja su línea por completar; lo demás sí es un fallo.
          if (problem instanceof ApiError && problem.status === 404) {
            return null;
          }
          throw problem;
        }),
      ),
    );
    remember(found.filter((product) => product !== null));
    return found;
  }, [tenantId, unknownIds.join(",")]);
  const rates = useApi(() => unwrap(api.GET("/catalogs/tax-rates")), []);
  const methods = useApi(() => unwrap(api.GET("/catalogs/payment-methods")), []);

  // El borrador se guarda al dejar de escribir.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const timer = setTimeout(() => {
      if (emitted.current) {
        return;
      }
      const saved = saveDraft(tenantId, draft);
      setUnsaved(!saved);
      if (saved) {
        setSavedAt(new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, dirty, tenantId]);

  function change(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function changeLine(index: number, patch: Partial<DraftLine>) {
    change({ lines: draft.lines.map((line, position) => (position === index ? { ...line, ...patch } : line)) });
  }

  // Valores por defecto mientras el usuario no elige: el primer punto de emisión y la primera forma de pago.
  const points = issuer.data?.points ?? [];
  const point = points.find((candidate) => candidate.establishmentCode === draft.establishmentCode && candidate.emissionPointCode === draft.emissionPointCode) ?? points[0];
  const methodCode = draft.payments[0]?.methodCode || methods.data?.[0]?.code || "";

  const productById = known;
  const results = products.data?.items ?? [];
  const rateByCode = new Map((rates.data ?? []).map((rate) => [rate.rateCode, rate]));
  const preview = previewInvoice(
    draft.lines.map((line) => {
      const product = productById.get(line.productId);
      const rate = product ? rateByCode.get(product.ivaRateCode) : undefined;
      return {
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        rateCode: product?.ivaRateCode ?? "",
        ratePercent: rate?.rate ?? "",
      };
    }),
  );
  // Con un solo pago, su importe sigue al total hasta que el usuario lo escribe.
  const paymentAmount = draft.paymentEdited ? (draft.payments[0]?.amount ?? "") : preview.total;
  const paid = sumAmounts([paymentAmount]);
  const paymentMatches = paid !== null && paid === preview.total;
  const ready = preview.complete && paymentMatches && draft.customerId !== "" && point !== undefined && methodCode !== "" && issuer.data != null;
  // Con el botón deshabilitado, se dice por qué.
  const missing = [
    ...(issuer.data !== undefined && (issuer.data === null || point === undefined) ? ["registrar el emisor y un punto de emisión"] : []),
    ...(draft.customerId === "" ? ["elegir un cliente"] : []),
    ...(!preview.complete ? ["completar el detalle (producto, cantidad y precio de cada línea)"] : []),
    ...(preview.complete && !paymentMatches ? ["que el pago sume el total"] : []),
  ];
  /** A dónde volver tras iniciar sesión de nuevo: a este mismo borrador. */
  const returnTo = `/facturas/nueva?borrador=${draft.id}`;

  async function emit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !ready || !issuer.data || !point) {
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError(undefined);
    // Antes de enviar, el borrador queda guardado tal como se va a emitir.
    saveDraft(tenantId, draft);
    try {
      const issued = await unwrap(
        api.POST("/invoices", {
          params: { header: { "Idempotency-Key": draft.idempotencyKey } },
          body: {
            taxpayerId: issuer.data.taxpayerId,
            establishmentCode: point.establishmentCode,
            emissionPointCode: point.emissionPointCode,
            customerId: draft.customerId,
            // Sin los espacios que pueda traer un valor pegado: la vista previa los ignora, la API no.
            lines: draft.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity.trim(),
              unitPrice: line.unitPrice.trim(),
              discount: line.discount.trim() === "" ? "0.00" : line.discount.trim(),
            })),
            payments: [{ methodCode, amount: paymentAmount.trim() }],
            ...(draft.replacesDocumentId ? { replacesDocumentId: draft.replacesDocumentId } : {}),
          },
        }),
      );
      emitted.current = true;
      deleteDraft(tenantId, draft.id);
      router.push(`/documentos/${issued.id}`);
    }
    catch (problem) {
      setError(problem);
      inFlight.current = false;
      setSending(false);
    }
  }

  const sessionExpired = error instanceof ApiError && error.status === 401;
  const keyReused = error instanceof ApiError && error.errorCode === "IDEMPOTENCY_KEY_REUSED";
  // En el editor no hay un campo por cada dato que el servidor valida: se dice aquí cuál rechazó.
  const rejected = error instanceof ApiError ? Object.entries(error.fieldErrors) : [];

  return (
    <form onSubmit={emit} noValidate>
      <div className="sheet-head">
        <h1>Nueva factura</h1>
        <span className="draft-mark" role="status">
          {savedAt ? `Borrador guardado a las ${savedAt}` : "Borrador sin guardar"}
        </span>
      </div>
      {unsaved ? (
        <Notice kind="warning">
          Lo que escribe no se está guardando como borrador: ya hay el máximo de borradores en este navegador, o el navegador no permite
          guardar. Puede emitir la factura igualmente; para volver a guardar, <Link href="/facturas/borradores">descarte borradores</Link> que
          ya no necesite.
        </Notice>
      ) : null}
      {draft.replacesDocumentId ? (
        <Notice>
          Esta factura reemplazará a <Link href={`/documentos/${draft.replacesDocumentId}`}>un comprobante que el SRI rechazó</Link>. Corrija lo
          que hizo que lo rechazara antes de emitirla.
        </Notice>
      ) : null}
      <ErrorNotice error={issuer.error ?? products.error ?? lineProducts.error ?? rates.error ?? methods.error} returnTo={returnTo} />
      {issuer.data === null ? (
        <Notice kind="warning">
          Antes de facturar hay que <Link href="/configuracion/emisor">registrar el emisor</Link>.
        </Notice>
      ) : null}
      {issuer.data && points.length === 0 ? (
        <Notice kind="warning">
          El emisor no tiene ningún punto de emisión habilitado. <Link href="/configuracion/emisor">Añada uno</Link> para poder facturar.
        </Notice>
      ) : null}

      <div className="form">
        <Field label="Punto de emisión" hint="El número de la factura se asigna al emitirla.">
          <select
            value={point ? `${point.establishmentCode}-${point.emissionPointCode}` : ""}
            onChange={(event) => {
              const [establishmentCode = "", emissionPointCode = ""] = event.target.value.split("-");
              change({ establishmentCode, emissionPointCode });
            }}
          >
            {points.map((candidate) => (
              <option key={`${candidate.establishmentCode}-${candidate.emissionPointCode}`}>
                {candidate.establishmentCode}-{candidate.emissionPointCode}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Buscar cliente" hint="Por nombre o identificación.">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} />
        </Field>
        <Field label="Cliente" className="wide">
          <select
            value={draft.customerId}
            onChange={(event) => {
              const customer = customers.data?.items.find((candidate) => candidate.id === event.target.value);
              change({ customerId: event.target.value, customerName: customer?.name ?? "" });
            }}
          >
            <option value="">Elija un cliente</option>
            {draft.customerId && !customers.data?.items.some((customer) => customer.id === draft.customerId) ? (
              <option value={draft.customerId}>{draft.customerName}</option>
            ) : null}
            {customers.data?.items.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.idNumber})
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorNotice error={customers.error} returnTo={returnTo} />

      <h2>Detalle</h2>
      <div className="form">
        <Field label="Buscar producto" hint="Por nombre o código. Los resultados aparecen en la lista de cada línea.">
          <input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} maxLength={100} />
        </Field>
      </div>
      <div className="table-scroll">
        <table className="ruled lines">
          <thead>
            <tr>
              <th scope="col">Producto</th>
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
              <th scope="col">
                <span className="sr-only">Quitar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((line, index) => (
              <tr key={index}>
                <td className="field">
                  <select
                    aria-label={`Producto de la línea ${index + 1}`}
                    value={line.productId}
                    onChange={(event) => {
                      const product = productById.get(event.target.value);
                      changeLine(index, { productId: event.target.value, unitPrice: product ? formatUnitPrice(product.unitPrice) : line.unitPrice });
                    }}
                  >
                    <option value="">Elija un producto</option>
                    {line.productId !== "" && !results.some((product) => product.id === line.productId) ? (
                      <option value={line.productId}>
                        {productById.has(line.productId)
                          ? `${productById.get(line.productId)?.name} (${productById.get(line.productId)?.sku})`
                          : "Producto no disponible"}
                      </option>
                    ) : null}
                    {results.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="field">
                  <input
                    aria-label={`Cantidad de la línea ${index + 1}`}
                    className="num"
                    inputMode="decimal"
                    size={8}
                    value={line.quantity}
                    onChange={(event) => changeLine(index, { quantity: event.target.value })}
                  />
                </td>
                <td className="field">
                  <input
                    aria-label={`Precio unitario de la línea ${index + 1}`}
                    className="num"
                    inputMode="decimal"
                    size={10}
                    value={line.unitPrice}
                    onChange={(event) => changeLine(index, { unitPrice: event.target.value })}
                  />
                </td>
                <td className="field">
                  <input
                    aria-label={`Descuento de la línea ${index + 1}`}
                    className="num"
                    inputMode="decimal"
                    size={8}
                    value={line.discount}
                    onChange={(event) => changeLine(index, { discount: event.target.value })}
                  />
                </td>
                <td className="num">{preview.lines[index] ?? "Incompleta"}</td>
                <td>
                  {draft.lines.length > 1 ? (
                    <button type="button" className="btn-link" onClick={() => change({ lines: draft.lines.filter((_, position) => position !== index) })}>
                      Quitar <span className="sr-only">la línea {index + 1}</span>
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="actions">
        <button
          type="button"
          className="btn"
          onClick={() => change({ lines: [...draft.lines, { productId: "", quantity: "1", unitPrice: "", discount: "0.00" }] })}
        >
          Añadir línea
        </button>
      </p>

      <div className="split">
        <div>
          <h2>Pago</h2>
          <div className="form">
            <Field label="Forma de pago" className="wide">
              <select value={methodCode} onChange={(event) => change({ payments: [{ methodCode: event.target.value, amount: draft.payments[0]?.amount ?? "" }] })}>
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
              <input
                className="num"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(event) => change({ payments: [{ methodCode, amount: event.target.value }], paymentEdited: true })}
              />
            </Field>
          </div>
        </div>
        <div>
          <h2>Totales</h2>
          <table className="ruled totals">
            <tbody>
              {preview.taxes.map((tax) => (
                <tr key={`base-${tax.rateCode}`}>
                  <td>Subtotal {rateByCode.get(tax.rateCode)?.description ?? `${tax.ratePercent}%`}</td>
                  <td className="num">{tax.base}</td>
                </tr>
              ))}
              <tr>
                <td>Subtotal sin impuestos</td>
                <td className="num">{preview.subtotal}</td>
              </tr>
              <tr>
                <td>Descuento</td>
                <td className="num">{preview.totalDiscount}</td>
              </tr>
              {preview.taxes
                .filter((tax) => tax.amount !== "0.00")
                .map((tax) => (
                  <tr key={`iva-${tax.rateCode}`}>
                    {/* El catálogo describe la tarifa solo con su porcentaje ("15%"): el impuesto lo nombra la pantalla. */}
                    <td>IVA {Number(tax.ratePercent)}%</td>
                    <td className="num">{tax.amount}</td>
                  </tr>
                ))}
              <tr>
                <td>Total</td>
                <td className="num" data-testid="total">
                  {preview.total}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="field-hint">Vista previa. El total definitivo lo calcula el servidor al emitir.</p>
        </div>
      </div>

      {sessionExpired ? (
        <Notice kind="error">
          Su sesión terminó. El borrador está guardado:{" "}
          <a href={`/auth/login?volver=${encodeURIComponent(`/facturas/nueva?borrador=${draft.id}`)}`}>inicie sesión</a> y continúe donde lo dejó.
        </Notice>
      ) : keyReused ? (
        <Notice kind="error">
          Este borrador ya se había emitido con otro contenido. Revise los <Link href="/documentos">comprobantes</Link> antes de volver a emitir.
        </Notice>
      ) : rejected.length > 0 ? (
        <Notice kind="error">
          El servidor no aceptó estos datos de la factura:
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
          {sending ? "Emitiendo…" : "Emitir factura"}
        </button>
        <Link href="/facturas/borradores">Ver borradores</Link>
      </p>
      {missing.length > 0 ? (
        <p className="field-hint" id={missingHint}>
          Para emitir falta: {missing.join("; ")}.
        </p>
      ) : null}
    </form>
  );
}
