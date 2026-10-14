/**
 * Aritmética decimal exacta para importes. Los importes viajan como cadenas ("12.50") y aquí se
 * operan como enteros escalados (BigInt): nunca pasan por `number`, que no puede representar
 * décimas con exactitud.
 */
export type Dec = { readonly units: bigint; readonly scale: number };

const TEN = BigInt(10);
const ZERO_UNITS = BigInt(0);

export const ZERO: Dec = { units: ZERO_UNITS, scale: 0 };

function pow10(exponent: number): bigint {
  return TEN ** BigInt(exponent);
}

/**
 * Lee una cadena decimal sin signo ni exponente, con punto como separador y hasta `maxScale`
 * decimales. Nulo si no lo es: "1,5", "-1", "1e3" o "" no son importes válidos.
 */
export function parse(text: string, maxScale: number): Dec | null {
  const match = /^([0-9]{1,12})(?:\.([0-9]+))?$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const fraction = match[2] ?? "";
  if (fraction.length > maxScale) {
    return null;
  }
  return { units: BigInt(match[1] + fraction), scale: fraction.length };
}

function rescale(value: Dec, scale: number): bigint {
  return value.units * pow10(scale - value.scale);
}

export function add(a: Dec, b: Dec): Dec {
  const scale = Math.max(a.scale, b.scale);
  return { units: rescale(a, scale) + rescale(b, scale), scale };
}

export function sub(a: Dec, b: Dec): Dec {
  const scale = Math.max(a.scale, b.scale);
  return { units: rescale(a, scale) - rescale(b, scale), scale };
}

export function mul(a: Dec, b: Dec): Dec {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

/** Redondea a `scale` decimales; la mitad exacta se aleja de cero, como hace el servidor. */
export function roundHalfUp(value: Dec, scale: number): Dec {
  if (value.scale <= scale) {
    return { units: rescale(value, scale), scale };
  }
  const divisor = pow10(value.scale - scale);
  const negative = value.units < ZERO_UNITS;
  const magnitude = negative ? -value.units : value.units;
  const rounded = (magnitude * BigInt(2) + divisor) / (divisor * BigInt(2));
  return { units: negative ? -rounded : rounded, scale };
}

export function compare(a: Dec, b: Dec): number {
  const scale = Math.max(a.scale, b.scale);
  const left = rescale(a, scale);
  const right = rescale(b, scale);
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Cadena con exactamente `scale` decimales (redondeando si hace falta), como las que usa la API. */
export function format(value: Dec, scale: number): string {
  const rounded = roundHalfUp(value, scale);
  const negative = rounded.units < ZERO_UNITS;
  const digits = (negative ? -rounded.units : rounded.units).toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = scale > 0 ? `.${digits.slice(digits.length - scale)}` : "";
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/** Una cantidad como se escribiría a mano: "2.000000" es "2" y "1.500000" es "1.5". Nunca redondea. */
export function plainDecimal(value: string): string {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

/** Un precio unitario con al menos dos decimales y sin ceros de más: "12.500000" es "12.50". Nunca redondea. */
export function formatUnitPrice(value: string): string {
  const [whole, fraction = ""] = plainDecimal(value).split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
