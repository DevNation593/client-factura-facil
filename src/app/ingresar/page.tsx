import { loginUrl } from "@/lib/sessionNavigation";

const ERRORS: Record<string, string> = {
  proveedor: "No se pudo completar el inicio de sesión con el proveedor de identidad. Inténtelo de nuevo.",
  sesion: "El inicio de sesión caducó antes de terminar. Inténtelo de nuevo.",
  expirada: "Su sesión terminó. Inicie sesión de nuevo para continuar donde estaba.",
};

/** Puerta de entrada. El inicio de sesión lo hace el proveedor de identidad; aquí no se piden credenciales. */
export default async function IngresarPage({ searchParams }: { searchParams: Promise<{ error?: string; volver?: string }> }) {
  const { error, volver } = await searchParams;
  const message = error ? ERRORS[error] : undefined;
  // A dónde volver lo valida el servidor al iniciar sesión: solo rutas de este sitio.
  const href = volver ? loginUrl(volver) : "/auth/login";
  return (
    <div className="gate">
      <main className="gate-card">
        <h1>Facturación electrónica</h1>
        <p className="lead">Emita sus comprobantes, sígalos ante el SRI y descargue el XML y el RIDE.</p>
        {message ? (
          <div className="notice notice-error" role="alert">
            {message}
          </div>
        ) : null}
        <p className="actions">
          {/* Navegación completa, no enlace de cliente: /auth/login responde con una redirección externa. */}
          <a className="btn btn-primary" href={href}>
            Iniciar sesión
          </a>
        </p>
      </main>
    </div>
  );
}
