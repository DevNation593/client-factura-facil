/**
 * Número de una factura escrito a mano, como EEE-PPP-SSSSSSSSS (establecimiento, punto de emisión
 * y secuencial). Se acepta también con los quince dígitos seguidos, porque el teclado numérico del
 * teléfono no tiene guion. Nulo si no es ninguna de las dos formas.
 */
export function normalizeInvoiceNumber(text: string): string | null {
  const value = text.trim();
  const digits = /^([0-9]{3})([0-9]{3})([0-9]{9})$/.exec(value);
  if (digits) {
    return `${digits[1]}-${digits[2]}-${digits[3]}`;
  }
  return /^[0-9]{3}-[0-9]{3}-[0-9]{9}$/.test(value) ? value : null;
}
