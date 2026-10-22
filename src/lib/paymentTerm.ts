/** Plazo de una forma de pago (plazo y unidadTiempo del XML), común a la factura y a la nota de débito. */

/** Hasta 12 enteros y 2 decimales, como lo admite el SRI. */
const TERM = /^[0-9]{1,12}(\.[0-9]{1,2})?$/;

/** Unidades del plazo; el valor es el que va en el XML (hasta 10 caracteres). */
export const TIME_UNITS = [
  { value: "dias", label: "Días" },
  { value: "meses", label: "Meses" },
  { value: "años", label: "Años" },
];

export const DEFAULT_TIME_UNIT = "dias";

/** Un plazo vacío es válido: es opcional. */
export function validTerm(term: string): boolean {
  const value = term.trim();
  return value === "" || TERM.test(value);
}

/** Lo que el pago lleva del plazo: plazo y unidad juntos, o nada si no se escribió plazo. */
export function termFields(term: string, timeUnit: string): { term: string; timeUnit: string } | Record<string, never> {
  const value = term.trim();
  return value === "" ? {} : { term: value, timeUnit: timeUnit || DEFAULT_TIME_UNIT };
}
