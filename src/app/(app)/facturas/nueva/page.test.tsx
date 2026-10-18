import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { listDrafts, newDraft, saveDraft } from "@/lib/drafts";
import { json, problem, stubApi } from "@/test/api";
import { route, router } from "@/test/navigation";
import { renderWithTenant, TENANT_ID } from "@/test/render";

import NuevaFacturaPage from "./page";

const TAXPAYER = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ruc: "1790012345001", legalName: "Comercial Andina S.A.", headOfficeAddress: "Quito", defaultEnvironment: "1" };
const ESTABLISHMENT = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", taxpayerId: TAXPAYER.id, code: "001", address: "Quito" };
const POINT = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", establishmentId: ESTABLISHMENT.id, code: "002", enabled: true };
const CUSTOMER = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", idType: "05", idNumber: "1712345678", name: "María Pérez" };
// Como lo devuelve la API: el precio con seis decimales.
const SERVICE = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", sku: "SRV-001", name: "Servicio de consultoría", unitPrice: "10.000000", ivaRateCode: "4" };
const BOOK = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", sku: "LIB-001", name: "Libro", unitPrice: "9.333333", ivaRateCode: "0" };
const ISSUED = { id: "99999999-9999-4999-8999-999999999999", state: "RESERVED", statusUrl: "/api/v1/documents/99999999-9999-4999-8999-999999999999" };

type Handler = Parameters<typeof stubApi>[0][string];

/** Sustituye la respuesta de la búsqueda de productos según el texto buscado. */
function stubProducts(stub: ReturnType<typeof stubApi>, find: (q: string) => unknown[]) {
  void stub;
  productSearch = find;
}

let productSearch: ((q: string) => unknown[]) | undefined;

function api(issue: Handler) {
  return stubApi(routes(issue));
}

function routes(issue: Handler): Parameters<typeof stubApi>[0] {
  return {
    "GET /taxpayers": () => json(200, [TAXPAYER]),
    "GET /taxpayers/:id/establishments": () => json(200, [ESTABLISHMENT]),
    "GET /emission-points": () => json(200, [POINT, { ...POINT, id: "cccccccc-cccc-4ccc-8ccc-000000000000", code: "009", enabled: false }]),
    "GET /customers": () => json(200, { items: [CUSTOMER], page: 0, size: 20, total: 1 }),
    "GET /products": (call) => {
      const items = productSearch ? productSearch(call.query.get("q") ?? "") : [SERVICE, BOOK];
      return json(200, { items, page: 0, size: 20, total: items.length });
    },
    "GET /products/:id": (call) => {
      const product = [SERVICE, BOOK].find((item) => call.path.endsWith(item.id));
      return product ? json(200, product) : problem(404, "NOT_FOUND");
    },
    "GET /catalogs/tax-rates": () =>
      json(200, [
        // Las descripciones del catálogo real (ficha técnica, tabla 17) no llevan la palabra IVA.
        { taxCode: "2", rateCode: "4", description: "15%", rate: "15.00" },
        { taxCode: "2", rateCode: "0", description: "0%", rate: "0.00" },
      ]),
    "GET /catalogs/payment-methods": () =>
      json(200, [
        // Como los da el catálogo real (ficha técnica, tabla 24): en mayúsculas y alguno sin tilde.
        { code: "20", name: "OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO", validFrom: "2016-06-01" },
        { code: "01", name: "SIN UTILIZACION DEL SISTEMA FINANCIERO", validFrom: "2013-01-01" },
      ]),
    "POST /invoices": issue,
  };
}

/** Rellena una factura de 2 servicios (20.00 + 3.00 de IVA) a María Pérez. */
async function fillInvoice() {
  await userEvent.click(await screen.findByRole("combobox", { name: "Cliente" }));
  await userEvent.click(await screen.findByRole("option", { name: /María Pérez/ }));
  await userEvent.click(screen.getByRole("combobox", { name: "Producto de la línea 1" }));
  await userEvent.click(await screen.findByRole("option", { name: /Servicio de consultoría/ }));
  const quantity = screen.getByLabelText("Cantidad de la línea 1");
  await userEvent.clear(quantity);
  await userEvent.type(quantity, "2");
}

