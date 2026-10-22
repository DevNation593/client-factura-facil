/**
 * Borradores de factura. La API no tiene borradores: se guardan en este navegador, por empresa.
 * No se comparten entre dispositivos ni reservan secuencial; el número se asigna al emitir.
 */
export type DraftLine = { productId: string; quantity: string; unitPrice: string; discount: string };

/** term y timeUnit, el plazo y su unidad, faltan en los borradores guardados antes de que existieran. */
export type DraftPayment = { methodCode: string; amount: string; term?: string; timeUnit?: string };

export type Draft = {
  id: string;
  /**
   * Clave de idempotencia con la que se emite este borrador. Nace con él y no cambia: si la
   * emisión se repite (doble clic, reintento tras un corte), la API devuelve la misma factura.
   */
  idempotencyKey: string;
  updatedAt: string;
  establishmentCode: string;
  emissionPointCode: string;
  customerId: string;
  /** Solo para reconocer el borrador en la lista. */
  customerName: string;
  lines: DraftLine[];
  payments: DraftPayment[];
  /** Comprobante rechazado por el SRI al que reemplazará la factura que salga de este borrador. */
  replacesDocumentId?: string;
  /** Si el usuario escribió el importe del pago; mientras no, sigue al total. */
  paymentEdited: boolean;
};

const MAX_DRAFTS = 50;

function storageKey(tenantId: string): string {
  return `einvoice.borradores.${tenantId}`;
}

function isDraft(value: unknown): value is Draft {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.id === "string"
    && typeof draft.idempotencyKey === "string"
    && typeof draft.updatedAt === "string"
    && !Number.isNaN(Date.parse(draft.updatedAt))
    && ["establishmentCode", "emissionPointCode", "customerId", "customerName"].every((field) => typeof draft[field] === "string")
    && Array.isArray(draft.lines)
    && draft.lines.every((line) => hasStrings(line, ["productId", "quantity", "unitPrice", "discount"]))
    && Array.isArray(draft.payments)
    && draft.payments.every((payment) => hasStrings(payment, ["methodCode", "amount"]))
    && (draft.replacesDocumentId === undefined || typeof draft.replacesDocumentId === "string")
  );
}

/** Lo guardado pudo escribirlo otra versión de la aplicación, o alguien a mano: se comprueba entero. */
function hasStrings(value: unknown, fields: string[]): boolean {
  return value !== null && typeof value === "object" && fields.every((field) => typeof (value as Record<string, unknown>)[field] === "string");
}

export function newDraft(): Draft {
  return {
    id: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    establishmentCode: "",
    emissionPointCode: "",
    customerId: "",
    customerName: "",
    lines: [{ productId: "", quantity: "1", unitPrice: "", discount: "0.00" }],
    payments: [{ methodCode: "", amount: "" }],
    paymentEdited: false,
  };
}

/** Borradores de la empresa, el más reciente primero. Un almacenamiento ilegible cuenta como vacío. */
export function listDrafts(tenantId: string): Draft[] {
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isDraft).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  catch {
    return [];
  }
}

export function findDraft(tenantId: string, id: string): Draft | undefined {
  return listDrafts(tenantId).find((draft) => draft.id === id);
}

/**
 * Guarda el borrador (lo crea o lo reemplaza). Devuelve false si no se guardó: el navegador no deja,
 * o es uno nuevo y ya hay el máximo. Nunca se descarta otro borrador para hacerle sitio.
 */
export function saveDraft(tenantId: string, draft: Draft): boolean {
  const existing = listDrafts(tenantId);
  const others = existing.filter((other) => other.id !== draft.id);
  if (others.length === existing.length && existing.length >= MAX_DRAFTS) {
    return false;
  }
  const all = [{ ...draft, updatedAt: new Date().toISOString() }, ...others];
  try {
    window.localStorage.setItem(storageKey(tenantId), JSON.stringify(all));
    return true;
  }
  catch {
    return false;
  }
}

export function deleteDraft(tenantId: string, id: string): void {
  try {
    const remaining = listDrafts(tenantId).filter((draft) => draft.id !== id);
    window.localStorage.setItem(storageKey(tenantId), JSON.stringify(remaining));
  }
  catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}
