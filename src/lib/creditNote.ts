import { compare, format, parse, sub, ZERO } from "./decimal";

const TEN = BigInt(10);
const TWO = BigInt(2);

/**
 * Descuento de una línea acreditada en proporción a su cantidad, como lo calcula el servidor cuando
 * no se envía: descuento original × cantidad / cantidad original, a dos decimales (la mitad exacta
 * se aleja de cero). Nulo si la cantidad aún no es válida.
 */
export function prorateDiscount(originalDiscount: string, quantity: string, originalQuantity: string): string | null {
  const discount = parse(originalDiscount, 2);
  const credited = parse(quantity, 6);
  const original = parse(originalQuantity, 6);
  if (!discount || !credited || !original || compare(original, ZERO) <= 0) {
    return null;
  }
  // (d / 10^sd) × (q / 10^sq) / (o / 10^so), en centésimas: d × q × 10^(so + 2) / (o × 10^(sd + sq)).
  const numerator = discount.units * credited.units * TEN ** BigInt(original.scale + 2);
  const denominator = original.units * TEN ** BigInt(discount.scale + credited.scale);
  const cents = (numerator * TWO + denominator) / (denominator * TWO);
  return format({ units: cents, scale: 2 }, 2);
}

/** Lo que aún se puede acreditar de una factura: su total menos lo que ya acreditan sus notas vigentes. */
export function availableBalance(total: string, creditedTotal: string | null | undefined): string {
  const invoiceTotal = parse(total, 2) ?? ZERO;
  const credited = parse(creditedTotal ?? "0", 2) ?? ZERO;
  return format(sub(invoiceTotal, credited), 2);
}
