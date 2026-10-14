import { describeState } from "@/lib/documentStates";

/** Estado de un comprobante en palabras, con una marca de forma distinta por tipo: no depende solo del color. */
export function StateBadge({ state }: { state: string }) {
  const info = describeState(state);
  return <span className={`state state-${info.tone}`}>{info.label}</span>;
}

/** El estado como sello, para la hoja del comprobante. */
export function StateStamp({ state }: { state: string }) {
  const info = describeState(state);
  return <span className={`stamp state-${info.tone}`}>{info.label}</span>;
}
