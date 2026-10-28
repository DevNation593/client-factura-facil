import { redirect } from "next/navigation";

import { readConfig } from "@/server/config";
import { readSession } from "@/server/sessionStore";

import { Landing } from "./Landing";

/** Sin sesión, la portada presenta la aplicación; con sesión, se va directo a las facturas. */
export default async function Home() {
  if ((await readSession(readConfig())) !== null) {
    redirect("/documents/invoices");
  }
  return <Landing />;
}
