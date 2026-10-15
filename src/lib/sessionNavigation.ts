/** Pantalla de ingreso que vuelve después a la ruta indicada (el servidor valida que sea de este sitio). */
export function loginUrl(returnTo: string): string {
  return `/ingresar?volver=${encodeURIComponent(returnTo)}`;
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

  /** Navegación completa a la dirección indicada (tras ingresar o salir, todo se vuelve a cargar). */
  leave(url: string): void {
    window.location.assign(url);
  },
};

/** Pantalla de ingreso que, tras iniciar sesión, vuelve a la dirección pedida (si era alguna en particular). */
export function signInPath(returnTo: string | null | undefined): string {
  return returnTo && returnTo !== "/" ? `/ingresar?volver=${encodeURIComponent(returnTo)}` : "/ingresar";
}
