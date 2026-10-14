import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { signInPath } from "@/lib/sessionNavigation";
import { readConfig } from "@/server/config";
import { readSession } from "@/server/sessionStore";

export const dynamic = "force-dynamic";

/** Todo lo que cuelga de aquí exige sesión: sin ella se va a la pantalla de ingreso. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await readSession(readConfig());
  if (session === null) {
    // Con la dirección pedida (la pone src/proxy.ts): un enlace de invitación sobrevive al inicio de sesión.
    redirect(signInPath((await headers()).get("x-return-to")));
  }
  return <AppShell userName={session.name ?? null}>{children}</AppShell>;
}
