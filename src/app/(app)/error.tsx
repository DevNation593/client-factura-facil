"use client";

import Link from "next/link";

/**
 * Lo que se ve cuando una pantalla falla al dibujarse. Sin detalles técnicos: qué pasó, cómo seguir
 * y dónde está el trabajo sin enviar.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert">
      <div className="sheet-head">
        <h1>No se pudo mostrar esta pantalla</h1>
      </div>
      <p className="lead">
        Algo falló al preparar esta pantalla. Sus datos no se han perdido: lo ya emitido está en los comprobantes y lo que estaba escribiendo,
        en los borradores.
      </p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Reintentar
        </button>
        <Link href="/documents">Ir a los comprobantes</Link>
        <Link href="/invoices/drafts">Ver borradores</Link>
      </div>
      {error.digest ? <p className="field-hint">Si vuelve a ocurrir, indique este código a soporte: {error.digest}</p> : null}
    </div>
  );
}
