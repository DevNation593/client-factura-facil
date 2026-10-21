import type { components } from "@/api/schema";

type DocumentTypeCode = components["schemas"]["DocumentTypeCode"];

/** Código de tipo de comprobante del SRI → nombre completo y nombre corto (para listados). */
const TYPES: Record<string, { label: string; short: string }> = {
  "01": { label: "Factura", short: "Factura" },
  "03": { label: "Liquidación de compra", short: "Liquidación" },
  "04": { label: "Nota de crédito", short: "N. crédito" },
  "05": { label: "Nota de débito", short: "N. débito" },
  "06": { label: "Guía de remisión", short: "Guía" },
  "07": { label: "Comprobante de retención", short: "Retención" },
};

const UNKNOWN = "Comprobante";

export function documentTypeLabel(code: string): string {
  return TYPES[code]?.label ?? UNKNOWN;
}

export function documentTypeShort(code: string): string {
  return TYPES[code]?.short ?? UNKNOWN;
}

/** Un submódulo de "Comprobantes": el listado de un tipo y, si la plataforma lo emite, su pantalla de emisión. */
export type DocumentModule = {
  code: DocumentTypeCode;
  /** Plural para la navegación y el título del listado. */
  title: string;
  href: string;
  /** Quién está al otro lado del comprobante (encabezado de la columna con su nombre). */
  counterpart: string;
  /** Lo que dice el listado cuando no hay ninguno. */
  empty: string;
  /** null mientras la API no emita este tipo: el listado no ofrece un botón que no funcionaría. */
  issue: { href: string; label: string } | null;
};

/** Los submódulos de "Comprobantes", en el orden en que aparecen en la navegación. */
export const DOCUMENT_MODULES: readonly DocumentModule[] = [
  {
    code: "01",
    title: "Facturas",
    href: "/documentos/facturas",
    counterpart: "Cliente",
    empty: "Aún no se ha emitido ninguna factura.",
    issue: { href: "/facturas/nueva", label: "Nueva factura" },
  },
  {
    code: "04",
    title: "Notas de crédito",
    href: "/documentos/notas-de-credito",
    counterpart: "Cliente",
    empty: "Aún no se ha emitido ninguna nota de crédito.",
    issue: { href: "/notas/nueva?tipo=credito", label: "Nueva nota de crédito" },
  },
  {
    code: "05",
    title: "Notas de débito",
    href: "/documentos/notas-de-debito",
    counterpart: "Cliente",
    empty: "Aún no se ha emitido ninguna nota de débito.",
    issue: { href: "/notas/nueva?tipo=debito", label: "Nueva nota de débito" },
  },
  {
    code: "06",
    title: "Guías de remisión",
    href: "/documentos/guias-de-remision",
    counterpart: "Destinatario",
    empty: "No hay guías de remisión.",
    issue: null,
  },
  {
    code: "03",
    title: "Liquidaciones de compra",
    href: "/documentos/liquidaciones-de-compra",
    counterpart: "Proveedor",
    empty: "No hay liquidaciones de compra.",
    issue: null,
  },
  {
    code: "07",
    title: "Retenciones",
    href: "/documentos/retenciones",
    counterpart: "Sujeto retenido",
    empty: "No hay comprobantes de retención.",
    issue: null,
  },
];

export function documentModule(code: DocumentTypeCode): DocumentModule {
  const found = DOCUMENT_MODULES.find((candidate) => candidate.code === code);
  if (!found) {
    throw new Error(`Tipo de comprobante sin submódulo: ${code}`);
  }
  return found;
}
