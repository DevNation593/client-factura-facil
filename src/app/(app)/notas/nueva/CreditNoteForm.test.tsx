import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { route, router } from "@/test/navigation";
import { renderWithTenant } from "@/test/render";

import NuevaNotaPage from "./page";

const TAXPAYER = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ruc: "1790012345001", legalName: "Comercial Andina S.A.", headOfficeAddress: "Quito", defaultEnvironment: "1" };
const ESTABLISHMENT = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", taxpayerId: TAXPAYER.id, code: "001", address: "Quito" };
const POINT = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", establishmentId: ESTABLISHMENT.id, code: "002", enabled: true };
const CUSTOMER = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", idType: "05", idNumber: "1712345678", name: "María Pérez" };
const SERVICE = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", sku: "SRV-001", name: "Servicio de consultoría", unitPrice: "10.000000", ivaRateCode: "4" };
const INVOICE_ID = "12121212-1212-4121-8121-121212121212";
const ISSUED = { id: "99999999-9999-4999-8999-999999999999", state: "RESERVED", statusUrl: "/api/v1/documents/99999999-9999-4999-8999-999999999999" };

/** Factura autorizada: 2 servicios (20.00 + 3.00 de IVA) y 3 libros con 1.50 de descuento (26.50, sin IVA). */
function invoice(extra: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    documentType: "01",
    state: "AUTHORIZED",
    environment: "1",
    taxpayerId: TAXPAYER.id,
    number: "001-002-000000123",
    sequence: "000000123",
    accessKey: "0710202601179001234500110010020000001231234567816",
    issueDate: "2026-10-07",
    currency: "USD",
    customer: { idType: "05", idNumber: "1712345678", name: "María Pérez" },
    subtotal: "46.50",
    totalDiscount: "1.50",
    taxes: [
      { taxCode: "2", rateCode: "0", rate: "0.00", base: "26.50", amount: "0.00" },
      { taxCode: "2", rateCode: "4", rate: "15.00", base: "20.00", amount: "3.00" },
    ],
    totalTax: "3.00",
    total: "49.50",
    lines: [
      {
        lineNo: 1,
        productId: SERVICE.id,
        mainCode: "SRV-001",
        description: "Servicio de consultoría",
        quantity: "2.000000",
        unitPrice: "10.000000",
        discount: "0.00",
        subtotal: "20.00",
        taxCode: "2",
        taxRateCode: "4",
        taxRate: "15.00",
        taxAmount: "3.00",
      },
      {
        lineNo: 2,
        mainCode: "LIB-001",
        description: "Libro",
        quantity: "3.000000",
        unitPrice: "9.333333",
        discount: "1.50",
        subtotal: "26.50",
        taxCode: "2",
        taxRateCode: "0",
        taxRate: "0.00",
        taxAmount: "0.00",
      },
    ],
    payments: [{ methodCode: "20", amount: "49.50" }],
    authorizationNumber: "0710202601179001234500110010020000001231234567816",
    authorizedAt: "2026-10-07T15:00:00Z",
    creditedTotal: "5.00",
    ...extra,
  };
}

type Handler = Parameters<typeof stubApi>[0][string];

function api(issue: Handler, document: unknown = invoice()) {
  return stubApi({
    "GET /taxpayers": () => json(200, [TAXPAYER]),
    "GET /taxpayers/:id/establishments": () => json(200, [ESTABLISHMENT]),
    "GET /emission-points": () => json(200, [POINT]),
    "GET /documents/:id": () => json(200, document),
    "GET /customers": () => json(200, { items: [CUSTOMER], page: 0, size: 20, total: 1 }),
    "GET /products": () => json(200, { items: [SERVICE], page: 0, size: 20, total: 1 }),
    "GET /catalogs/tax-rates": () =>
      json(200, [
        { taxCode: "2", rateCode: "4", description: "15%", rate: "15.00" },
        { taxCode: "2", rateCode: "0", description: "0%", rate: "0.00" },
      ]),
    "POST /credit-notes": issue,
  });
}

function emitButton() {
  return screen.getByRole("button", { name: "Emitir nota de crédito" });
}