describe("Nueva factura", () => {
  afterEach(() => {
    productSearch = undefined;
  });

  it("updates the preview as lines change", async () => {
    api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();

    expect(screen.getByLabelText("Precio unitario de la línea 1")).toHaveValue("10.00");
    expect(screen.getByTestId("total")).toHaveTextContent("23.00");
    // La fila del impuesto dice de qué impuesto es, no solo su porcentaje.
    expect(screen.getByRole("row", { name: "IVA 15% 3.00" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: "Subtotal 15% 20.00" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Añadir línea" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Producto de la línea 2" }));
    await userEvent.click(await screen.findByRole("option", { name: /Libro/ }));
    const quantity = screen.getByLabelText("Cantidad de la línea 2");
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "1.5");

    expect(screen.getByTestId("total")).toHaveTextContent("37.00");
    expect(screen.getByText("Subtotal 0%")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sin utilización del sistema financiero" })).toBeInTheDocument();
    // El pago sigue al total mientras el usuario no lo escribe.
    expect(screen.getByLabelText("Importe pagado")).toHaveValue("37.00");
    // Solo se ofrecen los puntos de emisión habilitados.
    expect(screen.getByLabelText("Punto de emisión")).toHaveValue("001-002");
    expect(screen.queryByRole("option", { name: "001-009" })).not.toBeInTheDocument();
  });

  it("does not let the user issue while the payment differs from the total", async () => {
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();

    const amount = screen.getByLabelText("Importe pagado");
    await userEvent.clear(amount);
    await userEvent.type(amount, "20.00");

    expect(amount).toHaveAccessibleDescription(/El pago debe sumar 23.00/);
    expect(screen.getByRole("button", { name: "Emitir factura" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));
    expect(stub.to("POST", "/invoices")).toHaveLength(0);

    await userEvent.clear(amount);
    await userEvent.type(amount, "23");
    expect(screen.getByRole("button", { name: "Emitir factura" })).toBeEnabled();
  });

  it("issues once, with the draft's idempotency key, even on a double click", async () => {
    let release: (response: Response) => void = () => {};
    const stub = api(() => new Promise<Response>((resolve) => (release = resolve)));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();
    await waitFor(() => expect(listDrafts(TENANT_ID)).toHaveLength(1));
    const key = listDrafts(TENANT_ID)[0]!.idempotencyKey;

    const button = screen.getByRole("button", { name: "Emitir factura" });
    await userEvent.dblClick(button);
    await waitFor(() => expect(stub.to("POST", "/invoices")).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Emitiendo…" })).toBeDisabled();
    // Tampoco un segundo envío del formulario que no pase por el botón (Intro, por ejemplo).
    fireEvent.submit(screen.getByRole("button", { name: "Emitiendo…" }).closest("form")!);
    fireEvent.submit(screen.getByRole("button", { name: "Emitiendo…" }).closest("form")!);
    release(json(202, ISSUED));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/documentos/${ISSUED.id}`));
    expect(stub.to("POST", "/invoices")).toHaveLength(1);
    const call = stub.to("POST", "/invoices")[0]!;
    expect(call.headers.get("Idempotency-Key")).toBe(key);
    expect(call.body).toEqual({
      taxpayerId: TAXPAYER.id,
      establishmentCode: "001",
      emissionPointCode: "002",
      customerId: CUSTOMER.id,
      lines: [{ productId: SERVICE.id, quantity: "2", unitPrice: "10.00", discount: "0.00" }],
      payments: [{ methodCode: "20", amount: "23.00" }],
    });
  });

  it("removes the draft and opens the document once issued", async () => {
    api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();
    await waitFor(() => expect(listDrafts(TENANT_ID)).toHaveLength(1));

    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/documentos/${ISSUED.id}`));
    expect(listDrafts(TENANT_ID)).toHaveLength(0);
    // Y no reaparece cuando vence el guardado automático que estuviera pendiente.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(listDrafts(TENANT_ID)).toHaveLength(0);
  });

  it("keeps the draft and explains when the server rejects the invoice", async () => {
    const stub = api(() => problem(422, "FINAL_CONSUMER_LIMIT_EXCEEDED"));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();

    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/consumidor final no puede superar/);
    expect(listDrafts(TENANT_ID)).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalled();
    // Se puede corregir y volver a emitir, con la misma clave.
    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));
    await waitFor(() => expect(stub.to("POST", "/invoices")).toHaveLength(2));
    const [first, second] = stub.to("POST", "/invoices");
    expect(second?.headers.get("Idempotency-Key")).toBe(first?.headers.get("Idempotency-Key"));
  });

  it("keeps the draft when the session expired and offers to sign in again", async () => {
    api(() => problem(401, "UNAUTHENTICATED"));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();

    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));

    const link = await screen.findByRole("link", { name: "inicie sesión" });
    const draft = listDrafts(TENANT_ID)[0]!;
    expect(link).toHaveAttribute("href", `/ingresar?volver=${encodeURIComponent(`/facturas/nueva?borrador=${draft.id}`)}`);
    expect(draft.customerId).toBe(CUSTOMER.id);
    expect(draft.lines[0]?.quantity).toBe("2");
  });

  it("warns when a retry would issue different content under the same key", async () => {
    api(() => problem(409, "IDEMPOTENCY_KEY_REUSED"));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();

    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya se había emitido con otro contenido/);
    expect(listDrafts(TENANT_ID)).toHaveLength(1);
  });

  it("resumes a saved draft", async () => {
    const draft = {
      ...newDraft(),
      customerId: CUSTOMER.id,
      customerName: "María Pérez",
      lines: [{ productId: SERVICE.id, quantity: "3", unitPrice: "10.00", discount: "0.00" }],
    };
    saveDraft(TENANT_ID, draft);
    route.search = `?borrador=${draft.id}`;
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);

    expect(await screen.findByLabelText("Cantidad de la línea 1")).toHaveValue("3");
    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("34.50"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Emitir factura" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));

    await waitFor(() => expect(stub.to("POST", "/invoices")).toHaveLength(1));
    expect(stub.to("POST", "/invoices")[0]?.headers.get("Idempotency-Key")).toBe(draft.idempotencyKey);
  });

  it("finds a product that is not among the first ones by searching for it", async () => {
    const SCREW = { id: "12121212-1212-4121-8121-121212121212", sku: "TOR-900", name: "Tornillo hexagonal", unitPrice: "0.25", ivaRateCode: "4" };
    const stub = api(() => json(202, ISSUED));
    stubProducts(stub, (q) => (q === "tornillo" ? [SCREW] : [SERVICE, BOOK]));
    renderWithTenant(<NuevaFacturaPage />);
    await userEvent.click(await screen.findByRole("combobox", { name: "Cliente" }));
    await userEvent.click(await screen.findByRole("option", { name: /María Pérez/ }));
    expect(screen.queryByRole("option", { name: /Tornillo/ })).not.toBeInTheDocument();

    const picker = screen.getByRole("combobox", { name: "Producto de la línea 1" });
    await userEvent.click(picker);
    await userEvent.type(picker, "tornillo");
    await userEvent.click(await screen.findByRole("option", { name: /Tornillo hexagonal/ }));

    expect(screen.getByLabelText("Precio unitario de la línea 1")).toHaveValue("0.25");
    expect(stub.to("GET", "/products").at(-1)?.query.get("q")).toBe("tornillo");
    // Al abrir de nuevo el selector, la línea conserva su producto y su cálculo.
    await userEvent.click(picker);
    await screen.findByRole("option", { name: /Servicio de consultoría/ });
    await userEvent.keyboard("{Escape}");
    expect(picker).toHaveValue("Tornillo hexagonal (TOR-900)");
    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("0.29"));

    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));
    await waitFor(() => expect(stub.to("POST", "/invoices")).toHaveLength(1));
    expect((stub.to("POST", "/invoices")[0]?.body as { lines: { productId: string }[] }).lines[0]?.productId).toBe(SCREW.id);
  });

  it("searches for a customer inside the chooser", async () => {
    const stub = stubApi({
      ...routes(() => json(202, ISSUED)),
      "GET /customers": (call) => {
        const items = call.query.get("q") === "mar" ? [CUSTOMER] : [];
        return json(200, { items, page: 0, size: 20, total: items.length });
      },
    });
    renderWithTenant(<NuevaFacturaPage />);
    const picker = await screen.findByRole("combobox", { name: "Cliente" });
    expect(screen.queryByLabelText("Buscar cliente")).not.toBeInTheDocument();
    await userEvent.click(picker);
    await userEvent.type(picker, "mar");
    await userEvent.click(await screen.findByRole("option", { name: /María Pérez/ }));

    expect(picker).toHaveValue("María Pérez (1712345678)");
    expect(stub.to("GET", "/customers").at(-1)?.query.get("q")).toBe("mar");
  });

  it("searches independently inside each product chooser", async () => {
    const stub = api(() => json(202, ISSUED));
    stubProducts(stub, (q) => q === "lib" ? [BOOK] : [SERVICE]);
    renderWithTenant(<NuevaFacturaPage />);
    const first = await screen.findByRole("combobox", { name: "Producto de la línea 1" });
    await userEvent.click(first);
    await userEvent.click(await screen.findByRole("option", { name: /Servicio de consultoría/ }));
    await userEvent.click(screen.getByRole("button", { name: "Añadir línea" }));
    const second = screen.getByRole("combobox", { name: "Producto de la línea 2" });
    await userEvent.click(second);
    await userEvent.type(second, "lib");
    await userEvent.click(await screen.findByRole("option", { name: /Libro/ }));

    expect(first).toHaveValue("Servicio de consultoría (SRV-001)");
    expect(second).toHaveValue("Libro (LIB-001)");
    expect(stub.to("GET", "/products").at(-1)?.query.get("q")).toBe("lib");
    expect(screen.queryByLabelText("Buscar producto")).not.toBeInTheDocument();
  });

  it("chooses a product with the keyboard inside the same control", async () => {
    api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);
    const picker = await screen.findByRole("combobox", { name: "Producto de la línea 1" });
    await userEvent.click(picker);
    await screen.findByRole("option", { name: /Servicio de consultoría/ });
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(picker).toHaveValue("Servicio de consultoría (SRV-001)");
    expect(screen.getByLabelText("Precio unitario de la línea 1")).toHaveValue("10.00");
  });

  it("does not issue the invoice when Enter is pressed while searching", async () => {
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();
    const picker = screen.getByRole("combobox", { name: "Producto de la línea 1" });
    await userEvent.click(picker);
    await userEvent.type(picker, "otro producto");
    await userEvent.keyboard("{Enter}");

    expect(stub.to("POST", "/invoices")).toHaveLength(0);
  });

  it("clears the chosen customer when another customer search starts", async () => {
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();
    const picker = screen.getByRole("combobox", { name: "Cliente" });
    await userEvent.click(picker);
    await userEvent.type(picker, "otra persona");
    await userEvent.tab();

    expect(screen.getByRole("button", { name: "Emitir factura" })).toBeDisabled();
    expect(picker).toHaveValue("");
    expect(stub.to("POST", "/invoices")).toHaveLength(0);
  });

  it("clears the chosen product and its price when another product search starts", async () => {
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();
    const picker = screen.getByRole("combobox", { name: "Producto de la línea 1" });
    await userEvent.click(picker);
    await userEvent.type(picker, "otro servicio");
    await userEvent.tab();

    expect(screen.getByRole("button", { name: "Emitir factura" })).toBeDisabled();
    expect(picker).toHaveValue("");
    expect(screen.getByLabelText("Precio unitario de la línea 1")).toHaveValue("");
    expect(stub.to("POST", "/invoices")).toHaveLength(0);
  });

  it("shows the product of a resumed draft even when the first results do not include it", async () => {
    const SCREW = { id: "12121212-1212-4121-8121-121212121212", sku: "TOR-900", name: "Tornillo hexagonal", unitPrice: "0.25", ivaRateCode: "4" };
    const draft = {
      ...newDraft(),
      customerId: CUSTOMER.id,
      customerName: "María Pérez",
      lines: [{ productId: SCREW.id, quantity: "100", unitPrice: "0.25", discount: "0.00" }],
    };
    saveDraft(TENANT_ID, draft);
    route.search = `?borrador=${draft.id}`;
    stubApi({ ...routes(() => json(202, ISSUED)), "GET /products/:id": () => json(200, SCREW) });
    renderWithTenant(<NuevaFacturaPage />);

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Producto de la línea 1" })).toHaveValue("Tornillo hexagonal (TOR-900)"));
    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("28.75"));
    expect(screen.getByRole("button", { name: "Emitir factura" })).toBeEnabled();
  });

  it("sends amounts without the spaces a paste may bring", async () => {
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();
    await userEvent.type(screen.getByLabelText("Cantidad de la línea 1"), " ");
    await userEvent.type(screen.getByLabelText("Descuento de la línea 1"), " ");

    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));

    await waitFor(() => expect(stub.to("POST", "/invoices")).toHaveLength(1));
    const body = stub.to("POST", "/invoices")[0]?.body as { lines: Record<string, string>[]; payments: Record<string, string>[] };
    expect(body.lines[0]).toMatchObject({ quantity: "2", unitPrice: "10.00", discount: "0.00" });
    expect(body.payments[0]?.amount).toBe("23.00");
  });

  it("says which part of the invoice the server rejected", async () => {
    api(() =>
      problem(400, "VALIDATION_FAILED", undefined, [
        { field: "lines[1].quantity", message: "debe tener como máximo 6 decimales" },
        { field: "payments[0].amount", message: "no es un importe válido" },
      ]),
    );
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();

    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Línea 2, cantidad: debe tener como máximo 6 decimales");
    expect(alert).toHaveTextContent("Pago, importe: no es un importe válido");
  });

  it("says what is missing while the invoice cannot be issued yet", async () => {
    api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);
    const button = await screen.findByRole("button", { name: "Emitir factura" });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/elegir un cliente/);
    expect(button).toHaveAccessibleDescription(/completar el detalle/);

    await fillInvoice();

    await waitFor(() => expect(button).toBeEnabled());
    expect(button).not.toHaveAccessibleDescription(/elegir un cliente/);
  });

  it("returns to this draft after signing in again, wherever the session ended", async () => {
    const draft = { ...newDraft(), customerId: CUSTOMER.id, customerName: "María Pérez" };
    saveDraft(TENANT_ID, draft);
    route.search = `?borrador=${draft.id}`;
    stubApi({ ...routes(() => json(202, ISSUED)), "GET /customers": () => problem(401, "UNAUTHENTICATED") });
    renderWithTenant(<NuevaFacturaPage />);

    await userEvent.click(await screen.findByRole("combobox", { name: "Cliente" }));
    const link = await screen.findByRole("link", { name: "Iniciar sesión" });
    expect(link).toHaveAttribute("href", `/ingresar?volver=${encodeURIComponent(`/facturas/nueva?borrador=${draft.id}`)}`);
  });

  it("says which rejected invoice the draft replaces and tells the server when issuing", async () => {
    const REJECTED = "abababab-abab-4bab-8bab-abababababab";
    const draft = {
      ...newDraft(),
      customerId: CUSTOMER.id,
      customerName: "María Pérez",
      lines: [{ productId: SERVICE.id, quantity: "2", unitPrice: "10", discount: "0.00" }],
      replacesDocumentId: REJECTED,
    };
    saveDraft(TENANT_ID, draft);
    route.search = `?borrador=${draft.id}`;
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);

    expect(await screen.findByRole("link", { name: "un comprobante que el SRI rechazó" })).toHaveAttribute("href", `/documentos/${REJECTED}`);
    await waitFor(() => expect(screen.getByRole("button", { name: "Emitir factura" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));

    await waitFor(() => expect(stub.to("POST", "/invoices")).toHaveLength(1));
    expect((stub.to("POST", "/invoices")[0]?.body as Record<string, unknown>).replacesDocumentId).toBe(REJECTED);
  });

  it("sends no replacement for an ordinary invoice", async () => {
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);
    await fillInvoice();

    await userEvent.click(screen.getByRole("button", { name: "Emitir factura" }));

    await waitFor(() => expect(stub.to("POST", "/invoices")).toHaveLength(1));
    expect(stub.to("POST", "/invoices")[0]?.body).not.toHaveProperty("replacesDocumentId");
  });

  it("says so when what is being typed cannot be kept as a draft", async () => {
    for (let i = 0; i < 50; i++) {
      saveDraft(TENANT_ID, newDraft());
    }
    api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />);

    await fillInvoice();

    expect(await screen.findByText(/no se está guardando como borrador/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "descarte borradores" })).toHaveAttribute("href", "/facturas/borradores");
    // Emitir sigue siendo posible.
    expect(screen.getByRole("button", { name: "Emitir factura" })).toBeEnabled();
  });

  it("is not offered to a role that cannot issue", () => {
    api(() => json(202, ISSUED));
    renderWithTenant(<NuevaFacturaPage />, { role: "AUDITOR" });

    expect(screen.getByText("Su rol en esta empresa no permite emitir facturas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Emitir factura" })).not.toBeInTheDocument();
  });
});
