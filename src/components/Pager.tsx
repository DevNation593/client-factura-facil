/** Paginación de un listado. No aparece si todo cabe en una página. */
export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) {
    return null;
  }
  return (
    <nav className="pager" aria-label="Páginas">
      <button type="button" className="btn" onClick={() => onPage(page - 1)} disabled={page <= 0}>
        Anterior
      </button>
      <span>
        Página {page + 1} de {pages}
      </span>
      <button type="button" className="btn" onClick={() => onPage(page + 1)} disabled={page >= pages - 1}>
        Siguiente
      </button>
    </nav>
  );
}
