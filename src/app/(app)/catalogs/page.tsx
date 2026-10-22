import { redirect } from "next/navigation";

import { moduleHome } from "@/lib/modules";

/** "Catálogos" a secas abre su primer submódulo. */
export default function ModulePage() {
  redirect(moduleHome("/catalogs"));
}
