import { redirect } from "next/navigation";

/** La portada es el monitor de comprobantes; quien no tenga sesión acaba en la pantalla de ingreso. */
export default function Home() {
  redirect("/documentos");
}
