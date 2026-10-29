"use client";

import Link from "next/link";

import { useTenant } from "@/lib/tenantContext";

import { ErrorNotice, Notice } from "./Notice";
import { Skeleton } from "./Skeleton";

/**
 * Lo que se muestra en una pantalla que necesita una empresa activa cuando no la hay. Distingue por
 * qué: todavía se está cargando, la carga falló, o de verdad no se ha elegido ninguna.
 */
export function NoTenant() {
  const { loading, error } = useTenant();
  if (loading) {
    return <Skeleton lines={4} />;
  }
  if (error !== undefined && error !== null) {
    return <ErrorNotice error={error} />;
  }
  return (
    <Notice>
      Para continuar, <Link href="/settings/companies">elija o cree una empresa</Link>.
    </Notice>
  );
}
