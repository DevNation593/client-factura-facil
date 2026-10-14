import { cookies } from "next/headers";

import type { ServerConfig } from "./config";
import { logEvent } from "./log";
import { refreshSession } from "./oidc";
import { MAX_SESSION_AGE_MS, open, openSession, readChunks, seal, sealSession, SESSION_COOKIE, type Session } from "./session";

/** Cookie cifrada, de diez minutos, con los datos del inicio de sesión en curso. */
const LOGIN_COOKIE = "einvoice_login";

/** Empresa activa: no es un secreto, pero tampoco hace falta que la página la lea por JavaScript ajeno. */
export const TENANT_COOKIE = "einvoice_tenant";

/** Margen con el que se renueva el token antes de que caduque. */
const REFRESH_MARGIN_MS = 30_000;

const MAX_CHUNKS = 20;

type Jar = Awaited<ReturnType<typeof cookies>>;

function options(config: ServerConfig, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.secureCookies,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

function writeChunks(jar: Jar, name: string, chunks: string[], config: ServerConfig, maxAgeSeconds: number) {
  chunks.forEach((chunk, index) => jar.set(`${name}.${index}`, chunk, options(config, maxAgeSeconds)));
  // Trozos sobrantes de una sesión anterior más larga.
  for (let index = chunks.length; index < MAX_CHUNKS; index++) {
    if (jar.get(`${name}.${index}`)) {
      jar.delete(`${name}.${index}`);
    }
  }
}

/** Sesión actual, sin renovarla. Sirve también donde no se pueden escribir cookies (páginas). */
export async function readSession(config: ServerConfig): Promise<Session | null> {
  const jar = await cookies();
  return openSession(readChunks(SESSION_COOKIE, (name) => jar.get(name)?.value), config.sessionSecret);
}

export async function storeSession(session: Session, config: ServerConfig): Promise<void> {
  const remaining = Math.max(1, Math.floor((session.startedAt + MAX_SESSION_AGE_MS - Date.now()) / 1000));
  writeChunks(await cookies(), SESSION_COOKIE, await sealSession(session, config.sessionSecret), config, remaining);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  for (let index = 0; index < MAX_CHUNKS; index++) {
    if (jar.get(`${SESSION_COOKIE}.${index}`)) {
      jar.delete(`${SESSION_COOKIE}.${index}`);
    }
  }
}

/**
 * Sesión lista para llamar a la API: si el token está por caducar lo renueva y guarda la sesión
 * nueva. Nula si no hay sesión o el proveedor ya no la renueva; `unavailable` si el token caducó y
 * ahora mismo no se puede renovar (la sesión se conserva). Solo para manejadores de ruta.
 */
export async function usableSession(config: ServerConfig): Promise<Session | null | "unavailable"> {
  const session = await readSession(config);
  if (session === null) {
    return null;
  }
  if (session.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return session;
  }
  const renewed = await refreshSession(config, session);
  if ("session" in renewed) {
    await storeSession(renewed.session, config);
    return renewed.session;
  }
  if (renewed.failure === "rejected") {
    logEvent("info", "session.refresh.rejected");
    await clearSession();
    return null;
  }
  // El proveedor no respondió. Mientras el token siga vigente se usa; después, se espera.
  const stillValid = session.expiresAt > Date.now();
  // El nombre del campo no lleva "token": el registro descarta todo campo que lo parezca.
  logEvent("warn", "session.refresh.unavailable", { accessStillValid: stillValid });
  return stillValid ? session : "unavailable";
}

export async function storePendingLogin(pending: unknown, config: ServerConfig): Promise<void> {
  writeChunks(await cookies(), LOGIN_COOKIE, await seal(pending, config.sessionSecret), config, 600);
}

/** Lee y borra los datos del inicio de sesión en curso: solo valen una vez. */
export async function takePendingLogin(config: ServerConfig): Promise<unknown | null> {
  const jar = await cookies();
  const chunks = readChunks(LOGIN_COOKIE, (name) => jar.get(name)?.value);
  for (let index = 0; index < MAX_CHUNKS; index++) {
    if (jar.get(`${LOGIN_COOKIE}.${index}`)) {
      jar.delete(`${LOGIN_COOKIE}.${index}`);
    }
  }
  return open(chunks, config.sessionSecret);
}

export async function activeTenant(): Promise<string | null> {
  return (await cookies()).get(TENANT_COOKIE)?.value ?? null;
}
