import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Facturación electrónica",
  description: "Emisión de comprobantes electrónicos para el SRI",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Leer la petición hace que cada página se genere al pedirla: es lo que permite que sus scripts
  // lleven el nonce de la política de contenido de esa respuesta (src/proxy.ts).
  await headers();
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
