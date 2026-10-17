import type { components } from "@/api/schema";

export type Role = components["schemas"]["Role"];

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  BILLER: "Facturador",
  AUDITOR: "Auditor",
};
