import { NextResponse, type NextRequest } from "next/server";

import { readConfig } from "@/server/config";
import { logEvent } from "@/server/log";
import { beginLogin } from "@/server/oidc";
import { storePendingLogin } from "@/server/sessionStore";

export const dynamic = "force-dynamic";

/** Inicia sesión: guarda lo necesario para validar la vuelta y envía al proveedor OIDC. */
export async function GET(request: NextRequest) {
  const config = readConfig();
  try {
    const { url, pending } = await beginLogin(config, request.nextUrl.searchParams.get("volver"));
    await storePendingLogin(pending, config);
    return NextResponse.redirect(url);
  }
  catch (error) {
    // El proveedor de identidad no responde o su configuración no es la esperada: nadie puede entrar.
    logEvent("error", "login.failed", { reason: "provider-unreachable", error: error instanceof Error ? error.name : "desconocido" });
    return NextResponse.redirect(new URL("/ingresar?error=proveedor", config.appBaseUrl));
  }
}
