import { vi } from "vitest";

/** Lo que una prueba ve de cada llamada a la API. */
export type RecordedCall = {
  method: string;
  /** Ruta después de /api/backend, sin la consulta. */
  path: string;
  query: URLSearchParams;
  headers: Headers;
  body: unknown;
};

type Handler = (call: RecordedCall) => Response | Promise<Response>;

/** Respuesta JSON de la API. */
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Respuesta de error con el formato problem+json de la API. */
export function problem(status: number, errorCode: string, detail?: string, errors?: { field: string; message: string }[]): Response {
  return new Response(JSON.stringify({ status, errorCode, detail, correlationId: "prueba", errors }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

/**
 * Sustituye fetch por una API simulada. Las rutas son "MÉTODO /ruta" (la ruta que sigue a
 * /api/backend, con `:id` para un segmento cualquiera). Una llamada sin ruta definida hace fallar
 * la prueba: así no pasa inadvertida una petición que no se esperaba.
 */
export function stubApi(routes: Record<string, Handler>) {
  const calls: RecordedCall[] = [];
  const compiled = Object.entries(routes).map(([key, handler]) => {
    const [method, pattern] = key.split(" ") as [string, string];
    const regex = new RegExp("^" + pattern.replace(/:[A-Za-z]+/g, "[^/]+") + "$");
    return { method, regex, handler };
  });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    // Como el navegador, una dirección relativa se resuelve contra la de la página.
    const request = input instanceof Request ? input : new Request(new URL(String(input), window.location.origin), init);
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/backend/, "");
    const text = request.method === "GET" ? "" : await request.text();
    let body: unknown = undefined;
    if (text) {
      try {
        body = JSON.parse(text);
      }
      catch {
        body = text;
      }
    }
    const call: RecordedCall = { method: request.method, path, query: url.searchParams, headers: request.headers, body };
    calls.push(call);
    const route = compiled.find((candidate) => candidate.method === request.method && candidate.regex.test(path));
    if (!route) {
      throw new Error(`Llamada no prevista en la prueba: ${request.method} ${path}`);
    }
    return route.handler(call);
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    /** Llamadas hechas a una ruta concreta. */
    to(method: string, path: string): RecordedCall[] {
      return calls.filter((call) => call.method === method && call.path === path);
    },
  };
}
