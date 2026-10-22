import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { route, router } from "@/test/navigation";
import { renderWithTenant } from "@/test/render";

import NuevaNotaPage from "../debit-notes/new/page";

const TAXPAYER = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ruc: "1790012345001", legalName: "Comercial Andina S.A.", headOfficeAddress: "Quito", defaultEnvironment: "1" };
const ESTABLISHMENT = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", taxpayerId: TAXPAYER.id, code: "001", address: "Quito" };
const POINT = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", establishmentId: ESTABLISHMENT.id, code: "002", enabled: true };
const CUSTOMER = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", idType: "05", idNumber: "1712345678", name: "María Pérez" };
const INVOICE_ID = "12121212-1212-4121-8121-121212121212";
const ISSUED = { id: "99999999-9999-4999-8999-999999999999", state: "RESERVED", statusUrl: "/api/v1/documents/99999999-9999-4999-8999-999999999999" };

function invoice() {
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
    subtotal: "20.00",
    totalDiscount: "0.00",
    taxes: [],
    totalTax: "3.00",
    total: "23.00",
    lines: [],
    payments: [{ methodCode: "20", amount: "23.00" }],
  };
}

function api(issue: Parameters<typeof stubApi>[0][string] = () => json(202, ISSUED)) {
  return stubApi({
    "GET /taxpayers": () => json(200, [TAXPAYER]),
    "GET /taxpayers/:id/establishments": () => json(200, [ESTABLISHMENT]),
    "GET /emission-points": () => json(200, [POINT]),
    "GET /documents/:id": () => json(200, invoice()),
    "GET /customers": () => json(200, { items: [CUSTOMER], page: 0, size: 20, total: 1 }),
    "GET /catalogs/tax-rates": () =>
      json(200, [
        { taxCode: "2", rateCode: "0", description: "0%", rate: "0.00" },
        { taxCode: "2", rateCode: "4", description: "15%", rate: "15.00" },
      ]),
    "GET /catalogs/payment-methods": () =>
      json(200, [
        { code: "01", name: "SIN UTILIZACION DEL SISTEMA FINANCIERO", validFrom: "2013-01-01" },
        { code: "20", name: "OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO", validFrom: "2016-06-01" },
      ]),
    "POST /debit-notes": issue,
  });
}

function emitButton() {
  return screen.getByRole("button", { name: "Emitir nota de débito" });
}

/** Escribe la razón y el valor de la fila `row` (1 es la primera). */
async function fillReason(row: number, reason: string, value: string) {
  const reasonInput = await screen.findByLabelText(`Razón del motivo ${row}`);
  await userEvent.clear(reasonInput);
  await userEvent.type(reasonInput, reason);
  const valueInput = screen.getByLabelText(`Valor del motivo ${row}`);
  await userEvent.clear(valueInput);
  await userEvent.type(valueInput, value);
}

