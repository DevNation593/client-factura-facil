/** Valor de un solo uso que marca, en cada respuesta, los scripts que la página puede ejecutar. */
export function newNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * Política de contenido de las páginas. Solo se ejecutan scripts propios marcados con el nonce de
 * esa respuesta: un script inyectado en la página no lo tiene y el navegador lo descarta. Nada se
 * carga de otros sitios.
 */
export function buildCsp(options: { nonce: string; development: boolean; secure: boolean }): string {
  const nonce = `'nonce-${options.nonce}'`;
  const directives = [
    "default-src 'self'",
    // En desarrollo React reconstruye las trazas de error con eval.
    `script-src 'self' ${nonce} 'strict-dynamic'${options.development ? " 'unsafe-eval'" : ""}`,
    // La recarga en caliente del servidor de desarrollo inserta estilos en línea sin nonce.
    `style-src 'self' ${options.development ? "'unsafe-inline'" : nonce}`,
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${options.development ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (options.secure) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}
