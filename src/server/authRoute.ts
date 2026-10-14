import { NextResponse, type NextRequest } from "next/server";

import type { AuthProblem } from "./authApi";
import type { ServerConfig } from "./config";
import { isSameOriginRequest } from "./proxy";

/** Lo más que se lee del cuerpo de un formulario de cuenta: correo, contraseña y poco más. */
const MAX_BODY_CHARS = 8 * 1024;

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
 * Dirección IP del navegador según el proxy de entrada (X-Forwarded-For). La API la usa para limitar
 * intentos; sin proxy delante, la cabecera la pone el propio navegador y no es fiable.
 */
export function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) {
    return forwarded.slice(0, 64);
  }
  return request.headers.get("x-real-ip")?.trim().slice(0, 64) || null;
}

export const NO_STORE = { "Cache-Control": "no-store" };
