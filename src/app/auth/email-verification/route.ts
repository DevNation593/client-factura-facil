import { NextResponse, type NextRequest } from "next/server";

import { verifyEmail } from "@/server/authApi";
import { NO_STORE, problemResponse, readForm, text } from "@/server/authRoute";
import { readConfig } from "@/server/config";

export const dynamic = "force-dynamic";

/** Confirma el correo con el código del enlace que llegó. */
export async function POST(request: NextRequest) {
  const config = readConfig();
  const form = await readForm(request, config);
  if (form instanceof NextResponse) {
    return form;
  }
  const result = await verifyEmail(config, text(form, "token"));
  return "problem" in result ? problemResponse(result.problem) : NextResponse.json({}, { headers: NO_STORE });
}
