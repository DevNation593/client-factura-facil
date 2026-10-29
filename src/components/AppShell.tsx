"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { MODULES } from "@/lib/modules";
import { ROLE_LABELS } from "@/lib/roles";
import { sessionNavigation } from "@/lib/sessionNavigation";
import { canWrite, TenantProvider, useTenant } from "@/lib/tenantContext";

import { Icon, type IconName } from "./Icon";

/** El icono de cada sección del menú, por su dirección. */
const NAV_ICONS: Record<string, IconName> = {
  "/documents/invoices": "invoice",
  "/documents/credit-notes": "note-minus",
  "/documents/debit-notes": "note-plus",
  "/documents/waybills": "truck",
  "/documents/purchase-settlements": "bag",
  "/documents/withholdings": "percent",
  "/catalogs/customers": "users",
  "/catalogs/products": "box",
  "/settings/companies": "building",
  "/settings/issuer": "id",
  "/settings/certificate": "shield",
  "/settings/integrations": "plug",
  "/account": "user",
};

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);
  const icon = NAV_ICONS[href];
  return (
    <Link href={href} aria-current={current ? "page" : undefined}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

function Rail({ userName }: { userName: string | null }) {
  const { active, tenants, loading } = useTenant();
  const pathname = usePathname();
  const [leaving, setLeaving] = useState(false);
  /** En el teléfono, si el menú está abierto. Al ir a otra pantalla se cierra, y no vuelve a abrirse solo al regresar. */
  const [open, setOpen] = useState(false);
  const [shownAt, setShownAt] = useState(pathname);
  if (shownAt !== pathname) {
    setShownAt(pathname);
    setOpen(false);
  }

  /**
   * Cierra la sesión (en la API y en las cookies) y después vuelve a la pantalla de ingreso con una
   * navegación completa, para que no quede nada de la sesión cargado en la página.
   */
  async function signOut() {
    if (leaving) {
      return;
    }
    setLeaving(true);
    let destination = "/sign-in";
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
    <aside className="rail" data-open={open}>
      <div className="rail-bar">
        <div className="rail-company">
          {active ? (
            <>
              <span className="rail-monogram" aria-hidden="true">
                {active.name.trim().charAt(0).toUpperCase()}
              </span>
              <strong>{active.name}</strong>
              <span>{ROLE_LABELS[active.role] ?? active.role}</span>
              {tenants.length > 1 ? (
                <div>
                  <Link href="/settings/companies">Cambiar de empresa</Link>
                </div>
              ) : null}
            </>
          ) : (
            <strong>{loading ? "Cargando…" : "Sin empresa"}</strong>
          )}
        </div>
        <button
          type="button"
          className="rail-toggle"
          aria-expanded={open}
          aria-controls="menu-principal"
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? "close" : "menu"} />
          Menú
        </button>
      </div>
      <div className="rail-menu" id="menu-principal">
        <nav aria-label="Secciones">
          {MODULES.map((entry) => (
            <div key={entry.href} className="rail-module" role="group" aria-labelledby={`modulo-${entry.href.slice(1)}`}>
              <span className="rail-group" id={`modulo-${entry.href.slice(1)}`}>
                {entry.title}
              </span>
              {entry.submodules
                .filter((submodule) => submodule.access !== "write" || canWrite(active))
                .map((submodule) => (
                  <NavLink key={submodule.href} href={submodule.href}>
                    {submodule.title}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="rail-user">
          {userName ? <div className="rail-user-name">{userName}</div> : null}
          <NavLink href="/account">Mi cuenta</NavLink>
          <button type="button" onClick={signOut} disabled={leaving}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * Marco de la aplicación: el menú (navegación y empresa activa) a la izquierda y la hoja a la
 * derecha. La hoja se monta de nuevo en cada pantalla, para que entre con su animación.
 */
export function AppShell({ userName, children }: { userName: string | null; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <TenantProvider>
      <div className="shell">
        <Rail userName={userName} />
        <main className="sheet">
          <div className="sheet-body" key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </TenantProvider>
  );
}
