import { describeState, type StateInfo } from "./documentStates";
import { sumAmounts } from "./invoicePreview";

type Tone = StateInfo["tone"];

/** Lo que se resume de cada comprobante: su estado y su total. */
export type SummaryInput = { state: string; total?: string | null };

export type DocumentSummary = {
  /** Cuántos comprobantes entran en el resumen. */
  count: number;
  /** Cuántos tiene la empresa de este tipo: si son más que `count`, el resumen es de los últimos. */
  total: number;
  byTone: Record<Tone, number>;
  /** Suma de los totales de los autorizados, con dos decimales; nulo si alguno no se puede sumar. */
  authorizedAmount: string | null;
};

/** El orden de los tramos de la barra: lo que ya está bien primero, lo que pide atención al final. */
export const TONE_ORDER: readonly Tone[] = ["success", "progress", "warning", "danger"];

/** Resume una página de comprobantes, la más reciente: cuántos hay en cada punto y cuánto suman los autorizados. */
export function summarize(items: readonly SummaryInput[], total: number): DocumentSummary {
  const byTone: Record<Tone, number> = { success: 0, progress: 0, warning: 0, danger: 0 };
  const authorized: string[] = [];
  for (const item of items) {
    const tone = describeState(item.state).tone;
    byTone[tone] += 1;
    if (item.state === "AUTHORIZED" && item.total) {
      authorized.push(item.total);
    }
  }
  return { count: items.length, total, byTone, authorizedAmount: sumAmounts(authorized) };
}
