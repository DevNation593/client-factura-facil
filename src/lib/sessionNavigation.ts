/** Dirección que inicia sesión y vuelve después a la ruta indicada (el servidor valida que sea de este sitio). */
export function loginUrl(returnTo: string): string {
  return `/auth/login?volver=${encodeURIComponent(returnTo)}`;
}

/**
 * Navegación fuera de la aplicación cuando la sesión ya no sirve. Es un objeto para que las pruebas
 * puedan sustituirla: una navegación completa no existe en el entorno de pruebas.
 */
export const sessionNavigation = {
  /** Lleva a la pantalla de ingreso, avisando de que la sesión terminó, para volver luego a `returnTo`. */
  toLogin(returnTo: string): void {
    // Navegación completa a propósito: sin sesión, todo lo que la página tenía cargado debe descartarse.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/ingresar?error=expirada&volver=${encodeURIComponent(returnTo)}`);
  },

  /** Sale de la aplicación hacia la dirección indicada (el cierre de sesión del proveedor, o el ingreso). */
  leave(url: string): void {
    window.location.assign(url);
  },
};

/** Pantalla de ingreso que, tras iniciar sesión, vuelve a la dirección pedida (si era alguna en particular). */
export function signInPath(returnTo: string | null | undefined): string {
  return returnTo && returnTo !== "/" ? `/ingresar?volver=${encodeURIComponent(returnTo)}` : "/ingresar";
}
