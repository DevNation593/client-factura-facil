/**
 * Lo que se ve mientras llega una lista o una ficha: su forma, sin datos. Un lector de pantalla oye
 * "Cargando…", que es también lo que esperan las pruebas antes de mirar una pantalla.
 */
export function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="skeleton panel" aria-busy="true">
      <span className="sr-only" role="status">
        Cargando…
      </span>
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="skeleton-line" aria-hidden="true" />
      ))}
    </div>
  );
}
