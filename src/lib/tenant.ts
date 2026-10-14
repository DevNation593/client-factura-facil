/** Cookie con la empresa activa. El proxy la envía a la API como X-Tenant-Id. */
const TENANT_COOKIE = "einvoice_tenant";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let pinned: string | null = null;

/**
 * Empresa con la que trabaja esta pestaña. La cookie es de todo el navegador: si otra pestaña
 * elige otra empresa, esta sigue con la suya y sus peticiones lo dicen.
 */
export function pinTenant(id: string | null): void {
  pinned = id;
}

export function pinnedTenant(): string | null {
  return pinned;
}

/** Empresa activa en este navegador, o nulo si no se ha elegido. */
export function activeTenantId(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  for (const part of document.cookie.split(";")) {
    const [name, value] = part.trim().split("=");
    if (name === TENANT_COOKIE && value && UUID.test(value)) {
      return value;
    }
  }
  return null;
}

export function setActiveTenant(id: string): void {
  if (!UUID.test(id)) {
    throw new Error("Identificador de empresa no válido");
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TENANT_COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function clearActiveTenant(): void {
  document.cookie = `${TENANT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
