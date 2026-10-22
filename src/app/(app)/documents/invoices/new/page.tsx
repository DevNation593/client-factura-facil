"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";
import { CatalogPicker } from "@/components/CatalogPicker";
import { Field } from "@/components/Field";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { PaymentTermFields } from "@/components/PaymentTermFields";
import { PointSelect } from "@/components/PointSelect";
import { PreviewTotals } from "@/components/PreviewTotals";
import { ProductLines } from "@/components/ProductLines";
import { SubmoduleTabs } from "@/components/SubmoduleTabs";
import { catalogLabel } from "@/lib/catalogLabels";
import { deleteDraft, findDraft, newDraft, saveDraft, type Draft } from "@/lib/drafts";
import { previewInvoice, sumAmounts } from "@/lib/invoicePreview";
import { loadIssuer } from "@/lib/issuer";
import { termFields, validTerm } from "@/lib/paymentTerm";
import { loginUrl } from "@/lib/sessionNavigation";
import { canBill, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";

type Product = components["schemas"]["Product"];

const LINE_FIELDS: Record<string, string> = { productId: "producto", quantity: "cantidad", unitPrice: "precio unitario", discount: "descuento" };
const PAYMENT_FIELDS: Record<string, string> = { methodCode: "forma de pago", amount: "importe", term: "plazo", timeUnit: "unidad de tiempo" };

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
  const [customerLabel, setCustomerLabel] = useState(draft.customerName);
  /** Productos que este editor ya ha visto: los de cada búsqueda y los de las líneas del borrador. */
  const [known, setKnown] = useState<Map<string, Product>>(() => new Map());
  const missingHint = useId();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  /** Evita un segundo envío antes de que React vuelva a pintar el botón desactivado. */
  const inFlight = useRef(false);
  /** Tras emitir, el borrador ya no existe: no hay que volver a guardarlo. */
  const emitted = useRef(false);
  /** Lo cambiado que aún espera su guardado. */
  const pending = useRef<Draft | undefined>(undefined);

  const issuer = useApi(() => loadIssuer(), [tenantId]);

  function remember(products: Product[]) {
    setKnown((current) => {
      const next = new Map(current);
      products.forEach((product) => next.set(product.id, product));
      return next;
    });
  }

  async function searchCustomers(query: string) {
    const page = await unwrap(api.GET("/customers", { params: { query: { size: 20, ...(query ? { q: query } : {}) } } }));
    return page.items;
  }

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
    pending.current = draft;
    const timer = setTimeout(() => {
      pending.current = undefined;
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

  // Quien sale antes de esos 400 ms, a otra pantalla o cerrando la pestaña, no pierde lo último que cambió.
  useEffect(() => {
    function flush() {
      const unsavedDraft = pending.current;
      pending.current = undefined;
      if (unsavedDraft && !emitted.current) {
        saveDraft(tenantId, unsavedDraft);
      }
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [tenantId]);

  function change(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  /** Cambia un dato del único pago y conserva los demás. */
  function changePayment(patch: Partial<Draft["payments"][number]>, edited?: boolean) {
    setDraft((current) => {
      const payment = current.payments[0] ?? { methodCode: "", amount: "" };
      return { ...current, payments: [{ ...payment, ...patch }], ...(edited ? { paymentEdited: true } : {}) };
    });
    setDirty(true);
  }

  // Valores por defecto mientras el usuario no elige: el primer punto de emisión y la primera forma de pago.
  const points = issuer.data?.points ?? [];
  const point = points.find((candidate) => candidate.establishmentCode === draft.establishmentCode && candidate.emissionPointCode === draft.emissionPointCode) ?? points[0];
  const methodCode = draft.payments[0]?.methodCode || methods.data?.[0]?.code || "";
  const term = draft.payments[0]?.term ?? "";
  const timeUnit = draft.payments[0]?.timeUnit ?? "";
  const termValid = validTerm(term);

  const productById = known;
  const rateByCode = new Map((rates.data ?? []).map((rate) => [rate.rateCode, rate]));
  const rateDescriptions = new Map((rates.data ?? []).map((rate) => [rate.rateCode, rate.description]));
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
  const ready =
    preview.complete && paymentMatches && termValid && draft.customerId !== "" && point !== undefined && methodCode !== "" && issuer.data != null;
  // Con el botón deshabilitado, se dice por qué.
  const missing = [
    ...(issuer.data !== undefined && (issuer.data === null || point === undefined) ? ["registrar el emisor y un punto de emisión"] : []),
    ...(draft.customerId === "" ? ["elegir un cliente"] : []),
    ...(!preview.complete ? ["completar el detalle (producto, cantidad y precio de cada línea)"] : []),
    ...(preview.complete && !paymentMatches ? ["que el pago sume el total"] : []),
    ...(!termValid ? ["corregir el plazo de pago"] : []),
  ];
  /** A dónde volver tras iniciar sesión de nuevo: a este mismo borrador. */
  const returnTo = `/documents/invoices/new?borrador=${draft.id}`;

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
            payments: [{ methodCode, amount: paymentAmount.trim(), ...termFields(term, timeUnit) }],
            ...(draft.replacesDocumentId ? { replacesDocumentId: draft.replacesDocumentId } : {}),
          },
        }),
      );
      emitted.current = true;
      deleteDraft(tenantId, draft.id);
      router.push(`/documents/${issued.id}`);
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
      <SubmoduleTabs type="01" />
      {unsaved ? (
        <Notice kind="warning">
          Lo que escribe no se está guardando como borrador: ya hay el máximo de borradores en este navegador, o el navegador no permite
          guardar. Puede emitir la factura igualmente; para volver a guardar, <Link href="/documents/invoices/drafts">descarte borradores</Link> que
          ya no necesite.
        </Notice>
      ) : null}
      {draft.replacesDocumentId ? (
        <Notice>
          Esta factura reemplazará a <Link href={`/documents/${draft.replacesDocumentId}`}>un comprobante que el SRI rechazó</Link>. Corrija lo
          que hizo que lo rechazara antes de emitirla.
        </Notice>
      ) : null}
      <ErrorNotice error={issuer.error ?? lineProducts.error ?? rates.error ?? methods.error} returnTo={returnTo} />
      {issuer.data === null ? (
        <Notice kind="warning">
          Antes de facturar hay que <Link href="/settings/issuer">registrar el emisor</Link>.
        </Notice>
      ) : null}
      {issuer.data && points.length === 0 ? (
        <Notice kind="warning">
          El emisor no tiene ningún punto de emisión habilitado. <Link href="/settings/issuer">Añada uno</Link> para poder facturar.
        </Notice>
      ) : null}

      <div className="form">
        <Field label="Punto de emisión" hint="El número de la factura se asigna al emitirla.">
          <PointSelect points={points} value={point} onChange={(chosen) => change(chosen)} />
        </Field>
        <Field label="Cliente" className="wide">
          <CatalogPicker
            tenantId={tenantId}
            value={draft.customerId}
            selectedLabel={customerLabel}
            placeholder="Elija o busque un cliente"
            returnTo={returnTo}
            load={searchCustomers}
            optionLabel={(customer) => `${customer.name} (${customer.idNumber})`}
            onSearchStart={() => {
              setCustomerLabel("");
              change({ customerId: "", customerName: "" });
            }}
            onSelect={(customer) => {
              setCustomerLabel(`${customer.name} (${customer.idNumber})`);
              change({ customerId: customer.id, customerName: customer.name });
            }}
          />
        </Field>
      </div>

      <h2>Detalle</h2>
      <ProductLines
        tenantId={tenantId}
        lines={draft.lines}
        products={productById}
        subtotals={preview.lines}
        returnTo={returnTo}
        onChange={(lines) => change({ lines })}
        onProductSeen={(product) => remember([product])}
      />

      <div className="split">
        <div>
          <h2>Pago</h2>
          <div className="form">
            <Field label="Forma de pago" className="wide">
              <select value={methodCode} onChange={(event) => changePayment({ methodCode: event.target.value })}>
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
                onChange={(event) => changePayment({ methodCode, amount: event.target.value }, true)}
              />
            </Field>
            <PaymentTermFields term={term} timeUnit={timeUnit} onChange={(patch) => changePayment(patch)} />
          </div>
        </div>
        <div>
          <PreviewTotals preview={preview} rateDescriptions={rateDescriptions} />
        </div>
      </div>

      {sessionExpired ? (
        <Notice kind="error">
          Su sesión terminó. El borrador está guardado:{" "}
          <a href={loginUrl(`/documents/invoices/new?borrador=${draft.id}`)}>inicie sesión</a> y continúe donde lo dejó.
        </Notice>
      ) : keyReused ? (
        <Notice kind="error">
          Este borrador ya se había emitido con otro contenido. Revise los <Link href="/documents">comprobantes</Link> antes de volver a emitir.
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
        <Link href="/documents/invoices/drafts">Ver borradores</Link>
      </p>
      {missing.length > 0 ? (
        <p className="field-hint" id={missingHint}>
          Para emitir falta: {missing.join("; ")}.
        </p>
      ) : null}
    </form>
  );
}
