import type { NextConfig } from "next";

// Sin telemetría, se lance como se lance: Next lee esta variable después de cargar la configuración.
process.env.NEXT_TELEMETRY_DISABLED = "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // La imagen de contenedor se construye con salida autocontenida (frontend/Dockerfile).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        // Las páginas reciben su política, con un nonce por respuesta, en src/proxy.ts. Lo que sirve
        // la API (JSON, XML, PDF) no es una página: si alguien lo abre en el navegador, no ejecuta nada.
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }],
      },
    ];
  },
};

export default nextConfig;
