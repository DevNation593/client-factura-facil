/**
 * Configuración del servidor web. Ninguno de estos valores llega al navegador: se leen del entorno
 * solo en código de servidor.
 */
export type ServerConfig = {
  /** Dirección de la API de Spring, sin /api/v1. */
  apiBaseUrl: URL;
  /** Cuánto se espera la respuesta de la API antes de darla por caída. */
  apiTimeoutMs: number;
  /** Dirección pública de esta aplicación. */
  appBaseUrl: URL;
  sessionSecret: string;
  /** Las cookies llevan Secure cuando la aplicación se sirve por HTTPS. */
  secureCookies: boolean;
  /** Proxies de confianza que añaden su entrada a X-Forwarded-For (ver clientIp en authRoute.ts). */
  trustedProxyHops: number;
};

const MIN_SECRET_LENGTH = 32;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

function optional(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function httpUrl(env: Record<string, string | undefined>, name: string): URL {
  const value = required(env, name);
  let url: URL;
  try {
    url = new URL(value);
  }
  catch {
    throw new Error(`${name} debe ser una dirección http o https`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} debe ser una dirección http o https`);
  }
  return url;
}

function apiTimeout(env: Record<string, string | undefined>): number {
  const value = optional(env, "API_TIMEOUT_MS");
  if (value === undefined) {
    return 30_000;
  }
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error("API_TIMEOUT_MS debe ser un número entero de milisegundos mayor que cero");
  }
  return Number(value);
}

function trustedProxyHops(env: Record<string, string | undefined>): number {
  const value = optional(env, "TRUSTED_PROXY_HOPS");
  if (value === undefined) {
    return 1;
  }
  if (!/^[1-9][0-9]?$/.test(value)) {
    throw new Error("TRUSTED_PROXY_HOPS debe ser un número entero de proxies mayor que cero");
  }
  return Number(value);
}

export function readConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const sessionSecret = required(env, "SESSION_SECRET");
  if (sessionSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres aleatorios`);
  }
  const appBaseUrl = httpUrl(env, "APP_BASE_URL");
  if (appBaseUrl.protocol === "http:" && !LOCAL_HOSTS.has(appBaseUrl.hostname)) {
    // Sin TLS las cookies de sesión no llevarían Secure y viajarían en claro.
    throw new Error("APP_BASE_URL debe usar https (http solo se admite en localhost)");
  }
  return {
    apiBaseUrl: httpUrl(env, "API_BASE_URL"),
    apiTimeoutMs: apiTimeout(env),
    appBaseUrl,
    sessionSecret,
    secureCookies: appBaseUrl.protocol === "https:",
    trustedProxyHops: trustedProxyHops(env),
  };
}
