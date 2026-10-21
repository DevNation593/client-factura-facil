/**
 * Direcciones en español que tuvo la aplicación → las de ahora. Siguen llegando por marcadores y,
 * sobre todo, por los correos de la API (`/verificar-correo#token=…`, `/restablecer-contrasena#token=…`):
 * el navegador conserva el fragmento al seguir la redirección. Las más largas van primero, porque
 * gana la primera regla que coincide.
 */
export const LEGACY_ROUTES: readonly (readonly [string, string])[] = [
  ["/documentos/notas-de-credito", "/documents/credit-notes"],
  ["/documentos/notas-de-debito", "/documents/debit-notes"],
  ["/documentos/guias-de-remision", "/documents/waybills"],
  ["/documentos/liquidaciones-de-compra", "/documents/purchase-settlements"],
  ["/documentos/retenciones", "/documents/withholdings"],
  ["/documentos/facturas", "/documents/invoices"],
  ["/documentos", "/documents"],
  ["/facturas/borradores", "/invoices/drafts"],
  ["/facturas/nueva", "/invoices/new"],
  ["/notas/nueva", "/notes/new"],
  ["/configuracion/certificado", "/settings/certificate"],
  ["/configuracion/emisor", "/settings/issuer"],
  ["/clientes", "/customers"],
  ["/productos", "/products"],
  ["/cuenta", "/account"],
  ["/empresas", "/companies"],
  ["/integraciones", "/integrations"],
  ["/ingresar", "/sign-in"],
  ["/olvide-contrasena", "/forgot-password"],
  ["/registro", "/sign-up"],
  ["/restablecer-contrasena", "/reset-password"],
  ["/verificar-correo", "/verify-email"],
];

/** Redirecciones para next.config: la dirección vieja y lo que cuelgue de ella, con su consulta. */
export function legacyRedirects(): { source: string; destination: string; permanent: false }[] {
  return LEGACY_ROUTES.map(([from, to]) => ({ source: `${from}/:rest*`, destination: `${to}/:rest*`, permanent: false }));
}
