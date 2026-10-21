import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { activeTenantId } from "@/lib/tenant";
import { TenantProvider } from "@/lib/tenantContext";
import { json, stubApi } from "@/test/api";
import { router } from "@/test/navigation";

import EmpresasPage from "./page";

const A = { id: "11111111-1111-4111-8111-111111111111", name: "Comercial Andina", status: "ACTIVE", role: "OWNER" };
const B = { id: "22222222-2222-4222-8222-222222222222", name: "Ferretería Sur", status: "ACTIVE", role: "BILLER" };

function renderPage() {
  return render(
    <TenantProvider>
      <EmpresasPage />
    </TenantProvider>,
  );
}

describe("Empresas", () => {
  it("lists the user's tenants and selects one", async () => {
    stubApi({ "GET /tenants": () => json(200, [A, B]) });
    renderPage();

    expect(await screen.findByText("Comercial Andina")).toBeInTheDocument();
    expect(screen.getByText("Facturador")).toBeInTheDocument();
    // Con varias empresas no se elige ninguna por el usuario.
    expect(activeTenantId()).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Usar Ferretería Sur" }));

    expect(activeTenantId()).toBe(B.id);
    expect(router.push).toHaveBeenCalledWith("/documents/invoices");
    expect(await screen.findByText("En uso")).toBeInTheDocument();
  });

  it("selects the only tenant without asking", async () => {
    stubApi({ "GET /tenants": () => json(200, [A]) });
    renderPage();

    expect(await screen.findByText("En uso")).toBeInTheDocument();
    expect(activeTenantId()).toBe(A.id);
  });

  it("forgets a selected tenant the user no longer belongs to", async () => {
    document.cookie = `einvoice_tenant=${B.id}; Path=/`;
    stubApi({ "GET /tenants": () => json(200, [A, { ...B, id: "33333333-3333-4333-8333-333333333333" }]) });
    renderPage();

    await screen.findByText("Comercial Andina");
    expect(activeTenantId()).toBeNull();
  });

  it("creates the first tenant and continues to the issuer setup", async () => {
    let created = false;
    const apiStub = stubApi({
      "GET /tenants": () => json(200, created ? [A] : []),
      "POST /tenants": () => {
        created = true;
        return json(201, A);
      },
    });
    renderPage();

    expect(await screen.findByText(/Todavía no pertenece a ninguna empresa/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nombre de la empresa"), "  Comercial Andina ");
    await userEvent.click(screen.getByRole("button", { name: "Crear empresa" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/settings/issuer"));
    expect(apiStub.to("POST", "/tenants")[0]?.body).toEqual({ name: "Comercial Andina" });
    expect(apiStub.to("POST", "/tenants")[0]?.headers.get("X-Requested-With")).toBe("einvoice-web");
    expect(activeTenantId()).toBe(A.id);
  });

  it("explains a failure to load", async () => {
    stubApi({ "GET /tenants": () => new Response("caída", { status: 502 }) });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("El servidor no está disponible");
  });
});
