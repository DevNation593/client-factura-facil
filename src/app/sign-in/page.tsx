import { AuthCard } from "@/components/AuthCard";

import { LoginForm } from "./LoginForm";

const NOTICES: Record<string, string> = {
  expirada: "Su sesión terminó. Ingrese de nuevo para continuar donde estaba.",
};

/** Puerta de entrada: correo y contraseña de la cuenta. */
export default async function IngresarPage({ searchParams }: { searchParams: Promise<{ error?: string; volver?: string }> }) {
  const { error, volver } = await searchParams;
  return (
    <AuthCard title="Ingresar" lead="Emita sus comprobantes, sígalos ante el SRI y descargue el XML y el RIDE.">
      {/* A dónde volver lo valida el servidor al ingresar: solo rutas de este sitio. */}
      <LoginForm returnTo={volver ?? null} notice={error ? (NOTICES[error] ?? null) : null} />
    </AuthCard>
  );
}
