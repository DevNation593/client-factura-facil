"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { ApiError, describeError } from "@/api/problem";
import { loginUrl } from "@/lib/sessionNavigation";

type Kind = "error" | "success" | "info" | "warning";

/** Aviso al usuario. Un error se anuncia de inmediato a los lectores de pantalla; lo demás, sin interrumpir. */
export function Notice({ kind = "info", children }: { kind?: Kind; children: ReactNode }) {
  const className = kind === "info" ? "notice" : `notice notice-${kind}`;
  return (
    <div className={className} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

/**
 * Aviso de un fallo de la API, con el mensaje que le corresponde. Si falló porque la sesión terminó,
 * ofrece iniciar sesión y volver a donde se estaba: esta misma dirección, con su búsqueda o su
 * registro, o la que indique `returnTo`. Nada si no hay error.
 */
export function ErrorNotice({ error, returnTo }: { error: unknown; returnTo?: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  if (error === undefined || error === null) {
    return null;
  }
  const expired = error instanceof ApiError && error.status === 401;
  return (
    <Notice kind="error">
      {describeError(error)}
      {expired ? (
        <>
          {" "}
          <a href={loginUrl(returnTo ?? (search ? `${pathname}?${search}` : pathname))}>Iniciar sesión</a>
        </>
      ) : null}
    </Notice>
  );
}
