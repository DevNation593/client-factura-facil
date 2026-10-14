import { NextResponse, type NextRequest } from "next/server";

import { buildCsp, newNonce } from "@/server/csp";

/**
 * Antes de servir cada página: una política de contenido con un nonce nuevo. Next lee esa política
 * de la petición y marca con el nonce los scripts que él mismo genera; cualquier otro script que
 * aparezca en la página no lo lleva y el navegador no lo ejecuta.
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const policy = buildCsp({
    nonce,
    development: process.env.NODE_ENV === "development",
    secure: (process.env.APP_BASE_URL ?? "").startsWith("https://"),
  });

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  // Para que, sin sesión, se pueda volver aquí tras iniciarla. Lo fija el servidor: lo que el
  // navegador mande en esta cabecera se sobrescribe.
  headers.set("x-return-to", request.nextUrl.pathname + request.nextUrl.search);
  headers.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Páginas y rutas de sesión; no la API, ni los archivos estáticos, ni las precargas de enlaces.
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
