import { NextResponse, type NextRequest } from "next/server";

import { login, safeReturnTo } from "@/server/authApi";
import { clientIp, NO_STORE, problemResponse, readForm, text } from "@/server/authRoute";
import { readConfig } from "@/server/config";
import { logEvent } from "@/server/log";
import { storeSession } from "@/server/sessionStore";

export const dynamic = "force-dynamic";

/** Inicia sesión con correo y contraseña: la API da los tokens y aquí quedan en la sesión cifrada. */
export async function POST(request: NextRequest) {
  const config = readConfig();
  const form = await readForm(request, config);
  if (form instanceof NextResponse) {
    return form;
  }
  const result = await login(config, text(form, "email"), text(form, "password"), clientIp(request));
  if ("problem" in result) {
    logEvent("warn", "login.failed", { reason: result.problem.errorCode });
    return problemResponse(result.problem);
  }
  await storeSession(result.ok, config);
  return NextResponse.json({ redirectTo: safeReturnTo(text(form, "volver")) }, { headers: NO_STORE });
}
