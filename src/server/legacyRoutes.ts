/**
 * Direcciones que tuvo la aplicación → las de ahora: primero en español y después en inglés, antes de
 * agrupar las pantallas en módulos. Siguen llegando por marcadores y por los correos de la API
 * (`/verificar-correo#token=…`, `/restablecer-contrasena#token=…`): el navegador conserva el
 * fragmento al seguir la redirección. Cada una lleva directo a su destino final, sin pasos
 * intermedios. Las más largas van primero, porque gana la primera regla que coincide.
 */
export const LEGACY_ROUTES: readonly (readonly [string, string])[] = [
  ["/documentos/notas-de-credito", "/documents/credit-notes"],
  ["/documentos/notas-de-debito", "/documents/debit-notes"],
  ["/documentos/guias-de-remision", "/documents/waybills"],
  ["/documentos/liquidaciones-de-compra", "/documents/purchase-settlements"],
  ["/documentos/retenciones", "/documents/withholdings"],
  ["/documentos/facturas", "/documents/invoices"],
  ["/documentos", "/documents"],
  ["/facturas/borradores", "/documents/invoices/drafts"],
  ["/facturas/nueva", "/documents/invoices/new"],
  ["/invoices/drafts", "/documents/invoices/drafts"],
  ["/invoices/new", "/documents/invoices/new"],
  ["/configuracion/certificado", "/settings/certificate"],
  ["/configuracion/emisor", "/settings/issuer"],
  ["/clientes", "/catalogs/customers"],
  ["/customers", "/catalogs/customers"],
  ["/productos", "/catalogs/products"],
  ["/products", "/catalogs/products"],
  ["/cuenta", "/account"],
  ["/empresas", "/settings/companies"],
  ["/companies", "/settings/companies"],
  ["/integraciones", "/settings/integrations"],
  ["/integrations", "/settings/integrations"],
  ["/ingresar", "/sign-in"],
  ["/olvide-contrasena", "/forgot-password"],
  ["/registro", "/sign-up"],
  ["/restablecer-contrasena", "/reset-password"],
  ["/verificar-correo", "/verify-email"],
];

/**
 * La emisión de notas era una sola pantalla con `?tipo=credito|debito`; ahora cada nota está en su
 * submódulo. Sin `tipo=debito` se abría la de crédito.
 */
export const LEGACY_NOTE_ROUTES: readonly string[] = ["/notas/nueva", "/notes/new"];
export const NOTE_ROUTES = { credit: "/documents/credit-notes/new", debit: "/documents/debit-notes/new" } as const;

type Redirect = {
  source: string;
  destination: string;
  permanent: false;
  has?: { type: "query"; key: string; value: string }[];
};

/** Redirecciones para next.config: la dirección vieja y lo que cuelgue de ella, con su consulta. */
export function legacyRedirects(): Redirect[] {
  const notes = LEGACY_NOTE_ROUTES.flatMap((from): Redirect[] => [
    { source: from, destination: NOTE_ROUTES.debit, permanent: false, has: [{ type: "query", key: "tipo", value: "debito" }] },
    { source: from, destination: NOTE_ROUTES.credit, permanent: false },
  ]);
  const pages = LEGACY_ROUTES.map(([from, to]): Redirect => ({ source: `${from}/:rest*`, destination: `${to}/:rest*`, permanent: false }));
  return [...notes, ...pages];
}
