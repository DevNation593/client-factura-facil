import { NextResponse, type NextRequest } from "next/server";

import { readConfig } from "@/server/config";
import { logEvent } from "@/server/log";
import { completeLogin, safeReturnTo, type PendingLogin } from "@/server/oidc";
import { storeSession, takePendingLogin } from "@/server/sessionStore";

export const dynamic = "force-dynamic";

function isPendingLogin(value: unknown): value is PendingLogin {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return ["codeVerifier", "state", "nonce", "returnTo"].every((field) => typeof candidate[field] === "string");
}

/** Vuelta del proveedor OIDC: valida state, nonce y PKCE, canjea el código y abre la sesión. */
export async function GET(request: NextRequest) {
  const config = readConfig();
  const pending = await takePendingLogin(config);
  if (!isPendingLogin(pending)) {
    // Sin el inicio de sesión en curso (cookie caducada, otro navegador, vuelta repetida).
    logEvent("warn", "login.failed", { reason: "no-pending-login" });
    return NextResponse.redirect(new URL("/ingresar?error=sesion", config.appBaseUrl));
  }
  try {
    // La dirección se arma con la base pública configurada, que es la que el proveedor conoce.
    const callbackUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, config.appBaseUrl);
    await storeSession(await completeLogin(config, callbackUrl, pending), config);
    return NextResponse.redirect(new URL(safeReturnTo(pending.returnTo), config.appBaseUrl));
  }
  catch (error) {
    // El proveedor rechazó el canje, o el state, el nonce o el token de identidad no eran los esperados.
    logEvent("warn", "login.failed", { reason: "exchange", error: error instanceof Error ? error.name : "desconocido" });
    return NextResponse.redirect(new URL("/ingresar?error=proveedor", config.appBaseUrl));
  }
}
