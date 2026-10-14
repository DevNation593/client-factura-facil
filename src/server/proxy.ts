import type { ServerConfig } from "./config";
import type { Session } from "./session";

/** Marca que el cliente de la API pone en todas sus peticiones y que el proxy exige a las que cambian datos. */
export const REQUEST_MARKER = "einvoice-web";

export type ProxyInput = {
  method: string;
  /** Segmentos de la ruta después de /api/backend, ya decodificados. */
  path: string[];
  /** Cadena de consulta con su `?`, o vacía. */
  search: string;
  headers: Headers;
  body: BodyInit | null;
  session: Session | null;
  /** Empresa de la cookie: vale para lo que el navegador pide sin cabeceras propias (descargas). */
  tenantId: string | null | undefined;
  config: ServerConfig;
};

export type ProxyOutput = { url: string; init: RequestInit } | { error: 400 | 401 | 403 | 405 };

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);

const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cabeceras de la petición del navegador que la API necesita; ninguna otra se reenvía. */
const FORWARDED_HEADERS = ["accept", "content-type", "idempotency-key"];

/**
 * Convierte una petición al proxy en la petición a la API, o la rechaza. No hace ninguna llamada:
 * decide a dónde se puede ir y con qué. El destino sale siempre de la configuración; de la
 * petición solo se toman segmentos de ruta inocuos, la consulta y unas pocas cabeceras.
 */
export function buildBackendRequest(input: ProxyInput): ProxyOutput {
  const method = input.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return { error: 405 };
  }
  if (input.path.length === 0 || input.path.some((segment) => !isSafeSegment(segment))) {
    return { error: 400 };
  }
  if (method !== "GET" && !isSameOriginRequest(input.headers, input.config)) {
    return { error: 403 };
  }
  if (input.session === null) {
    return { error: 401 };
  }

  const url = new URL(`/api/v1/${input.path.join("/")}`, input.config.apiBaseUrl);
  url.search = input.search;
  if (url.origin !== input.config.apiBaseUrl.origin || !url.pathname.startsWith("/api/v1/")) {
    return { error: 400 };
  }

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = input.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }
  headers.set("Authorization", `Bearer ${input.session.accessToken}`);
  // La cookie es de todo el navegador y otra pestaña pudo cambiarla: manda la empresa que nombra
  // la petición. Que el usuario pertenezca a ella lo comprueba la API.
  const tenantId = [input.headers.get("x-tenant-id"), input.tenantId].find((id) => typeof id === "string" && UUID.test(id));
  if (tenantId) {
    headers.set("X-Tenant-Id", tenantId);
  }

  const init: RequestInit = { method, headers, redirect: "manual", cache: "no-store" };
  if (method !== "GET" && input.body !== null) {
    init.body = input.body;
  }
  return { url: url.toString(), init };
}

function isSafeSegment(segment: string): boolean {
  return segment !== "." && segment !== ".." && SAFE_SEGMENT.test(segment);
}

/**
 * Una petición que cambia datos solo vale si la hizo esta misma aplicación: lleva la marca que un
 * formulario de otro sitio no puede añadir, y el navegador confirma el mismo origen.
 */
function isSameOriginRequest(headers: Headers, config: ServerConfig): boolean {
  if (headers.get("x-requested-with") !== REQUEST_MARKER) {
    return false;
  }
  const site = headers.get("sec-fetch-site");
  const origin = headers.get("origin");
  if (site === null && origin === null) {
    return false;
  }
  if (site !== null && site !== "same-origin") {
    return false;
  }
  if (origin !== null && origin !== config.appBaseUrl.origin) {
    return false;
  }
  return true;
}
