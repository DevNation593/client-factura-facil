import * as oidc from "openid-client";

import type { ServerConfig } from "./config";
import type { Session } from "./session";

/** Lo que hay que recordar entre el envío al proveedor y su vuelta, en una cookie cifrada de corta vida. */
export type PendingLogin = {
  codeVerifier: string;
  state: string;
  nonce: string;
  returnTo: string;
};

let discovered: Promise<oidc.Configuration> | undefined;

/** Metadatos del proveedor OIDC, descubiertos una vez por proceso. */
function provider(config: ServerConfig): Promise<oidc.Configuration> {
  discovered ??= discover(config).catch((error) => {
    // Un fallo (proveedor caído al arrancar) no debe quedar memorizado.
    discovered = undefined;
    throw error;
  });
  return discovered;
}

function discover(config: ServerConfig): Promise<oidc.Configuration> {
  // config.ts solo admite http en localhost; el cliente exige declararlo de forma explícita.
  const options = config.oidcIssuer.protocol === "http:" ? { execute: [oidc.allowInsecureRequests] } : undefined;
  if (config.oidcClientSecret) {
    return oidc.discovery(config.oidcIssuer, config.oidcClientId, config.oidcClientSecret, undefined, options);
  }
  return oidc.discovery(config.oidcIssuer, config.oidcClientId, undefined, oidc.None(), options);
}

function redirectUri(config: ServerConfig): string {
  return new URL("/auth/callback", config.appBaseUrl).toString();
}

/** Solo rutas de este sitio: nunca se redirige a donde diga un parámetro externo. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return "/";
  }
  return value;
}

/** Prepara el envío al proveedor: código de autorización con PKCE, state y nonce. */
export async function beginLogin(config: ServerConfig, returnTo: string | null): Promise<{ url: URL; pending: PendingLogin }> {
  const configuration = await provider(config);
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const parameters: Record<string, string> = {
    redirect_uri: redirectUri(config),
    scope: config.oidcScope,
    code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: "S256",
    state,
    nonce,
  };
  if (config.oidcAudience) {
    parameters.audience = config.oidcAudience;
  }
  return {
    url: oidc.buildAuthorizationUrl(configuration, parameters),
    pending: { codeVerifier, state, nonce, returnTo: safeReturnTo(returnTo) },
  };
}

/** Canjea el código de la vuelta del proveedor por los tokens y arma la sesión. */
export async function completeLogin(config: ServerConfig, callbackUrl: URL, pending: PendingLogin): Promise<Session> {
  const configuration = await provider(config);
  const tokens = await oidc.authorizationCodeGrant(configuration, callbackUrl, {
    pkceCodeVerifier: pending.codeVerifier,
    expectedState: pending.state,
    expectedNonce: pending.nonce,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims) {
    throw new Error("El proveedor no devolvió un token de identidad");
  }
  const now = Date.now();
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    expiresAt: now + (tokens.expiresIn() ?? 60) * 1000,
    startedAt: now,
    subject: claims.sub,
    name: typeof claims.name === "string" ? claims.name : typeof claims.preferred_username === "string" ? claims.preferred_username : undefined,
  };
}

/**
 * Resultado de renovar: la sesión nueva, `rejected` si el proveedor ya no acepta el token de
 * refresco (la sesión terminó) o `unavailable` si no se pudo preguntar (la sesión sigue valiendo).
 */
export type Refreshed = { session: Session } | { failure: "rejected" | "unavailable" };

/** Cuánto se recuerda una renovación para las peticiones que aún traen las cookies anteriores. */
const RENEWED_GRACE_MS = 10_000;

/** Renovaciones en curso o recién hechas, por token de refresco. */
const renewals = new Map<string, Promise<Refreshed>>();

/**
 * Renueva el token de acceso. Las peticiones que llegan a la vez con el mismo token de refresco
 * comparten una sola renovación: un proveedor que lo rota rechazaría el segundo uso.
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
  try {
    const tokens = await oidc.refreshTokenGrant(await provider(config), refreshToken);
    return {
      session: {
        ...session,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? refreshToken,
        idToken: tokens.id_token ?? session.idToken,
        expiresAt: Date.now() + (tokens.expiresIn() ?? 60) * 1000,
      },
    };
  }
  catch (error) {
    // Solo una negativa del proveedor termina la sesión; que no responda, o responda mal, no.
    const refused = error instanceof oidc.ResponseBodyError && error.status >= 400 && error.status < 500;
    return { failure: refused ? "rejected" : "unavailable" };
  }
}

/**
 * Dirección de cierre de sesión del proveedor, si la publica. Con el token de identidad de la
 * sesión el proveedor sabe cuál cerrar y no necesita preguntárselo al usuario.
 */
export async function endSessionUrl(config: ServerConfig, session: Session | null): Promise<URL | null> {
  try {
    const configuration = await provider(config);
    if (!configuration.serverMetadata().end_session_endpoint) {
      return null;
    }
    const parameters: Record<string, string> = {
      client_id: config.oidcClientId,
      post_logout_redirect_uri: new URL("/ingresar", config.appBaseUrl).toString(),
    };
    if (session?.idToken) {
      parameters.id_token_hint = session.idToken;
    }
    return oidc.buildEndSessionUrl(configuration, parameters);
  }
  catch {
    return null;
  }
}
