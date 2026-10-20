import { NextResponse, type NextRequest } from "next/server";

import type { AuthProblem } from "./authApi";
import type { ServerConfig } from "./config";
import { isSameOriginRequest } from "./proxy";

/** Lo más que se lee del cuerpo de un formulario de cuenta: correo, contraseña y poco más. */
const MAX_BODY_CHARS = 8 * 1024;

/** Más largo que cualquier IPv6 escrita: lo que lo supere no es una dirección. */
const MAX_IP_CHARS = 64;

/** Respuesta de error con el mismo formato problem+json que la API. */
export function problemResponse(problem: AuthProblem): NextResponse {
  const headers: Record<string, string> = { "Content-Type": "application/problem+json", "Cache-Control": "no-store" };
  if (problem.retryAfter) {
    headers["Retry-After"] = String(problem.retryAfter);
  }
  return NextResponse.json(
    { status: problem.status, errorCode: problem.errorCode, detail: problem.detail, errors: problem.errors, correlationId: crypto.randomUUID() },
    { status: problem.status, headers },
  );
}

/**
 * Lee el cuerpo JSON de un formulario de cuenta, solo si viene de esta misma aplicación (contra
 * CSRF). Devuelve la respuesta de rechazo si no se admite.
 */
export async function readForm(request: NextRequest, config: ServerConfig): Promise<Record<string, unknown> | NextResponse> {
  if (!isSameOriginRequest(request.headers, config)) {
    return problemResponse({ status: 403, errorCode: "FORBIDDEN", detail: "Petición no admitida" });
  }
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) {
    return problemResponse({ status: 413, errorCode: "MALFORMED_REQUEST", detail: "La petición es demasiado grande" });
  }
  try {
    const body: unknown = JSON.parse(text);
    if (body !== null && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  }
  catch {
    // Cae al rechazo de abajo.
  }
  return problemResponse({ status: 400, errorCode: "MALFORMED_REQUEST", detail: "La petición no es válida" });
}

/** Un campo de texto del formulario, o vacío si no viene o no es texto. */
export function text(form: Record<string, unknown>, name: string): string {
  const value = form[name];
  return typeof value === "string" ? value : "";
}

/**
 * Dirección IP del navegador, que la API usa para limitar intentos. Cada proxy de confianza añade su
 * entrada al final de X-Forwarded-For (el frente de Google lo hace así en Cloud Run) y lo de la
 * izquierda lo escribe el navegador: vale la entrada en la posición `TRUSTED_PROXY_HOPS` contando
 * desde la derecha. Con menos entradas, todas las puso un proxy de confianza y vale la primera.
 */
export function clientIp(request: NextRequest, config: ServerConfig): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded?.trim()) {
    const entries = forwarded.split(",").map((entry) => entry.trim());
    const entry = entries[Math.max(0, entries.length - config.trustedProxyHops)];
    return entry && entry.length <= MAX_IP_CHARS ? entry : null;
  }
  return request.headers.get("x-real-ip")?.trim().slice(0, MAX_IP_CHARS) || null;
}

export const NO_STORE = { "Cache-Control": "no-store" };
