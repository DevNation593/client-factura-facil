import { redirect } from "next/navigation";

/** "Comprobantes" se divide en un listado por tipo; sin tipo se abre el de facturas. */
export default function DocumentosPage() {
  redirect("/documentos/facturas");
}
