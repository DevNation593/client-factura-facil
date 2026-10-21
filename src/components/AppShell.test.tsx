import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { sessionNavigation } from "@/lib/sessionNavigation";
import { json, stubApi } from "@/test/api";
import { route } from "@/test/navigation";

import { AppShell } from "./AppShell";

const TENANT = { id: "11111111-1111-4111-8111-111111111111", name: "Comercial Andina", status: "ACTIVE", role: "BILLER" };

describe("AppShell", () => {
  it("shows the active company, the user and the sections the role can use", async () => {
    route.pathname = "/customers";
    stubApi({ "GET /tenants": () => json(200, [TENANT]) });
    render(
      <AppShell userName="Ana Pérez">
        <p>contenido</p>
      </AppShell>,
    );

    expect(await screen.findByText("Comercial Andina")).toBeInTheDocument();
    expect(screen.getByText("Facturador")).toBeInTheDocument();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Facturas" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Nueva factura" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nueva nota" })).toHaveAttribute("href", "/notes/new");
    // Las integraciones son de quien administra la empresa.
    expect(screen.queryByRole("link", { name: "Integraciones" })).not.toBeInTheDocument();
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("offers the integrations to whoever manages the company", async () => {
    route.pathname = "/integrations";
    stubApi({ "GET /tenants": () => json(200, [{ ...TENANT, role: "ADMIN" }]) });
    render(
      <AppShell userName="Ana Pérez">
        <p>contenido</p>
      </AppShell>,
    );

    expect(await screen.findByRole("link", { name: "Integraciones" })).toHaveAttribute("aria-current", "page");
    // No hay pantalla de equipo: cada usuario trabaja en las empresas que crea.
    expect(screen.queryByRole("link", { name: "Equipo" })).not.toBeInTheDocument();
  });

  it("groups the documents in one entry per type", async () => {
    route.pathname = "/documents/credit-notes";
    stubApi({ "GET /tenants": () => json(200, [TENANT]) });
    render(
      <AppShell userName="Ana Pérez">
        <p>contenido</p>
      </AppShell>,
    );
    await screen.findByText("Comercial Andina");

    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(within(nav).getByText("Comprobantes")).toBeInTheDocument();
    const links = within(nav).getAllByRole("link").slice(0, 6);
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Facturas", "/documents/invoices"],
      ["Notas de crédito", "/documents/credit-notes"],
      ["Notas de débito", "/documents/debit-notes"],
      ["Guías de remisión", "/documents/waybills"],
      ["Liquidaciones de compra", "/documents/purchase-settlements"],
      ["Retenciones", "/documents/withholdings"],
    ]);
    expect(within(nav).getByRole("link", { name: "Notas de crédito" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Notas de débito" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Facturas" })).not.toHaveAttribute("aria-current");
  });

  it("offers new notes only to whoever can issue", async () => {
    route.pathname = "/documents/invoices";
    stubApi({ "GET /tenants": () => json(200, [{ ...TENANT, role: "AUDITOR" }]) });
    render(
      <AppShell userName="Ana Pérez">
        <p>contenido</p>
      </AppShell>,
    );

    expect(await screen.findByText("Auditor")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nueva factura" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nueva nota" })).not.toBeInTheDocument();
    expect(screen.queryByText("Emisión")).not.toBeInTheDocument();
    // Los listados sí los ve: un auditor revisa lo emitido.
    expect(screen.getByRole("link", { name: "Retenciones" })).toHaveAttribute("href", "/documents/withholdings");
  });

  it("signs out and leaves for the address the server gives", async () => {
    const leave = vi.spyOn(sessionNavigation, "leave").mockImplementation(() => {});
    const api = stubApi({
      "GET /tenants": () => json(200, [TENANT]),
      "POST /auth/logout": () => json(200, { redirectTo: "http://localhost:8081/realms/einvoice/protocol/openid-connect/logout?client_id=einvoice-web" }),
    });
    render(
      <AppShell userName="Ana Pérez">
        <p>contenido</p>
      </AppShell>,
    );
    await screen.findByText("Comercial Andina");

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() =>
      expect(leave).toHaveBeenCalledWith("http://localhost:8081/realms/einvoice/protocol/openid-connect/logout?client_id=einvoice-web"),
    );
    expect(api.to("POST", "/auth/logout")).toHaveLength(1);
  });

  it("still leaves the application if signing out fails", async () => {
    const leave = vi.spyOn(sessionNavigation, "leave").mockImplementation(() => {});
    stubApi({
      "GET /tenants": () => json(200, [TENANT]),
      "POST /auth/logout": () => new Response("caída", { status: 502 }),
    });
    render(
      <AppShell userName={null}>
        <p>contenido</p>
      </AppShell>,
    );
    await screen.findByText("Comercial Andina");

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(leave).toHaveBeenCalledWith("/sign-in"));
  });
});
