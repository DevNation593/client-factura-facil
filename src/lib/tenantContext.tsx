"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, TENANT_FORBIDDEN_EVENT, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";

import { sessionNavigation } from "./sessionNavigation";
import { activeTenantId, clearActiveTenant, pinnedTenant, pinTenant, setActiveTenant } from "./tenant";

export type Tenant = components["schemas"]["Tenant"];

export type TenantState = {
  /** Empresas a las que pertenece el usuario. */
  tenants: Tenant[];
  /** Empresa con la que se está trabajando, con el rol del usuario en ella. */
  active: Tenant | null;
  loading: boolean;
  error: unknown;
  select: (id: string) => void;
  reload: () => Promise<void>;
};

const TenantContext = createContext<TenantState | null>(null);

/** Empresas del usuario y cuál queda activa: la de la cookie si sigue siendo suya, o la única que tenga. */
async function loadTenants(): Promise<{ list: Tenant[]; chosen: string | null }> {
  const list = await unwrap(api.GET("/tenants"));
  let chosen = activeTenantId();
  if (chosen !== null && !list.some((tenant) => tenant.id === chosen)) {
    // La cookie apunta a una empresa a la que ya no se pertenece.
    clearActiveTenant();
    chosen = null;
  }
  const only = list.length === 1 ? list[0] : undefined;
  if (chosen === null && only) {
    setActiveTenant(only.id);
    chosen = only.id;
  }
  return { list, chosen };
}

/** Carga las empresas del usuario y mantiene cuál está activa. Con una sola, la elige sin preguntar. */
export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(undefined);

  const apply = useCallback((result: { list: Tenant[]; chosen: string | null }) => {
    pinTenant(result.chosen);
    setTenants(result.list);
    setActiveId(result.chosen);
    setError(undefined);
    setLoading(false);
  }, []);

  const fail = useCallback((failure: unknown) => {
    if (failure instanceof ApiError && failure.status === 401) {
      // La sesión caducó: no es que el usuario no tenga empresa. Se le lleva a iniciar sesión y
      // después vuelve a donde estaba.
      sessionNavigation.toLogin(window.location.pathname + window.location.search);
      return;
    }
    setError(failure);
    setLoading(false);
  }, []);

  const reload = useCallback(() => loadTenants().then(apply, fail), [apply, fail]);

  useEffect(() => {
    void loadTenants().then(apply, fail);
  }, [apply, fail]);

  useEffect(() => {
    // Sin acceso ya a la empresa en uso: se suelta y se va a elegir otra, en vez de dejar cada
    // pantalla con su propio error. Sin ninguna empresa en uso no hay nada que perder: es un usuario
    // que aún no tiene empresa, y la pantalla ya le ofrece crear una.
    const lost = () => {
      if (pinnedTenant() === null) {
        return;
      }
      clearActiveTenant();
      pinTenant(null);
      sessionNavigation.leave("/settings/companies");
    };
    window.addEventListener(TENANT_FORBIDDEN_EVENT, lost);
    return () => window.removeEventListener(TENANT_FORBIDDEN_EVENT, lost);
  }, []);

  const select = useCallback((id: string) => {
    setActiveTenant(id);
    pinTenant(id);
    setActiveId(id);
  }, []);

  useEffect(() => {
    if (activeId === null) {
      return;
    }
    // Las descargas solo llevan la cookie, que otra pestaña pudo cambiar: al volver a esta, la
    // cookie vuelve a ser la de su empresa.
    const reassert = () => {
      if (document.visibilityState === "visible" && activeTenantId() !== activeId) {
        setActiveTenant(activeId);
      }
    };
    window.addEventListener("focus", reassert);
    document.addEventListener("visibilitychange", reassert);
    return () => {
      window.removeEventListener("focus", reassert);
      document.removeEventListener("visibilitychange", reassert);
    };
  }, [activeId]);

  const value = useMemo<TenantState>(
    () => ({ tenants, active: tenants.find((tenant) => tenant.id === activeId) ?? null, loading, error, select, reload }),
    [tenants, activeId, loading, error, select, reload],
  );
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/** Para pruebas y casos en que la empresa ya se conoce. */
export function FixedTenantProvider({ value, children }: { value: TenantState; children: ReactNode }) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantState {
  const state = useContext(TenantContext);
  if (state === null) {
    throw new Error("useTenant se usa dentro de TenantProvider");
  }
  return state;
}

/** Quién puede configurar la empresa (emisor, certificado, productos). */
export function canWrite(tenant: Tenant | null): boolean {
  return tenant?.role === "OWNER" || tenant?.role === "ADMIN";
}

/** Quién puede registrar clientes y emitir comprobantes. */
export function canBill(tenant: Tenant | null): boolean {
  return canWrite(tenant) || tenant?.role === "BILLER";
}
