import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import { FixedTenantProvider, type Tenant, type TenantState } from "@/lib/tenantContext";

export const TENANT_ID = "0b9d6c5e-3f0a-4a57-9c0e-2f1d3b4a5c6d";

export function tenant(role: Tenant["role"] = "OWNER"): Tenant {
  return { id: TENANT_ID, name: "Comercial Andina", status: "ACTIVE", role };
}

/** Renderiza una pantalla como la vería un usuario con ese rol en la empresa activa (o sin empresa). */
export function renderWithTenant(
  ui: ReactElement,
  options: { role?: Tenant["role"]; active?: boolean; overrides?: Partial<TenantState> } = {},
) {
  const active = options.active === false ? null : tenant(options.role);
  const state: TenantState = {
    tenants: active ? [active] : [],
    active,
    loading: false,
    error: undefined,
    select: () => {},
    reload: async () => {},
    ...options.overrides,
  };
  return render(<FixedTenantProvider value={state}>{ui}</FixedTenantProvider>);
}
