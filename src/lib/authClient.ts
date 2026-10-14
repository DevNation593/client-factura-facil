import { useSyncExternalStore } from "react";

import { toApiError } from "@/api/problem";

/**
 * Formularios de cuenta (ingresar, registrarse, confirmar el correo, cambiar la contraseña) hacia el
 * servidor de esta aplicación, que habla con la API. Un rechazo llega como ApiError, igual que los
 * de la API, para mostrarlo con describeError.
 */
export async function postAuth(path: string, body: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const response = await fetch(`/auth/${path}`, {
    method: "POST",
    // Marca que el servidor exige a todo lo que cambia algo: solo esta aplicación la pone (contra CSRF).
    headers: { "Content-Type": "application/json", "X-Requested-With": "einvoice-web" },
    body: JSON.stringify(body),
  });
  const parsed: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw toApiError(response, parsed);
  }
  return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
}

/**
 * Código de un solo uso de los enlaces de los correos. Va en el fragmento (#token=…), que el navegador
 * no envía a ningún servidor; se lee una vez por página y se quita de la barra de direcciones.
 */
const captured = new Map<string, string | null>();

function linkTokenSnapshot(): string | null {
  const page = window.location.pathname;
  if (!captured.has(page)) {
    const match = /(?:^#|&)token=([A-Za-z0-9_-]+)/.exec(window.location.hash);
    if (match) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    captured.set(page, match?.[1] ?? null);
  }
  return captured.get(page) ?? null;
}

function noSubscription(): () => void {
  return () => {};
}

/** El código del enlace: indefinido mientras se pinta en el servidor, nulo si la dirección no lo trae. */
export function useLinkToken(): string | null | undefined {
  return useSyncExternalStore(noSubscription, linkTokenSnapshot, () => undefined);
}

/** Para las pruebas: olvida los códigos ya leídos. */
export function forgetLinkTokens(): void {
  captured.clear();
}

export const MIN_PASSWORD = 12;

export const MAX_PASSWORD = 128;

/** Comprobación previa en el navegador; la regla que manda es la de la API. */
export function passwordProblem(password: string, repeated: string): string | null {
  const length = [...password].length;
  if (length < MIN_PASSWORD || length > MAX_PASSWORD) {
    return `La contraseña debe tener entre ${MIN_PASSWORD} y ${MAX_PASSWORD} caracteres.`;
  }
  if (password !== repeated) {
    return "Las dos contraseñas no coinciden.";
  }
  return null;
}