describe("Nota de crédito", () => {
  it("withInvoiceShowsItsLinesAndBalance", async () => {
    route.search = `?tipo=credito&factura=${INVOICE_ID}`;
    api(() => json(202, ISSUED));
    renderWithTenant(<NuevaNotaPage />);

    expect(await screen.findByText("Saldo disponible $44.50")).toBeInTheDocument();
    expect(screen.getByText("María Pérez (1712345678)")).toBeInTheDocument();
    expect(screen.getByText("Factura 001-002-000000123 del 07/10/2026")).toBeInTheDocument();
    // El comprador es el de la factura: no se elige otro.
    expect(screen.queryByRole("combobox", { name: "Cliente" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Acreditar la línea 1: Servicio de consultoría" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Acreditar la línea 2: Libro" })).not.toBeChecked();
    expect(screen.getByLabelText("Cantidad de la línea 2")).toHaveValue("3");
    expect(screen.getByLabelText("Precio unitario de la línea 2")).toHaveValue("9.333333");
    expect(screen.getByLabelText("Descuento de la línea 2")).toHaveValue("1.50");
    expect(emitButton()).toBeDisabled();
  });

  it("capsQuantityAndPrice", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaNotaPage />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /Acreditar la línea 1/ }));
    await userEvent.type(screen.getByLabelText("Motivo"), "Devolución");
    await waitFor(() => expect(emitButton()).toBeEnabled());

    const quantity = screen.getByLabelText("Cantidad de la línea 1");
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "3");
    expect(quantity).toHaveAccessibleDescription("No puede superar la cantidad facturada (2)");
    expect(emitButton()).toBeDisabled();

    await userEvent.clear(quantity);
    await userEvent.type(quantity, "2");
    const price = screen.getByLabelText("Precio unitario de la línea 1");
    await userEvent.clear(price);
    await userEvent.type(price, "10.01");
    expect(price).toHaveAccessibleDescription("No puede superar el precio facturado (10.00)");
    expect(emitButton()).toBeDisabled();
    await userEvent.click(emitButton());
    expect(stub.to("POST", "/credit-notes")).toHaveLength(0);
  });

  it("noBalanceDisablesEmit", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    api(() => json(202, ISSUED), invoice({ creditedTotal: "49.50" }));
    renderWithTenant(<NuevaNotaPage />);

    expect(await screen.findByText("Saldo disponible $0.00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Acreditar la línea 1/ }));
    await userEvent.type(screen.getByLabelText("Motivo"), "Devolución");

    expect(emitButton()).toBeDisabled();
    expect(emitButton()).toHaveAccessibleDescription(/no superar el saldo disponible/);
  });

  it("emitsWithInvoiceLineNumbers", async () => {
    route.search = `?tipo=credito&factura=${INVOICE_ID}`;
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaNotaPage />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /Acreditar la línea 2/ }));
    const quantity = screen.getByLabelText("Cantidad de la línea 2");
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "1");
    // El descuento se prorratea con la cantidad: 1.50 × 1 / 3.
    expect(screen.getByLabelText("Descuento de la línea 2")).toHaveValue("0.50");
    expect(screen.getByTestId("total")).toHaveTextContent("8.83");
    await userEvent.type(screen.getByLabelText("Motivo"), "Devolución de un libro");

    await userEvent.dblClick(emitButton());

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/documentos/${ISSUED.id}`));
    expect(stub.to("POST", "/credit-notes")).toHaveLength(1);
    const call = stub.to("POST", "/credit-notes")[0]!;
    expect(call.headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(call.body).toEqual({
      taxpayerId: TAXPAYER.id,
      establishmentCode: "001",
      emissionPointCode: "002",
      reason: "Devolución de un libro",
      invoiceId: INVOICE_ID,
      lines: [{ invoiceLineNo: 2, quantity: "1", unitPrice: "9.333333", discount: "0.50" }],
    });
  });

  it("manualModeAsksForInvoiceNumberAndCustomer", async () => {
    route.search = "?tipo=credito";
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaNotaPage />);

    const notice = await screen.findByText(/¿La factura se emitió aquí\?/);
    expect(notice).toHaveTextContent("¿La factura se emitió aquí? Ábrela desde Comprobantes");
    expect(within(notice).getByRole("link", { name: "Ábrela desde Comprobantes" })).toHaveAttribute("href", "/documentos");

    const number = screen.getByLabelText("Número de la factura");
    await userEvent.type(number, "001-001-123");
    expect(number).toHaveAccessibleDescription(/EEE-PPP-SSSSSSSSS/);
    expect(number).toHaveAccessibleDescription(/Escriba el número completo/);
    await userEvent.clear(number);
    await userEvent.type(number, "001-001-000000123");
    expect(number).not.toHaveAccessibleDescription(/Escriba el número completo/);
    fireEvent.change(screen.getByLabelText("Fecha de la factura"), { target: { value: "2026-10-01" } });
    await userEvent.click(screen.getByRole("combobox", { name: "Cliente" }));
    await userEvent.click(await screen.findByRole("option", { name: /María Pérez/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Producto de la línea 1" }));
    await userEvent.click(await screen.findByRole("option", { name: /Servicio de consultoría/ }));
    const quantity = screen.getByLabelText("Cantidad de la línea 1");
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "2");
    await userEvent.type(screen.getByLabelText("Motivo"), "Descuento posterior");
    expect(screen.getByTestId("total")).toHaveTextContent("23.00");

    await userEvent.click(emitButton());

    await waitFor(() => expect(stub.to("POST", "/credit-notes")).toHaveLength(1));
    expect(stub.to("POST", "/credit-notes")[0]?.body).toEqual({
      taxpayerId: TAXPAYER.id,
      establishmentCode: "001",
      emissionPointCode: "002",
      reason: "Descuento posterior",
      modifiedDocument: { code: "01", number: "001-001-000000123", issueDate: "2026-10-01" },
      customerId: CUSTOMER.id,
      lines: [{ productId: SERVICE.id, quantity: "2", unitPrice: "10.00", discount: "0.00" }],
    });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/documentos/${ISSUED.id}`));
  });

  it("acceptsTheInvoiceNumberWithOrWithoutHyphens", async () => {
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaNotaPage />);
    const number = await screen.findByLabelText("Número de la factura");
    // Se puede escribir con el teclado numérico del teléfono, que no tiene guion.
    expect(number).toHaveAttribute("inputmode", "numeric");
    fireEvent.change(screen.getByLabelText("Fecha de la factura"), { target: { value: "2026-10-01" } });
    await userEvent.click(screen.getByRole("combobox", { name: "Cliente" }));
    await userEvent.click(await screen.findByRole("option", { name: /María Pérez/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Producto de la línea 1" }));
    await userEvent.click(await screen.findByRole("option", { name: /Servicio de consultoría/ }));
    await userEvent.type(screen.getByLabelText("Motivo"), "Descuento posterior");

    // Un número inválido no deja emitir.
    await userEvent.type(number, "00100100000012");
    await userEvent.tab();
    expect(number).toHaveValue("00100100000012");
    expect(number).toHaveAccessibleDescription(/Escriba el número completo/);
    expect(emitButton()).toBeDisabled();

    // Los quince dígitos solos valen, y al salir del campo se muestran con sus guiones.
    await userEvent.clear(number);
    await userEvent.type(number, "001001000000123");
    expect(emitButton()).toBeEnabled();
    await userEvent.tab();
    expect(number).toHaveValue("001-001-000000123");
    await userEvent.click(emitButton());
    await waitFor(() => expect(stub.to("POST", "/credit-notes")).toHaveLength(1));
    expect((stub.to("POST", "/credit-notes")[0]?.body as { modifiedDocument: { number: string } }).modifiedDocument.number).toBe("001-001-000000123");
  });

  it("acceptsTheHyphenatedInvoiceNumber", async () => {
    const stub = api(() => json(202, ISSUED));
    renderWithTenant(<NuevaNotaPage />);
    await userEvent.type(await screen.findByLabelText("Número de la factura"), "002-003-000000045");
    fireEvent.change(screen.getByLabelText("Fecha de la factura"), { target: { value: "2026-10-01" } });
    await userEvent.click(screen.getByRole("combobox", { name: "Cliente" }));
    await userEvent.click(await screen.findByRole("option", { name: /María Pérez/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Producto de la línea 1" }));
    await userEvent.click(await screen.findByRole("option", { name: /Servicio de consultoría/ }));
    await userEvent.type(screen.getByLabelText("Motivo"), "Descuento posterior");

    await userEvent.click(emitButton());

    await waitFor(() => expect(stub.to("POST", "/credit-notes")).toHaveLength(1));
    expect((stub.to("POST", "/credit-notes")[0]?.body as { modifiedDocument: { number: string } }).modifiedDocument.number).toBe("002-003-000000045");
  });

  it("showsApiProblem", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    const stub = api(() => problem(422, "CREDIT_EXCEEDS_INVOICE", "Con las notas de crédito vigentes se superaría el total de la factura (49.50)."));
    renderWithTenant(<NuevaNotaPage />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /Acreditar la línea 1/ }));
    await userEvent.type(screen.getByLabelText("Motivo"), "Devolución");

    await userEvent.click(emitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Con las notas de crédito vigentes se superaría el total de la factura (49.50).");
    expect(router.push).not.toHaveBeenCalled();
    // Un reintento usa la misma clave.
    await userEvent.click(emitButton());
    await waitFor(() => expect(stub.to("POST", "/credit-notes")).toHaveLength(2));
    const [first, second] = stub.to("POST", "/credit-notes");
    expect(second?.headers.get("Idempotency-Key")).toBe(first?.headers.get("Idempotency-Key"));
  });

  it("does not offer an invoice that is not authorized", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    api(() => json(202, ISSUED), invoice({ state: "RETURNED" }));
    renderWithTenant(<NuevaNotaPage />);

    expect(await screen.findByText(/Solo se puede emitir una nota sobre una factura autorizada/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Emitir nota de crédito" })).not.toBeInTheDocument();
  });

  it("says which part of the note the server rejected", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    api(() => problem(400, "VALIDATION_FAILED", undefined, [{ field: "lines[0].quantity", message: "debe tener como máximo 6 decimales" }]));
    renderWithTenant(<NuevaNotaPage />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /Acreditar la línea 1/ }));
    await userEvent.type(screen.getByLabelText("Motivo"), "Devolución");

    await userEvent.click(emitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Línea 1, cantidad: debe tener como máximo 6 decimales");
  });
});
