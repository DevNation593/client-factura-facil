"use client";

/**
 * Último recurso: falló incluso el marco de la aplicación. Sustituye a la página entera, así que
 * trae su propio documento y no depende de estilos ni de componentes que pudieron ser la causa.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <main role="alert">
          <h1>La aplicación no pudo cargarse</h1>
          <p>Vuelva a intentarlo. Si el problema continúa, cierre la pestaña y abra la aplicación de nuevo.</p>
          <p>
            <button type="button" onClick={reset}>
              Reintentar
            </button>
          </p>
          {error.digest ? <p>Código para soporte: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
