import { NextResponse, type NextRequest } from "next/server";

import { resetPassword } from "@/server/authApi";
import { NO_STORE, problemResponse, readForm, text } from "@/server/authRoute";
import { readConfig } from "@/server/config";
import { clearSession } from "@/server/sessionStore";

export const dynamic = "force-dynamic";

/** Pone la contraseña nueva con el código del enlace. La API cierra todas las sesiones; esta también. */
export async function POST(request: NextRequest) {
  const config = readConfig();
  const form = await readForm(request, config);
  if (form instanceof NextResponse) {
    return form;
  }
  const result = await resetPassword(config, text(form, "token"), text(form, "newPassword"));
  if ("problem" in result) {
    return problemResponse(result.problem);
  }
  await clearSession();
  return NextResponse.json({}, { headers: NO_STORE });
}
