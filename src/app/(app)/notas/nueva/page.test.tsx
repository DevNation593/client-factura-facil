import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { json, stubApi } from "@/test/api";
import { route } from "@/test/navigation";
import { renderWithTenant } from "@/test/render";

import NuevaNotaPage from "./page";

const INVOICE_ID = "12121212-1212-4121-8121-121212121212";

function api() {
  return stubApi({
    "GET /taxpayers": () => json(200, []),
    "GET /customers": () => json(200, { items: [], page: 0, size: 20, total: 0 }),
    "GET /products": () => json(200, { items: [], page: 0, size: 20, total: 0 }),
    "GET /catalogs/tax-rates": () => json(200, []),
  });
}

describe("Nueva nota", () => {
  it("opens the credit note tab by default", async () => {
    api();
    renderWithTenant(<NuevaNotaPage />);

    expect(screen.getByRole("link", { name: "Nota de crédito" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Nota de débito" })).not.toHaveAttribute("aria-current");
    expect(await screen.findByRole("button", { name: "Emitir nota de crédito" })).toBeInTheDocument();
  });

  it("keeps the invoice when switching tabs", () => {
    route.search = `?tipo=debito&factura=${INVOICE_ID}`;
    renderWithTenant(<NuevaNotaPage />);

    expect(screen.getByRole("link", { name: "Nota de débito" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Nota de crédito" })).toHaveAttribute("href", `/notas/nueva?tipo=credito&factura=${INVOICE_ID}`);
    expect(screen.getByRole("link", { name: "Nota de débito" })).toHaveAttribute("href", `/notas/nueva?tipo=debito&factura=${INVOICE_ID}`);
  });

  it("is not offered to a role that cannot issue", () => {
    renderWithTenant(<NuevaNotaPage />, { role: "AUDITOR" });

    expect(screen.getByText("Su rol en esta empresa no permite emitir notas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Emitir nota de crédito" })).not.toBeInTheDocument();
  });
});
