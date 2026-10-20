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
