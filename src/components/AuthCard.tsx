import type { ReactNode } from "react";

/** Tarjeta de las pantallas sin sesión: ingresar, registrarse, confirmar el correo, recuperar la contraseña. */
export function AuthCard({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="gate">
      <main className="gate-card">
        <p className="gate-brand">Facturación electrónica</p>
        <h1>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
        {children}
      </main>
    </div>
  );
}
