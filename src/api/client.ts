import createClient from "openapi-fetch";

import { pinnedTenant } from "@/lib/tenant";

import { toApiError } from "./problem";
import type { paths } from "./schema";

/**
 * Cliente tipado de la API, generado a partir de contracts/openapi.yaml. Todas las llamadas van al
 * proxy del propio sitio (/api/backend), que añade las credenciales en el servidor: el navegador
 * nunca maneja el token. La cabecera X-Requested-With es la marca que el proxy exige a las
 * peticiones que cambian datos.
 */
/** Evento del navegador con el que el cliente avisa de que se perdió el acceso a la empresa activa. */
export const TENANT_FORBIDDEN_EVENT = "einvoice:tenant-forbidden";

export const api = createClient<paths>({
  baseUrl: (typeof window === "undefined" ? "" : window.location.origin) + "/api/backend",
  headers: { "X-Requested-With": "einvoice-web" },
  // Se resuelve en cada llamada, no al cargar el módulo: así las pruebas pueden sustituir fetch.
  fetch: (request) => globalThis.fetch(request),
});

// Cada petición nombra la empresa con la que trabaja esta pestaña.
api.use({
  onRequest({ request }) {
    const tenantId = pinnedTenant();
    if (tenantId !== null) {
      request.headers.set("X-Tenant-Id", tenantId);
    }
    return request;
  },
});

// La API ya no deja trabajar con la empresa activa (retiraron al usuario, o la empresa se suspendió):
// se avisa a quien lleva la empresa activa, que es quien sabe qué hacer.
api.use({
  async onResponse({ response }) {
    if (response.status === 403 && typeof window !== "undefined") {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      if (body !== null && typeof body === "object" && (body as { errorCode?: unknown }).errorCode === "TENANT_FORBIDDEN") {
        window.dispatchEvent(new Event(TENANT_FORBIDDEN_EVENT));
      }
    }
    return response;
  },
});

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Devuelve el cuerpo de una respuesta correcta o lanza un ApiError con el problema de la API. */
export async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok) {
    throw toApiError(response, error);
  }
  return data as T;
}
