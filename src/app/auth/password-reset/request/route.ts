import { NextResponse, type NextRequest } from "next/server";

import { requestPasswordReset } from "@/server/authApi";
import { clientIp, NO_STORE, problemResponse, readForm, text } from "@/server/authRoute";
import { readConfig } from "@/server/config";

export const dynamic = "force-dynamic";

/** Pide el enlace para cambiar la contraseña. Responde igual tenga o no cuenta ese correo. */
export async function POST(request: NextRequest) {
  const config = readConfig();
  const form = await readForm(request, config);
  if (form instanceof NextResponse) {
    return form;
  }
  const result = await requestPasswordReset(config, text(form, "email"), clientIp(request));
  return "problem" in result ? problemResponse(result.problem) : NextResponse.json({}, { status: 202, headers: NO_STORE });
}
