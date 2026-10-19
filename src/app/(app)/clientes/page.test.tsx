import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import ClientesPage from "./page";

// Como los da el catálogo real (ficha técnica, tabla 6): en mayúsculas.
const TYPES = [
  { code: "04", name: "RUC" },
  { code: "05", name: "CÉDULA" },
  { code: "07", name: "VENTA A CONSUMIDOR FINAL" },
];

function customer(index: number) {
  return { id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, idType: "05", idNumber: `17123456${index}`, name: `Cliente ${index}`, email: null };
}

function page(items: unknown[], total = items.length, pageNumber = 0) {
  return json(200, { items, page: pageNumber, size: 20, total });
}

describe("Clientes", () => {
  it("searches once the user stops typing", async () => {
    const api = stubApi({
      "GET /catalogs/identification-types": () => json(200, TYPES),
      "GET /customers": (call) => (call.query.get("q") === "mar" ? page([{ ...customer(1), name: "María Pérez" }]) : page([customer(1), customer(2)])),
    });
    renderWithTenant(<ClientesPage />);
    await screen.findByText("Cliente 2");

    await userEvent.type(screen.getByLabelText("Buscar cliente"), "mar");

    expect(await screen.findByText("María Pérez")).toBeInTheDocument();
    const searches = api.to("GET", "/customers").filter((call) => call.query.has("q"));
    expect(searches).toHaveLength(1);
    expect(searches[0]?.query.get("q")).toBe("mar");
    expect(searches[0]?.query.get("page")).toBe("0");
    expect(screen.queryByText("Cliente 2")).not.toBeInTheDocument();
  });

  it("paginates", async () => {
    const api = stubApi({
      "GET /catalogs/identification-types": () => json(200, TYPES),
      "GET /customers": (call) => (call.query.get("page") === "1" ? page([customer(21)], 21, 1) : page([customer(1)], 21, 0)),
    });
    renderWithTenant(<ClientesPage />);

    expect(await screen.findByText("Página 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("Cliente 21")).toBeInTheDocument();
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(api.to("GET", "/customers").at(-1)?.query.get("size")).toBe("20");
  });

  it("registers a customer and shows it", async () => {
    let stored: unknown[] = [];
    const api = stubApi({
      "GET /catalogs/identification-types": () => json(200, TYPES),
      "GET /customers": () => page(stored),
      "POST /customers": () => {
        stored = [{ ...customer(1), name: "María Pérez", email: "maria@example.test" }];
        return json(201, stored[0]);
      },
    });
    renderWithTenant(<ClientesPage />);
    expect(await screen.findByText(/Aún no hay clientes/)).toBeInTheDocument();

    // Los nombres del catálogo se leen en minúsculas, salvo las siglas.
    expect(await screen.findByRole("option", { name: "Cédula" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "RUC" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Venta a consumidor final" })).toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByLabelText("Tipo de identificación"), "05");
    await userEvent.type(screen.getByLabelText("Número de identificación"), "1712345678");
    await userEvent.type(screen.getByLabelText("Nombre o razón social"), "María Pérez");
    await userEvent.type(screen.getByLabelText("Correo"), "maria@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Registrar cliente" }));

    expect(await screen.findByText("Cliente registrado: María Pérez.")).toBeInTheDocument();
    expect(api.to("POST", "/customers")[0]?.body).toEqual({
      idType: "05",
      idNumber: "1712345678",
      name: "María Pérez",
      email: "maria@example.test",
      address: null,
      phone: null,
    });
    expect(await screen.findByRole("cell", { name: "maria@example.test" })).toBeInTheDocument();
    expect(screen.getByLabelText("Número de identificación")).toHaveValue("");
  });

  it("puts an identification the server rejects next to its field", async () => {
    stubApi({
      "GET /catalogs/identification-types": () => json(200, TYPES),
      "GET /customers": () => page([]),
      "POST /customers": () => problem(422, "IDENTIFICATION_INVALID"),
    });
    renderWithTenant(<ClientesPage />);

    await userEvent.selectOptions(await screen.findByLabelText("Tipo de identificación"), "04");
    await userEvent.type(screen.getByLabelText("Número de identificación"), "9999999999999");
    await userEvent.type(screen.getByLabelText("Nombre o razón social"), "Consumidor final");
    await userEvent.click(screen.getByRole("button", { name: "Registrar cliente" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Número de identificación")).toHaveAccessibleDescription(/no corresponde al tipo/),
    );
    expect(screen.getByLabelText("Número de identificación")).toHaveValue("9999999999999");
  });

  it("lets an auditor look but not register", async () => {
    stubApi({ "GET /catalogs/identification-types": () => json(200, TYPES), "GET /customers": () => page([customer(1)]) });
    renderWithTenant(<ClientesPage />, { role: "AUDITOR" });

    expect(await screen.findByText("Cliente 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar cliente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar a/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar a/ })).not.toBeInTheDocument();
  });

  it("edits a customer in the list", async () => {
    let stored = { ...customer(1), address: "Quito", phone: "022345678" };
    const api = stubApi({
      "GET /catalogs/identification-types": () => json(200, TYPES),
      "GET /customers": () => page([stored]),
      "PUT /customers/:id": (call) => {
        stored = { ...stored, ...(call.body as typeof stored) };
        return json(200, stored);
      },
    });
    renderWithTenant(<ClientesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar a Cliente 1" }));
    expect(screen.getByLabelText("Número de identificación")).toHaveValue("171234561");
    await userEvent.clear(screen.getByLabelText("Nombre o razón social"));
    await userEvent.type(screen.getByLabelText("Nombre o razón social"), "Cliente actualizado");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("cell", { name: "Cliente actualizado" })).toBeInTheDocument();
    expect(api.to("PUT", `/customers/${stored.id}`)[0]?.body).toMatchObject({ name: "Cliente actualizado", idNumber: "171234561" });
  });

  it("asks before deleting a customer and removes it from the list", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    let stored: unknown[] = [customer(1)];
    const api = stubApi({
      "GET /catalogs/identification-types": () => json(200, TYPES),
      "GET /customers": () => page(stored),
      "DELETE /customers/:id": () => {
        stored = [];
        return new Response(null, { status: 204 });
      },
    });
    renderWithTenant(<ClientesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar a Cliente 1" }));
    expect(api.to("DELETE", `/customers/${customer(1).id}`)).toHaveLength(0);
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar a Cliente 1" }));
    expect(await screen.findByText(/Aún no hay clientes/)).toBeInTheDocument();
    expect(api.to("DELETE", `/customers/${customer(1).id}`)).toHaveLength(1);
    confirm.mockRestore();
  });
});
