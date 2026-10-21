import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { json, stubApi } from "@/test/api";
import { route } from "@/test/navigation";
import { renderWithTenant } from "@/test/render";

import NuevaNotaCreditoPage from "../credit-notes/new/page";
import NuevaNotaDebitoPage from "../debit-notes/new/page";

function api() {
  return stubApi({
    "GET /taxpayers": () => json(200, []),
    "GET /customers": () => json(200, { items: [], page: 0, size: 20, total: 0 }),
    "GET /products": () => json(200, { items: [], page: 0, size: 20, total: 0 }),
    "GET /catalogs/tax-rates": () => json(200, []),
    "GET /catalogs/payment-methods": () => json(200, []),
  });
}

describe("Nueva nota", () => {
  it("issues a credit note from its own submodule", async () => {
    api();
    route.pathname = "/documents/credit-notes/new";
    renderWithTenant(<NuevaNotaCreditoPage />);

    expect(screen.getByRole("heading", { name: "Nueva nota de crédito" })).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Notas de crédito" });
    expect(within(tabs).getByRole("link", { name: "Emitidas" })).toHaveAttribute("href", "/documents/credit-notes");
    expect(within(tabs).getByRole("link", { name: "Nueva nota de crédito" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("button", { name: "Emitir nota de crédito" })).toBeInTheDocument();
  });

  it("issues a debit note from its own submodule", async () => {
    api();
    route.pathname = "/documents/debit-notes/new";
    renderWithTenant(<NuevaNotaDebitoPage />);

    expect(screen.getByRole("heading", { name: "Nueva nota de débito" })).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Notas de débito" });
    expect(within(tabs).getByRole("link", { name: "Emitidas" })).toHaveAttribute("href", "/documents/debit-notes");
    expect(within(tabs).getByRole("link", { name: "Nueva nota de débito" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("button", { name: "Emitir nota de débito" })).toBeInTheDocument();
  });

  it("is not offered to a role that cannot issue", () => {
    renderWithTenant(<NuevaNotaCreditoPage />, { role: "AUDITOR" });

    expect(screen.getByText("Su rol en esta empresa no permite emitir notas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Emitir nota de crédito" })).not.toBeInTheDocument();
  });
});
