import type { components } from "@/api/schema";

export type Role = components["schemas"]["Role"];

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  BILLER: "Facturador",
  AUDITOR: "Auditor",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * Roles que alguien con ese rol puede conceder o retirar: nadie da uno igual o superior al suyo, y
 * el de propietario no se concede. Es lo que la pantalla ofrece; quien decide es la API.
 */
export function grantableRoles(role: string | undefined): Role[] {
  if (role === "OWNER") {
    return ["ADMIN", "BILLER", "AUDITOR"];
  }
  if (role === "ADMIN") {
    return ["BILLER", "AUDITOR"];
  }
  return [];
}
