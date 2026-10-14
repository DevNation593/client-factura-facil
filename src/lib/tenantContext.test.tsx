import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/api/client";
import { ApiError } from "@/api/problem";
import { ErrorNotice } from "@/components/Notice";
import { NoTenant } from "@/components/NoTenant";
import { json, problem, stubApi } from "@/test/api";
import { route } from "@/test/navigation";

import { sessionNavigation } from "./sessionNavigation";
import { activeTenantId, setActiveTenant } from "./tenant";
import { TenantProvider, useTenant } from "./tenantContext";

/** Una pantalla cualquiera: muestra su contenido con empresa activa y, si no, lo que diga NoTenant. */
function Screen() {
  const { active } = useTenant();
  return active ? <p>Contenido de {active.name}</p> : <NoTenant />;
}

function renderScreen() {
  return render(
    <TenantProvider>
      <Screen />
    </TenantProvider>,
  );
}

function apiError(status: number, errorCode: string): ApiError {
  return new ApiError(status, { status, errorCode: errorCode as never, correlationId: "prueba" });
}

describe("TenantProvider", () => {
  it("sends the user to sign in again when the session has expired", async () => {
    const toLogin = vi.spyOn(sessionNavigation, "toLogin").mockImplementation(() => {});
    window.history.pushState({}, "", "/documentos?page=2");
    stubApi({ "GET /tenants": () => problem(401, "UNAUTHENTICATED") });
    renderScreen();

    // Vuelve después exactamente a donde estaba.
    await waitFor(() => expect(toLogin).toHaveBeenCalledWith("/documentos?page=2"));
    window.history.pushState({}, "", "/");
    // Y no confunde la sesión caducada con no tener empresa.
    expect(screen.queryByText(/elija o cree una empresa/)).not.toBeInTheDocument();
  });

  it("shows a loading failure instead of pretending there is no company", async () => {
    stubApi({ "GET /tenants": () => new Response("caída", { status: 502 }) });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent("El servidor no está disponible");
    expect(screen.queryByText(/elija o cree una empresa/)).not.toBeInTheDocument();
  });

  it("does not invite to choose a company while the list is still loading", async () => {
    let release: (response: Response) => void = () => {};
    const stub = stubApi({ "GET /tenants": () => new Promise<Response>((resolve) => (release = resolve)) });
    renderScreen();

    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(screen.queryByText(/elija o cree una empresa/)).not.toBeInTheDocument();
    await waitFor(() => expect(stub.calls).toHaveLength(1));
    release(json(200, []));

    expect(await screen.findByText(/elija o cree una empresa/)).toBeInTheDocument();
  });

  it("shows the content once a company is active", async () => {
    stubApi({
      "GET /tenants": () => json(200, [{ id: "11111111-1111-4111-8111-111111111111", name: "Comercial Andina", status: "ACTIVE", role: "OWNER" }]),
    });
    renderScreen();

    expect(await screen.findByText("Contenido de Comercial Andina")).toBeInTheDocument();
  });

  it("keeps working with its own company after another tab chooses a different one", async () => {
    const mine = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    setActiveTenant(mine);
    const calls = stubApi({
      "GET /tenants": () =>
        json(200, [
          { id: mine, name: "Comercial Andina", status: "ACTIVE", role: "OWNER" },
          { id: other, name: "Ferretería Sur", status: "ACTIVE", role: "OWNER" },
        ]),
    });
    renderScreen();
    await screen.findByText("Contenido de Comercial Andina");

    // Otra pestaña del mismo navegador elige la otra empresa: la cookie es de todo el navegador.
    setActiveTenant(other);
    await api.GET("/tenants");

    // Esta pestaña sigue diciendo "Comercial Andina", y sus peticiones también.
    expect(calls.calls.at(-1)?.headers.get("X-Tenant-Id")).toBe(mine);

    // Al volver a ella, las descargas (que solo llevan la cookie) vuelven a ser de su empresa.
    // (El aviso se escucha desde un efecto, que puede ejecutarse un instante después de pintar.)
    await waitFor(() => {
      window.dispatchEvent(new Event("focus"));
      expect(activeTenantId()).toBe(mine);
    });
  });

  it("takes the user to choose a company when they have lost access to the one in use", async () => {
    const leave = vi.spyOn(sessionNavigation, "leave").mockImplementation(() => {});
    const mine = "11111111-1111-4111-8111-111111111111";
    setActiveTenant(mine);
    stubApi({
      "GET /tenants": () => json(200, [{ id: mine, name: "Comercial Andina", status: "ACTIVE", role: "BILLER" }]),
      // El propietario lo retiró: la API ya no le deja trabajar con esa empresa.
      "GET /customers": () => problem(403, "TENANT_FORBIDDEN"),
      "GET /products": () => problem(403, "ROLE_FORBIDDEN"),
    });
    renderScreen();
    await screen.findByText("Contenido de Comercial Andina");

    // Un rol que no alcanza no es perder la empresa.
    await api.GET("/products");
    expect(leave).not.toHaveBeenCalled();

    await api.GET("/customers");

    await waitFor(() => expect(leave).toHaveBeenCalledWith("/empresas"));
    expect(activeTenantId()).toBeNull();
  });

  it("follows the company chosen in this tab", async () => {
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";
    const calls = stubApi({
      "GET /tenants": () =>
        json(200, [
          { id: first, name: "Comercial Andina", status: "ACTIVE", role: "OWNER" },
          { id: second, name: "Ferretería Sur", status: "ACTIVE", role: "OWNER" },
        ]),
    });
    function Chooser() {
      const { active, select } = useTenant();
      return <button onClick={() => select(second)}>{active ? active.name : "sin empresa"}</button>;
    }
    render(
      <TenantProvider>
        <Chooser />
      </TenantProvider>,
    );
    await screen.findByText("sin empresa");
    // Sin empresa elegida, las peticiones no nombran ninguna.
    expect(calls.calls.at(-1)?.headers.has("X-Tenant-Id")).toBe(false);

    await userEvent.click(screen.getByRole("button"));
    await screen.findByText("Ferretería Sur");
    await api.GET("/tenants");

    expect(calls.calls.at(-1)?.headers.get("X-Tenant-Id")).toBe(second);
  });
});

describe("ErrorNotice", () => {
  it("offers to sign in again when a call fails because the session ended", () => {
    route.pathname = "/clientes";
    render(<ErrorNotice error={apiError(401, "UNAUTHENTICATED")} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Su sesión terminó.");
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/auth/login?volver=%2Fclientes");
  });

  it("comes back to the same search or record after signing in, not just to the same screen", () => {
    route.pathname = "/documentos";
    route.search = "?page=3";
    render(<ErrorNotice error={apiError(401, "UNAUTHENTICATED")} />);

    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/auth/login?volver=%2Fdocumentos%3Fpage%3D3");
  });

  it("has no link for other errors", () => {
    render(<ErrorNotice error={apiError(409, "PRODUCT_SKU_TAKEN")} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Ya existe un producto con ese código.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
