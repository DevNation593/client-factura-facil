import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { formatInstant } from "@/lib/dates";
import { json, problem, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import { ApiKeys } from "./ApiKeys";

const ERP = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "ERP Contable",
  publicId: "Ab12Cd34Ef56",
  createdBy: "ana@empresa.ec",
  createdAt: "2026-10-01T15:00:00Z",
  lastUsedAt: null,
  revokedAt: null,
};
const OLD = {
  ...ERP,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Tienda vieja",
  publicId: "Zz99Yy88Xx77",
  revokedAt: "2026-10-05T15:00:00Z",
};

type Routes = Parameters<typeof stubApi>[0];

function keys(extra: Routes = {}, list: unknown[] = [ERP, OLD]) {
  return stubApi({ "GET /api-keys": () => json(200, list), ...extra });
}

describe("API keys", () => {
  it("lista las keys con su prefijo", async () => {
    keys();
    renderWithTenant(<ApiKeys />);

    const table = await screen.findByRole("table", { name: "API keys" });
    const erp = within(table).getByRole("cell", { name: "ERP Contable" }).closest("tr") as HTMLElement;
    expect(within(erp).getByText("efk_Ab12Cd34Ef56_…")).toBeInTheDocument();
    expect(within(erp).getByText("ana@empresa.ec")).toBeInTheDocument();
    expect(within(erp).getByText("Nunca")).toBeInTheDocument();
    expect(within(erp).getByRole("cell", { name: formatInstant(ERP.createdAt) })).toBeInTheDocument();
    expect(within(erp).getByRole("button", { name: /Revocar/ })).toBeInTheDocument();
    expect(erp).not.toHaveClass("muted");
    expect(within(table).getByRole("columnheader", { name: "Creada" })).toBeInTheDocument();
    const old = within(table).getByRole("cell", { name: "Tienda vieja" }).closest("tr") as HTMLElement;
    expect(within(old).getByText(/Revocada el/)).toBeInTheDocument();
    expect(old).toHaveClass("muted");
    expect(within(old).queryByRole("button", { name: /Revocar/ })).not.toBeInTheDocument();
  });

  it("crear muestra la key una sola vez", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const api = keys({
      "POST /api-keys": () =>
        json(201, { id: "33333333-3333-4333-8333-333333333333", name: "Tienda", publicId: "Qq11Ww22Ee33", key: "efk_Qq11Ww22Ee33_secreto", createdAt: "2026-10-16T15:00:00Z" }),
    });
    renderWithTenant(<ApiKeys />);
    await screen.findByRole("table", { name: "API keys" });

    await userEvent.type(screen.getByLabelText("Nombre de la key"), "Tienda");
    await userEvent.click(screen.getByRole("button", { name: "Crear API key" }));

    expect(await screen.findByLabelText("API key")).toHaveValue("efk_Qq11Ww22Ee33_secreto");
    expect(screen.getByText(/Guárdala ahora: no volverás a verla/)).toBeInTheDocument();
    expect(api.to("POST", "/api-keys")[0]?.body).toEqual({ name: "Tienda" });
    await userEvent.click(screen.getByRole("button", { name: "Copiar key" }));
    expect(writeText).toHaveBeenCalledWith("efk_Qq11Ww22Ee33_secreto");
    expect(api.to("GET", "/api-keys")).toHaveLength(2);
    expect(screen.getByLabelText("Nombre de la key")).toHaveValue("");
    // El mismo largo que acepta la API.
    expect(screen.getByLabelText("Nombre de la key")).toHaveAttribute("maxLength", "80");
  });

  it("revocar pide confirmación", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const api = keys({ "DELETE /api-keys/:id": () => new Response(null, { status: 204 }) });
    renderWithTenant(<ApiKeys />);
    await screen.findByRole("table", { name: "API keys" });

    await userEvent.click(screen.getByRole("button", { name: /Revocar/ }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Los sistemas que usen esta key dejarán de poder facturar"));
    expect(api.to("DELETE", `/api-keys/${ERP.id}`)).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: /Revocar/ }));
    await waitFor(() => expect(api.to("DELETE", `/api-keys/${ERP.id}`)).toHaveLength(1));
    await waitFor(() => expect(api.to("GET", "/api-keys")).toHaveLength(2));
  });

  it("muestra el error del límite", async () => {
    keys({ "POST /api-keys": () => problem(409, "API_KEY_LIMIT", "Ya tiene el máximo de API keys activas") });
    renderWithTenant(<ApiKeys />);
    await screen.findByRole("table", { name: "API keys" });

    await userEvent.type(screen.getByLabelText("Nombre de la key"), "Otra");
    await userEvent.click(screen.getByRole("button", { name: "Crear API key" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/máximo de API keys/);
  });

  it("explica cómo usarla", async () => {
    keys();
    renderWithTenant(<ApiKeys />);
    const help = await screen.findByText(/curl/);
    expect(help).toHaveTextContent("X-Api-Key");
    expect(help).toHaveTextContent("/api/v1/tenants/current");
  });
});
