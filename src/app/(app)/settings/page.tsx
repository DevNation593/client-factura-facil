import { redirect } from "next/navigation";

import { moduleHome } from "@/lib/modules";

/** "Configuración" a secas abre su primer submódulo. */
export default function ModulePage() {
  redirect(moduleHome("/settings"));
}
