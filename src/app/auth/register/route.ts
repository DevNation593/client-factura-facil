import { NextResponse, type NextRequest } from "next/server";

import { register } from "@/server/authApi";
import { NO_STORE, problemResponse, readForm, text } from "@/server/authRoute";
import { readConfig } from "@/server/config";

export const dynamic = "force-dynamic";

/** Crea la cuenta. La respuesta no dice si el correo ya tenía una: eso lo cuenta el correo. */
export async function POST(request: NextRequest) {
  const config = readConfig();
  const form = await readForm(request, config);
  if (form instanceof NextResponse) {
    return form;
  }
  const result = await register(config, text(form, "email"), text(form, "password"));
  return "problem" in result ? problemResponse(result.problem) : NextResponse.json({}, { status: 202, headers: NO_STORE });
}
