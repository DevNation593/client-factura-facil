import { add, compare, format, mul, parse, roundHalfUp, sub, ZERO, type Dec } from "./decimal";

export type PreviewLineInput = {
  quantity: string;
  unitPrice: string;
  discount: string;
  /** Código de la tarifa de IVA del producto, y su porcentaje ("15.00"). */
  rateCode: string;
  ratePercent: string;
};

export type InvoicePreview = {
  /** Subtotal de cada línea; nulo si la línea aún no es calculable. */
  lines: (string | null)[];
  subtotal: string;
  totalDiscount: string;
  taxes: { rateCode: string; ratePercent: string; base: string; amount: string }[];
  total: string;
  /** Falso si alguna línea está incompleta o es inválida: el total todavía no es fiable. */
  complete: boolean;
};

/** base × tarifa / 100, redondeado a dos decimales. */
function percentage(base: Dec, ratePercent: Dec): Dec {
  const product = mul(base, ratePercent);
  return roundHalfUp({ units: product.units, scale: product.scale + 2 }, 2);
}

/**
 * Vista previa de los totales con las reglas del servidor (ficha técnica, 9.16 y 9.17): el
 * subtotal de cada línea es cantidad × precio − descuento redondeado a dos decimales, y el IVA de
 * cada tarifa se calcula sobre la suma de las bases de esa tarifa, no línea por línea. Es solo una
 * vista previa: el total que vale es el que devuelve la API.
 */
export function previewInvoice(lines: PreviewLineInput[]): InvoicePreview {
  let subtotal = ZERO;
  let totalDiscount = ZERO;
  let complete = lines.length > 0;
  const lineSubtotals: (string | null)[] = [];
  const bases = new Map<string, { ratePercent: Dec; base: Dec }>();

  for (const line of lines) {
    const quantity = parse(line.quantity, 6);
    const unitPrice = parse(line.unitPrice, 6);
    const discount = parse(line.discount === "" ? "0" : line.discount, 2);
    const ratePercent = parse(line.ratePercent, 2);
    const gross = quantity && unitPrice ? mul(quantity, unitPrice) : null;
    if (!quantity || !unitPrice || !discount || !ratePercent || !gross || compare(quantity, ZERO) <= 0 || compare(discount, gross) > 0) {
      lineSubtotals.push(null);
      complete = false;
      continue;
    }
    const lineSubtotal = roundHalfUp(sub(gross, discount), 2);
    lineSubtotals.push(format(lineSubtotal, 2));
    subtotal = add(subtotal, lineSubtotal);
    totalDiscount = add(totalDiscount, discount);
    const entry = bases.get(line.rateCode);
    bases.set(line.rateCode, { ratePercent, base: entry ? add(entry.base, lineSubtotal) : lineSubtotal });
  }

  let total = subtotal;
  const taxes = [...bases.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([rateCode, { ratePercent, base }]) => {
      const amount = percentage(base, ratePercent);
      total = add(total, amount);
      return { rateCode, ratePercent: format(ratePercent, 2), base: format(base, 2), amount: format(amount, 2) };
    });

  return {
    lines: lineSubtotals,
    subtotal: format(subtotal, 2),
    totalDiscount: format(totalDiscount, 2),
    taxes,
    total: format(total, 2),
    complete,
  };
}

/** Suma de importes en cadena; nulo si alguno no es un importe válido de hasta dos decimales. */
export function sumAmounts(amounts: string[]): string | null {
  let total = ZERO;
  for (const amount of amounts) {
    const value = parse(amount, 2);
    if (!value) {
      return null;
    }
    total = add(total, value);
  }
  return format(total, 2);
}