describe("Nota de débito", () => {
  it("previewGroupsTaxByRate", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    api();
    renderWithTenant(<NuevaNotaPage />);
    await fillReason(1, "Intereses de mora", "10.00");
    await userEvent.click(screen.getByRole("button", { name: "Agregar motivo" }));
    await fillReason(2, "Gastos de cobranza", "3.00");
    await userEvent.selectOptions(screen.getByLabelText("Tarifa de IVA del motivo 2"), "0");

    // La tarifa del 15 % es la de cada motivo nuevo.
    expect(screen.getByLabelText("Tarifa de IVA del motivo 1")).toHaveValue("4");
    expect(screen.getByText("Subtotal sin impuestos").nextSibling).toHaveTextContent("13.00");
    expect(screen.getByText("IVA 15%").nextSibling).toHaveTextContent("1.50");
    expect(screen.getByTestId("total")).toHaveTextContent("14.50");
    // El importe pagado se completa con el total.
    expect(screen.getByLabelText("Importe pagado")).toHaveValue("14.50");
  });

  it("addAndRemoveReasons", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    api();
    renderWithTenant(<NuevaNotaPage />);
    const add = await screen.findByRole("button", { name: "Agregar motivo" });
    expect(screen.getByRole("button", { name: "Quitar el motivo 1" })).toBeDisabled();

    for (let count = 1; count < 20; count++) {
      await userEvent.click(add);
    }
    expect(screen.getByLabelText("Razón del motivo 20")).toBeInTheDocument();
    expect(add).toBeDisabled();

    await fillReason(2, "Segundo", "1.00");
    await userEvent.click(screen.getByRole("button", { name: "Quitar el motivo 1" }));
    expect(screen.queryByLabelText("Razón del motivo 20")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Razón del motivo 1")).toHaveValue("Segundo");
    expect(add).toBeEnabled();
  });

  it("emitsReasonsAndPayment", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    const stub = api();
    renderWithTenant(<NuevaNotaPage />);
    await fillReason(1, "Intereses de mora", "10.00");
    await userEvent.click(screen.getByRole("button", { name: "Agregar motivo" }));
    await fillReason(2, "Gastos de cobranza", "3.00");
    await userEvent.selectOptions(screen.getByLabelText("Tarifa de IVA del motivo 2"), "0");
    await userEvent.selectOptions(screen.getByLabelText("Forma de pago"), "20");

    await userEvent.dblClick(emitButton());

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/documents/${ISSUED.id}`));
    expect(stub.to("POST", "/debit-notes")).toHaveLength(1);
    const call = stub.to("POST", "/debit-notes")[0]!;
    expect(call.headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(call.body).toEqual({
      taxpayerId: TAXPAYER.id,
      establishmentCode: "001",
      emissionPointCode: "002",
      invoiceId: INVOICE_ID,
      reasons: [
        { reason: "Intereses de mora", value: "10.00", ivaRateCode: "4" },
        { reason: "Gastos de cobranza", value: "3.00", ivaRateCode: "0" },
      ],
      payments: [{ methodCode: "20", amount: "14.50" }],
    });
  });

  it("emitsOnAHandWrittenInvoice", async () => {
    route.search = "";
    const stub = api();
    renderWithTenant(<NuevaNotaPage />);
    await userEvent.type(await screen.findByLabelText("Número de la factura"), "001001000000123");
    fireEvent.change(screen.getByLabelText("Fecha de la factura"), { target: { value: "2026-10-01" } });
    await userEvent.click(screen.getByRole("combobox", { name: "Cliente" }));
    await userEvent.click(await screen.findByRole("option", { name: /María Pérez/ }));
    await fillReason(1, "Intereses", "10.00");

    await userEvent.click(emitButton());

    await waitFor(() => expect(stub.to("POST", "/debit-notes")).toHaveLength(1));
    expect(stub.to("POST", "/debit-notes")[0]?.body).toEqual({
      taxpayerId: TAXPAYER.id,
      establishmentCode: "001",
      emissionPointCode: "002",
      modifiedDocument: { code: "01", number: "001-001-000000123", issueDate: "2026-10-01" },
      customerId: CUSTOMER.id,
      reasons: [{ reason: "Intereses", value: "10.00", ivaRateCode: "4" }],
      payments: [{ methodCode: "01", amount: "11.50" }],
    });
  });

  it("sendsThePaymentTermWithItsUnit", async () => {
    route.search = "";
    const stub = api();
    renderWithTenant(<NuevaNotaPage />);
    await userEvent.type(await screen.findByLabelText("Número de la factura"), "001001000000123");
    fireEvent.change(screen.getByLabelText("Fecha de la factura"), { target: { value: "2026-10-01" } });
    await userEvent.click(screen.getByRole("combobox", { name: "Cliente" }));
    await userEvent.click(await screen.findByRole("option", { name: /María Pérez/ }));
    await fillReason(1, "Intereses", "10.00");
    await userEvent.type(screen.getByLabelText("Plazo"), "15");

    await userEvent.click(emitButton());

    await waitFor(() => expect(stub.to("POST", "/debit-notes")).toHaveLength(1));
    expect((stub.to("POST", "/debit-notes")[0]?.body as { payments: unknown[] }).payments).toEqual([
      { methodCode: "01", amount: "11.50", term: "15", timeUnit: "dias" },
    ]);
  });

  it("emitDisabledUntilComplete", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    api();
    renderWithTenant(<NuevaNotaPage />);
    await screen.findByLabelText("Razón del motivo 1");
    expect(emitButton()).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Razón del motivo 1"), "Intereses");
    expect(emitButton()).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Valor del motivo 1"), "5.00");
    await waitFor(() => expect(emitButton()).toBeEnabled());

    await userEvent.clear(screen.getByLabelText("Razón del motivo 1"));
    expect(emitButton()).toBeDisabled();
  });

  it("paymentMustEqualTheTotal", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    const stub = api();
    renderWithTenant(<NuevaNotaPage />);
    await fillReason(1, "Intereses", "10.00");
    const paid = screen.getByLabelText("Importe pagado");
    await userEvent.clear(paid);
    await userEvent.type(paid, "10.00");

    expect(paid).toHaveAccessibleDescription(/El pago debe sumar 11.50/);
    expect(emitButton()).toBeDisabled();
    expect(stub.to("POST", "/debit-notes")).toHaveLength(0);
  });

  it("showsApiProblem", async () => {
    route.search = `?factura=${INVOICE_ID}`;
    api(() => problem(422, "MODIFIED_INVOICE_NOT_AUTHORIZED", "La factura que se modifica no está autorizada."));
    renderWithTenant(<NuevaNotaPage />);
    await fillReason(1, "Intereses", "10.00");

    await userEvent.click(emitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("La factura que se modifica no está autorizada.");
    expect(router.push).not.toHaveBeenCalled();
  });
});
