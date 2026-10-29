"use client";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { documentSubmodule } from "@/lib/documentTypes";
import { summarize, TONE_ORDER } from "@/lib/documentSummary";
import { useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";
import { usePolling } from "@/lib/usePolling";

type DocumentTypeCode = components["schemas"]["DocumentTypeCode"];

/** Cuántos comprobantes recientes entran en el resumen: la API no da totales, se cuentan de una página. */
export const SUMMARY_SIZE = 100;

const TILES = [
  { tone: "success", label: "Autorizadas" },
  { tone: "progress", label: "En proceso" },
] as const;

/** Separación entre tramos, en las unidades de la barra (100 de ancho). */
const GAP = 0.6;

/**
 * La mezcla de estados como una barra: un tramo por estado, ancho según cuántos comprobantes hay en
 * él. Es SVG y no estilos en línea: la política de contenido no deja aplicar atributos `style`.
 */
function MixBar({ byTone, count }: { byTone: Record<(typeof TONE_ORDER)[number], number>; count: number }) {
  const tones = TONE_ORDER.filter((tone) => byTone[tone] > 0);
  const usable = 100 - GAP * (tones.length - 1);
  const widths = tones.map((tone) => (byTone[tone] / count) * usable);
  return (
    <svg className="summary-bar" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {tones.map((tone, index) => (
        <rect
          key={tone}
          className={`tramo-${tone}`}
          x={widths.slice(0, index).reduce((sum, width) => sum + width + GAP, 0)}
          y={0}
          width={widths[index]}
          height={10}
        />
      ))}
    </svg>
  );
}

/**
 * Resumen de un tipo de comprobante sobre su lista: cuántos autorizó el SRI, cuántos siguen en camino,
 * cuántos piden atención y cuánto suman los autorizados, con una barra de la mezcla de estados. Se
 * calcula con los últimos comprobantes y lo dice. Nada mientras carga o si aún no hay ninguno.
 */
export function DocumentSummary({ type }: { type: DocumentTypeCode }) {
  const { active } = useTenant();
  const section = documentSubmodule(type);
  const recent = useApi(
    () => unwrap(api.GET("/documents", { params: { query: { page: 0, size: SUMMARY_SIZE, documentType: type } } })),
    [active?.id, type],
  );
  const summary = recent.data ? summarize(recent.data.items, recent.data.total) : undefined;
  usePolling(() => void recent.reload({ quiet: true }), (summary?.byTone.progress ?? 0) > 0);

  if (!summary || summary.count === 0) {
    return null;
  }
  const noun = section.title.toLowerCase();
  const attention = summary.byTone.warning + summary.byTone.danger;
  return (
    <section className="summary-section" aria-label={`Resumen de ${noun}`}>
      <dl className="summary">
        {TILES.map((tile) => (
          <div key={tile.tone} className="summary-tile">
            <dt>
              <span className={`state state-${tile.tone}`}>{tile.label}</span>
            </dt>
            <dd>{summary.byTone[tile.tone]}</dd>
          </div>
        ))}
        <div className="summary-tile">
          <dt>
            <span className="state state-danger">Requieren atención</span>
          </dt>
          <dd>{attention}</dd>
        </div>
        <div className="summary-tile">
          <dt>Total autorizado</dt>
          <dd>{summary.authorizedAmount === null ? "—" : `$${summary.authorizedAmount}`}</dd>
        </div>
      </dl>
      <div className="summary-mix">
        <MixBar byTone={summary.byTone} count={summary.count} />
        <p>
          {summary.total > summary.count
            ? `Calculado con las últimas ${summary.count} de ${summary.total} ${noun}.`
            : `Calculado con todas sus ${noun}.`}
        </p>
      </div>
    </section>
  );
}
