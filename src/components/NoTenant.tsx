"use client";

import Link from "next/link";

import { useTenant } from "@/lib/tenantContext";

import { ErrorNotice, Notice } from "./Notice";

/**
 * Lo que se muestra en una pantalla que necesita una empresa activa cuando no la hay. Distingue por
 * qué: todavía se está cargando, la carga falló, o de verdad no se ha elegido ninguna.
 */
export function NoTenant() {
  const { loading, error } = useTenant();
  if (loading) {
    return <p>Cargando…</p>;
  }
  if (error !== undefined && error !== null) {
    return <ErrorNotice error={error} />;
  }
  return (
    <Notice>
      Para continuar, <Link href="/empresas">elija o cree una empresa</Link>.
    </Notice>
  );
}
