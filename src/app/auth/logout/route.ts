import { NextResponse, type NextRequest } from "next/server";

import { readConfig } from "@/server/config";
import { endSessionUrl } from "@/server/oidc";
import { clearSession, readSession } from "@/server/sessionStore";

export const dynamic = "force-dynamic";

/**
 * Cierra la sesión aquí y devuelve a dónde debe ir el navegador para cerrarla también en el
 * proveedor de identidad (o a la pantalla de ingreso, si el proveedor no publica esa dirección).
 * Solo desde esta misma aplicación.
 */
export async function POST(request: NextRequest) {
  const config = readConfig();
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const sameOrigin = (origin === null || origin === config.appBaseUrl.origin) && (site === null || site === "same-origin");
  if (!sameOrigin || (origin === null && site === null)) {
    return NextResponse.json({ status: 403, errorCode: "FORBIDDEN", correlationId: crypto.randomUUID() }, { status: 403 });
  }
  const session = await readSession(config);
  await clearSession();
  const destination = (await endSessionUrl(config, session)) ?? new URL("/ingresar", config.appBaseUrl);
  return NextResponse.json({ redirectTo: destination.toString() }, { headers: { "Cache-Control": "no-store" } });
}
