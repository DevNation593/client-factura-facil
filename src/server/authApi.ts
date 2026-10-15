import { decodeJwt } from "jose";

import type { ServerConfig } from "./config";
import type { Session } from "./session";

/**
 * Cuentas y sesiones contra la API (/api/v1/auth). Solo el servidor de la web habla con estos
 * endpoints: el navegador manda aquí correo y contraseña y recibe la sesión en cookies cifradas,
 * sin ver nunca los tokens.
 */

/** Error de la API tal como lo vuelve a contar la web: estado, código, mensaje y campos. */
export type AuthProblem = {
  status: number;
  errorCode: string;
  detail?: string;
  errors?: { field: string; message: string }[];
  /** Segundos que pide esperar la API (cabecera Retry-After). */
  retryAfter?: number;
};

export type AuthResult<T> = { ok: T } | { problem: AuthProblem };

type Tokens = { accessToken: string; expiresIn: number; refreshToken: string; refreshExpiresAt: string };

/** Solo rutas de este sitio: nunca se redirige a donde diga un parámetro externo. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return "/";
  }
  return value;
}

/** Llama a un endpoint de /api/v1/auth. Una API que no responde se cuenta como 503. */
async function call(config: ServerConfig, path: string, body: unknown, clientIp?: string | null): Promise<Response | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (clientIp) {
    // La API limita los intentos por dirección IP; sin esto todos parecerían venir de la web.
    headers["X-Forwarded-For"] = clientIp;
  }
  try {
    return await fetch(new URL(`/api/v1/auth/${path}`, config.apiBaseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.apiTimeoutMs),
      cache: "no-store",
    });
  }
  catch {
    return null;
  }
}

async function problemOf(response: Response | null): Promise<AuthProblem> {
  if (response === null) {
    return { status: 503, errorCode: "API_UNAVAILABLE", detail: "No se pudo contactar con el servidor; inténtelo en un momento" };
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  }
  catch {
    // Sin cuerpo legible: basta el estado.
  }
  const retryAfter = Number(response.headers.get("retry-after"));
  return {
    status: response.status,
    errorCode: typeof body.errorCode === "string" ? body.errorCode : "INTERNAL_ERROR",
    detail: typeof body.detail === "string" ? body.detail : undefined,
    errors: Array.isArray(body.errors) ? (body.errors as AuthProblem["errors"]) : undefined,
    retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  };
}

/** Pide algo que no devuelve datos (registro, enlaces, salida): bien o el problema. */
async function command(config: ServerConfig, path: string, body: unknown, clientIp?: string | null): Promise<AuthResult<true>> {
  const response = await call(config, path, body, clientIp);
  return response?.ok ? { ok: true } : { problem: await problemOf(response) };
}

/** Sesión a partir de los tokens: del token de acceso solo se leen el usuario y su correo (lo firmó la API). */
function sessionFrom(tokens: Tokens, startedAt: number): Session {
  const claims = decodeJwt(tokens.accessToken);
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    startedAt,
    subject: typeof claims.sub === "string" ? claims.sub : "",
    name: typeof claims.email === "string" ? claims.email : undefined,
  };
}

export async function login(config: ServerConfig, email: string, password: string, clientIp: string | null): Promise<AuthResult<Session>> {
  const response = await call(config, "login", { email, password }, clientIp);
  if (!response?.ok) {
    return { problem: await problemOf(response) };
  }
  return { ok: sessionFrom((await response.json()) as Tokens, Date.now()) };
}

export function register(config: ServerConfig, email: string, password: string): Promise<AuthResult<true>> {
  return command(config, "register", { email, password });
}

export function verifyEmail(config: ServerConfig, token: string): Promise<AuthResult<true>> {
  return command(config, "email-verification", { token });
}

export function requestPasswordReset(config: ServerConfig, email: string, clientIp: string | null): Promise<AuthResult<true>> {
  return command(config, "password-reset/request", { email }, clientIp);
}

export function resetPassword(config: ServerConfig, token: string, newPassword: string): Promise<AuthResult<true>> {
  return command(config, "password-reset", { token, newPassword });
}

/** Cierra la sesión en la API. Si no responde, la sesión local se borra igual. */
export async function logout(config: ServerConfig, session: Session | null): Promise<void> {
  if (session?.refreshToken) {
    await call(config, "logout", { refreshToken: session.refreshToken });
  }
}

/**
 * Resultado de renovar: la sesión nueva, `rejected` si la API ya no acepta el token de renovación
 * (la sesión terminó) o `unavailable` si no se pudo preguntar (la sesión sigue valiendo).
 */
export type Refreshed = { session: Session } | { failure: "rejected" | "unavailable" };

/** Cuánto se recuerda una renovación para las peticiones que aún traen las cookies anteriores. */
const RENEWED_GRACE_MS = 10_000;

/** Renovaciones en curso o recién hechas, por token de renovación. */
const renewals = new Map<string, Promise<Refreshed>>();

/**
 * Renueva el token de acceso. Las peticiones que llegan a la vez con el mismo token de renovación
 * comparten una sola renovación: la API lo cambia en cada uso y, si lo viera dos veces, cerraría la
 * sesión por sospecha de robo.
 */
export function refreshSession(config: ServerConfig, session: Session): Promise<Refreshed> {
  const refreshToken = session.refreshToken;
  if (!refreshToken) {
    return Promise.resolve({ failure: "rejected" });
  }
  const running = renewals.get(refreshToken);
  if (running) {
    return running;
  }
  const renewal = renew(config, session, refreshToken).then((result) => {
    if ("session" in result) {
      const timer = setTimeout(() => renewals.delete(refreshToken), RENEWED_GRACE_MS);
      if (typeof timer === "object") {
        timer.unref();
      }
    }
    else {
      // Un fallo no se recuerda: la siguiente petición lo intenta de nuevo.
      renewals.delete(refreshToken);
    }
    return result;
  });
  renewals.set(refreshToken, renewal);
  return renewal;
}

async function renew(config: ServerConfig, session: Session, refreshToken: string): Promise<Refreshed> {
  const response = await call(config, "refresh", { refreshToken });
  if (response?.ok) {
    try {
      return { session: sessionFrom((await response.json()) as Tokens, session.startedAt) };
    }
    catch {
      return { failure: "unavailable" };
    }
  }
  // Solo una negativa de la API termina la sesión; que no responda, o responda mal, no.
  const refused = response !== null && response.status >= 400 && response.status < 500;
  return { failure: refused ? "rejected" : "unavailable" };
}
