import { NextResponse, type NextRequest } from "next/server";

import { readUpTo } from "@/server/body";
import { readConfig } from "@/server/config";
import { logEvent } from "@/server/log";
import { buildBackendRequest } from "@/server/proxy";
import { activeTenant, clearSession, usableSession } from "@/server/sessionStore";

export const dynamic = "force-dynamic";

/** Tamaño máximo de cuerpo que se reenvía: holgado para un certificado en Base64, pequeño para todo lo demás. */
const MAX_BODY_BYTES = 1024 * 1024;

/** Cabeceras de la respuesta de la API que la página necesita. */
const RESPONSE_HEADERS = ["content-type", "etag", "content-disposition", "location", "retry-after"];

const ERROR_CODES: Record<number, string> = {
  400: "MALFORMED_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  405: "METHOD_NOT_ALLOWED",
  413: "MALFORMED_REQUEST",
  502: "INTERNAL_ERROR",
  503: "INTERNAL_ERROR",
  504: "INTERNAL_ERROR",
};

function problem(status: number, detail: string, correlationId: string = crypto.randomUUID()) {
  return NextResponse.json(
    { status, errorCode: ERROR_CODES[status] ?? "INTERNAL_ERROR", detail, correlationId },
    { status, headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" } },
  );
}

type Context = { params: Promise<{ path: string[] }> };

/**
 * Único camino del navegador a la API. Añade en el servidor el token de la sesión y la empresa
 * activa; el navegador nunca los maneja. A dónde se puede llamar lo decide buildBackendRequest.
 */
async function handle(request: NextRequest, context: Context) {
  const config = readConfig();
  const { path } = await context.params;

  const session = await usableSession(config);
  if (session === "unavailable") {
    // El proveedor de identidad no responde: la sesión se conserva y se reintenta después.
    return problem(503, "No se pudo renovar la sesión en este momento");
  }
  // Primero se decide si la petición se admite; su cuerpo solo se lee si va a reenviarse.
  const built = buildBackendRequest({
    method: request.method,
    path,
    search: request.nextUrl.search,
    headers: request.headers,
    body: null,
    session,
    tenantId: await activeTenant(),
    config,
  });
  if ("error" in built) {
    return problem(built.error, built.error === 401 ? "La sesión terminó" : "Petición no admitida");
  }
  if (request.method !== "GET") {
    if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
      return problem(413, "La petición es demasiado grande");
    }
    // Un cuerpo sin Content-Length se corta al pasar del límite, no después de recibirlo entero.
    const body = await readUpTo(request.body, MAX_BODY_BYTES);
    if (body === null) {
      return problem(413, "La petición es demasiado grande");
    }
    if (body.byteLength > 0) {
      built.init.body = body;
    }
  }

  let upstream: Response;
  // Ni una API colgada ni un navegador que ya se fue dejan la llamada abierta. El plazo es para que
  // la API empiece a responder: una vez llegan las cabeceras, el cuerpo puede tardar lo que tarde.
  const call = new AbortController();
  const gaveUp = () => call.abort(request.signal.reason);
  request.signal.addEventListener("abort", gaveUp, { once: true });
  const deadline = setTimeout(() => call.abort(new DOMException("La API no respondió a tiempo", "TimeoutError")), config.apiTimeoutMs);
  try {
    upstream = await fetch(built.url, { ...built.init, signal: call.signal });
  }
  catch (error) {
    if (request.signal.aborted) {
      // El navegador canceló: no hay a quién responder ni nada que diagnosticar.
      return new Response(null, { status: 499 });
    }
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    // El código que ve el usuario es el que queda en el log: con él se encuentra esta línea.
    const correlationId = crypto.randomUUID();
    logEvent("warn", timedOut ? "proxy.upstream.timeout" : "proxy.upstream.failed", {
      correlationId,
      method: request.method,
      path: path.join("/"),
      reason: error instanceof Error ? error.name : "desconocido",
    });
    return timedOut
      ? problem(504, "La API no respondió a tiempo", correlationId)
      : problem(502, "La API no está disponible", correlationId);
  }
  finally {
    clearTimeout(deadline);
  }
  if (upstream.status === 401) {
    // La API ya no acepta el token: la sesión no sirve.
    await clearSession();
    return problem(401, "La sesión terminó");
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
