import { NextResponse } from "next/server";

import { readConfig } from "@/server/config";
import { readSession } from "@/server/sessionStore";

export const dynamic = "force-dynamic";

/** Lo único de la sesión que la página puede conocer: si existe y a nombre de quién. Nunca los tokens. */
export async function GET() {
  const session = await readSession(readConfig());
  return NextResponse.json(
    session === null ? { authenticated: false } : { authenticated: true, name: session.name ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
