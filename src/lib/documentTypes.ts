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

/** Una pestaña de un submódulo: su listado, sus borradores o su pantalla de emisión. */
export type SubmoduleTab = { label: string; href: string };

/** Un submódulo de "Comprobantes": el listado de un tipo y, si la plataforma lo emite, su pantalla de emisión. */
export type DocumentSubmodule = {
  code: DocumentTypeCode;
  /** Plural para la navegación y el título del listado. */
  title: string;
  href: string;
  /** Quién está al otro lado del comprobante (encabezado de la columna con su nombre). */
  counterpart: string;
  /** Lo que dice el listado cuando no hay ninguno. */
  empty: string;
  /** null mientras la API no emita este tipo: el submódulo no ofrece una pantalla que no funcionaría. */
  issue: SubmoduleTab | null;
  /** Borradores guardados en el navegador; solo las facturas los tienen. */
  drafts: SubmoduleTab | null;
};

/** Los submódulos de "Comprobantes", en el orden en que aparecen en la navegación. */
export const DOCUMENT_SUBMODULES: readonly DocumentSubmodule[] = [
  {
    code: "01",
    title: "Facturas",
    href: "/documents/invoices",
    counterpart: "Cliente",
    empty: "Aún no se ha emitido ninguna factura.",
    issue: { href: "/documents/invoices/new", label: "Nueva factura" },
    drafts: { href: "/documents/invoices/drafts", label: "Borradores" },
  },
  {
    code: "04",
    title: "Notas de crédito",
    href: "/documents/credit-notes",
    counterpart: "Cliente",
    empty: "Aún no se ha emitido ninguna nota de crédito.",
    issue: { href: "/documents/credit-notes/new", label: "Nueva nota de crédito" },
    drafts: null,
  },
  {
    code: "05",
    title: "Notas de débito",
    href: "/documents/debit-notes",
    counterpart: "Cliente",
    empty: "Aún no se ha emitido ninguna nota de débito.",
    issue: { href: "/documents/debit-notes/new", label: "Nueva nota de débito" },
    drafts: null,
  },
  {
    code: "06",
    title: "Guías de remisión",
    href: "/documents/waybills",
    counterpart: "Destinatario",
    empty: "No hay guías de remisión.",
    issue: null,
    drafts: null,
  },
  {
    code: "03",
    title: "Liquidaciones de compra",
    href: "/documents/purchase-settlements",
    counterpart: "Proveedor",
    empty: "No hay liquidaciones de compra.",
    issue: null,
    drafts: null,
  },
  {
    code: "07",
    title: "Retenciones",
    href: "/documents/withholdings",
    counterpart: "Sujeto retenido",
    empty: "No hay comprobantes de retención.",
    issue: null,
    drafts: null,
  },
];

export function documentSubmodule(code: DocumentTypeCode): DocumentSubmodule {
  const found = DOCUMENT_SUBMODULES.find((candidate) => candidate.code === code);
  if (!found) {
    throw new Error(`Tipo de comprobante sin submódulo: ${code}`);
  }
  return found;
}

/** Pestañas de un submódulo: lo emitido y, para quien puede emitir, los borradores y la emisión. */
export function submoduleTabs(submodule: DocumentSubmodule, canIssue: boolean): SubmoduleTab[] {
  const tabs: SubmoduleTab[] = [{ label: "Emitidas", href: submodule.href }];
  if (canIssue) {
    for (const tab of [submodule.drafts, submodule.issue]) {
      if (tab) {
        tabs.push(tab);
      }
    }
  }
  return tabs;
}
