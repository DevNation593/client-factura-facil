import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import ProductosPage from "./page";

const RATES = [
  { taxCode: "2", rateCode: "4", description: "15%", rate: "15.00" },
  { taxCode: "2", rateCode: "0", description: "0%", rate: "0.00" },
];

// Como lo devuelve la API: el precio con seis decimales.
const PRODUCT = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", sku: "SRV-001", name: "Servicio de consultoría", unitPrice: "10.000000", ivaRateCode: "4" };

function page(items: unknown[]) {
  return json(200, { items, page: 0, size: 20, total: items.length });
}

describe("Productos", () => {
  it("registers a product with a tax rate from the catalogue", async () => {
    let stored: unknown[] = [];
    const api = stubApi({
      "GET /catalogs/tax-rates": () => json(200, RATES),
      "GET /products": () => page(stored),
      "POST /products": () => {
        stored = [PRODUCT];
        return json(201, PRODUCT);
      },
    });
    renderWithTenant(<ProductosPage />);
    expect(await screen.findByText("Aún no hay productos.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Código"), "SRV-001");
    await userEvent.type(screen.getByLabelText("Nombre"), "Servicio de consultoría");
    await userEvent.type(screen.getByLabelText("Precio unitario sin IVA"), "10");
    await userEvent.selectOptions(await screen.findByLabelText("Tarifa de IVA"), "15%");
    await userEvent.click(screen.getByRole("button", { name: "Registrar producto" }));

    expect(await screen.findByText("Producto registrado: Servicio de consultoría.")).toBeInTheDocument();
    // El precio viaja como cadena decimal, con al menos dos decimales.
    expect(api.to("POST", "/products")[0]?.body).toEqual({ sku: "SRV-001", name: "Servicio de consultoría", unitPrice: "10.00", ivaRateCode: "4" });
    expect(await screen.findByRole("cell", { name: "15%" })).toBeInTheDocument();
    // Sin ceros de más.
    expect(screen.getByRole("cell", { name: "10.00" })).toBeInTheDocument();
  });

  it("does not choose the tax rate for the user", async () => {
    const api = stubApi({
      "GET /catalogs/tax-rates": () => json(200, RATES),
      "GET /products": () => page([]),
      "POST /products": () => json(201, PRODUCT),
    });
    renderWithTenant(<ProductosPage />);
    await screen.findByText("Aún no hay productos.");
    const rate = await screen.findByLabelText("Tarifa de IVA");
    await screen.findByRole("option", { name: "15%" });
    expect(rate).toHaveValue("");
    expect(screen.getByRole("option", { name: "Elija la tarifa" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Código"), "SRV-001");
    await userEvent.type(screen.getByLabelText("Nombre"), "Servicio");
    await userEvent.type(screen.getByLabelText("Precio unitario sin IVA"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Registrar producto" }));

    expect(rate).toHaveAccessibleDescription("Elija la tarifa de IVA.");
    expect(api.to("POST", "/products")).toHaveLength(0);
  });

  it("accepts only a plain decimal price", async () => {
    const api = stubApi({
      "GET /catalogs/tax-rates": () => json(200, RATES),
      "GET /products": () => page([]),
      "POST /products": () => json(201, PRODUCT),
    });
    renderWithTenant(<ProductosPage />);
    await screen.findByText("Aún no hay productos.");
    await userEvent.type(screen.getByLabelText("Código"), "SRV-001");
    await userEvent.type(screen.getByLabelText("Nombre"), "Servicio");
    await userEvent.selectOptions(await screen.findByLabelText("Tarifa de IVA"), "15%");
    const price = screen.getByLabelText("Precio unitario sin IVA");

    for (const bad of ["1,5", "-1", "1e3", "1.1234567"]) {
      await userEvent.clear(price);
      await userEvent.type(price, bad);
      await userEvent.click(screen.getByRole("button", { name: "Registrar producto" }));
      expect(price, bad).toHaveAccessibleDescription(/con punto decimal y sin signos/);
    }
    expect(api.to("POST", "/products")).toHaveLength(0);

    await userEvent.clear(price);
    await userEvent.type(price, "9.333333");
    await userEvent.click(screen.getByRole("button", { name: "Registrar producto" }));

    await screen.findByText(/Producto registrado/);
    expect((api.to("POST", "/products")[0]?.body as { unitPrice: string }).unitPrice).toBe("9.333333");
  });

  it("says when the code is already taken, next to the code", async () => {
    stubApi({
      "GET /catalogs/tax-rates": () => json(200, RATES),
      "GET /products": () => page([]),
      "POST /products": () => problem(409, "PRODUCT_SKU_TAKEN"),
    });
    renderWithTenant(<ProductosPage />);
    await screen.findByText("Aún no hay productos.");

    await userEvent.type(screen.getByLabelText("Código"), "SRV-001");
    await userEvent.type(screen.getByLabelText("Nombre"), "Servicio");
    await userEvent.type(screen.getByLabelText("Precio unitario sin IVA"), "10");
    await userEvent.selectOptions(await screen.findByLabelText("Tarifa de IVA"), "15%");
    await userEvent.click(screen.getByRole("button", { name: "Registrar producto" }));

    expect(await screen.findByText("Ya existe un producto con ese código.")).toBeInTheDocument();
    expect(screen.getByLabelText("Código")).toBeInvalid();
  });

  it("searches by name or code", async () => {
    const api = stubApi({
      "GET /catalogs/tax-rates": () => json(200, RATES),
      "GET /products": (call) => (call.query.get("q") === "srv" ? page([PRODUCT]) : page([])),
    });
    renderWithTenant(<ProductosPage />);
    await screen.findByText("Aún no hay productos.");

    await userEvent.type(screen.getByLabelText("Buscar producto"), "srv");

    expect(await screen.findByText("Servicio de consultoría")).toBeInTheDocument();
    expect(api.to("GET", "/products").filter((call) => call.query.has("q"))).toHaveLength(1);
  });

  it("only owners and administrators register products", async () => {
    stubApi({ "GET /catalogs/tax-rates": () => json(200, RATES), "GET /products": () => page([PRODUCT]) });
    renderWithTenant(<ProductosPage />, { role: "BILLER" });

    expect(await screen.findByText("Servicio de consultoría")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar producto" })).not.toBeInTheDocument();
  });
});
