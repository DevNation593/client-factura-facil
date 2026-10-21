"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { DOCUMENT_MODULES } from "@/lib/documentTypes";
import { ROLE_LABELS } from "@/lib/roles";
import { sessionNavigation } from "@/lib/sessionNavigation";
import { canBill, canWrite, TenantProvider, useTenant } from "@/lib/tenantContext";

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

function Rail({ userName }: { userName: string | null }) {
  const { active, tenants, loading } = useTenant();
  const [leaving, setLeaving] = useState(false);

  /**
   * Cierra la sesión (en la API y en las cookies) y después vuelve a la pantalla de ingreso con una
   * navegación completa, para que no quede nada de la sesión cargado en la página.
   */
  async function signOut() {
    if (leaving) {
      return;
    }
    setLeaving(true);
    let destination = "/ingresar";
    try {
      const response = await fetch("/auth/logout", { method: "POST", headers: { "X-Requested-With": "einvoice-web" } });
      if (response.ok) {
        const body: unknown = await response.json();
        if (body !== null && typeof body === "object" && typeof (body as { redirectTo?: unknown }).redirectTo === "string") {
          destination = (body as { redirectTo: string }).redirectTo;
        }
      }
    }
    catch {
      // Sin respuesta: se sale igualmente a la pantalla de ingreso.
    }
    sessionNavigation.leave(destination);
  }

  return (
    <aside className="rail">
      <div className="rail-company">
        {active ? (
          <>
            <strong>{active.name}</strong>
            <span>{ROLE_LABELS[active.role] ?? active.role}</span>
            {tenants.length > 1 ? (
              <div>
                <Link href="/empresas">Cambiar de empresa</Link>
              </div>
            ) : null}
          </>
        ) : (
          <strong>{loading ? "Cargando…" : "Sin empresa"}</strong>
        )}
      </div>
      <nav aria-label="Secciones">
        <span className="rail-group">Comprobantes</span>
        {DOCUMENT_MODULES.map((section) => (
          <NavLink key={section.code} href={section.href}>
            {section.title}
          </NavLink>
        ))}
        {canBill(active) ? (
          <>
            <span className="rail-group">Emisión</span>
            <NavLink href="/facturas/nueva">Nueva factura</NavLink>
            <NavLink href="/facturas/borradores">Borradores</NavLink>
            <NavLink href="/notas/nueva">Nueva nota</NavLink>
          </>
        ) : null}
        <span className="rail-group">Catálogos</span>
        <NavLink href="/clientes">Clientes</NavLink>
        <NavLink href="/productos">Productos</NavLink>
        <span className="rail-group">Configuración</span>
        <NavLink href="/configuracion/emisor">Emisor</NavLink>
        <NavLink href="/configuracion/certificado">Certificado</NavLink>
        {canWrite(active) ? <NavLink href="/integraciones">Integraciones</NavLink> : null}
        <NavLink href="/empresas">Empresas</NavLink>
      </nav>
      <div className="rail-user">
        {userName ? <div>{userName}</div> : null}
        <NavLink href="/cuenta">Mi cuenta</NavLink>
        <button type="button" onClick={signOut} disabled={leaving}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

/** Marco de la aplicación: el talonario (navegación y empresa activa) a la izquierda y la hoja a la derecha. */
export function AppShell({ userName, children }: { userName: string | null; children: ReactNode }) {
  return (
    <TenantProvider>
      <div className="shell">
        <Rail userName={userName} />
        <main className="sheet">{children}</main>
      </div>
    </TenantProvider>
  );
}
