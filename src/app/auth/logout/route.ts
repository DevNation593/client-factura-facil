import { NextResponse, type NextRequest } from "next/server";

import { logout } from "@/server/authApi";
import { NO_STORE, problemResponse } from "@/server/authRoute";
import { readConfig } from "@/server/config";
import { isSameOriginRequest } from "@/server/proxy";
import { clearSession, readSession } from "@/server/sessionStore";

export const dynamic = "force-dynamic";

/** Cierra la sesión en la API y aquí, y dice a dónde ir después. Solo desde esta misma aplicación. */
export async function POST(request: NextRequest) {
  const config = readConfig();
  if (!isSameOriginRequest(request.headers, config)) {
    return problemResponse({ status: 403, errorCode: "FORBIDDEN", detail: "Petición no admitida" });
  }
  const session = await readSession(config);
  await logout(config, session);
  await clearSession();
  return NextResponse.json({ redirectTo: "/sign-in" }, { headers: NO_STORE });
}
