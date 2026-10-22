import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { listDrafts } from "@/lib/drafts";
import { route, router } from "@/test/navigation";
import { renderWithTenant, TENANT_ID } from "@/test/render";

import DocumentoPage from "./page";

const ID = "99999999-9999-4999-8999-999999999999";
const KEY = "0710202601179001234500110010020000001231234567816";

function invoice(state: string, extra: Record<string, unknown> = {}) {
  return {
    id: ID,
    documentType: "01",
    state,
    environment: "1",
    taxpayerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    number: "001-002-000000123",
    sequence: "000000123",
    accessKey: KEY,
    issueDate: "2026-10-07",
    currency: "USD",
    customer: { idType: "05", idNumber: "1712345678", name: "María Pérez" },
    subtotal: "20.00",
    totalDiscount: "0.00",
    taxes: [{ taxCode: "2", rateCode: "4", rate: "15.00", base: "20.00", amount: "3.00" }],
    totalTax: "3.00",
    total: "23.00",
    lines: [
      {
        lineNo: 1,
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
    ],
    payments: [{ methodCode: "20", amount: "23.00" }],
    authorizationNumber: null,
    authorizedAt: null,
    ...extra,
  };
}

type Handler = Parameters<typeof stubApi>[0][string];

function api(document: unknown, extra: Record<string, Handler> = {}) {
  return stubApi({
    "GET /documents/:id": () => json(200, document),
    "GET /documents/:id/sri-attempts": () => json(200, []),
    "GET /documents/:id/deliveries": () => json(200, []),
    ...extra,
  });
}

beforeEach(() => {
  route.params = { id: ID };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Comprobante", () => {
  it("shows the SRI's messages of a returned invoice", async () => {
    api(invoice("RETURNED"), {
      "GET /documents/:id/sri-attempts": () =>
        json(200, [
          {
            id: "11111111-1111-4111-8111-111111111111",
            operation: "RECEPTION",
            outcome: "RETURNED",
            sriStatus: "DEVUELTA",
            httpStatus: 200,
            startedAt: "2026-10-07T15:00:00Z",
            completedAt: "2026-10-07T15:00:01Z",
            messages: [{ identifier: "35", message: "DOCUMENTO INVÁLIDO", additionalInfo: "Falta el campo totalSinImpuestos", type: "ERROR" }],
          },
        ]),
    });
    renderWithTenant(<DocumentoPage />);

    expect(await screen.findByRole("heading", { name: "Factura 001-002-000000123" })).toBeInTheDocument();
    expect(screen.getAllByText("Devuelta por el SRI").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/No tiene validez tributaria/)).toBeInTheDocument();
    const row = (await screen.findByText("Recepción")).closest("tr")!;
    expect(within(row).getByText(/Devuelta \(DEVUELTA\)/)).toBeInTheDocument();
    expect(within(row).getByText("35 DOCUMENTO INVÁLIDO")).toBeInTheDocument();
    expect(within(row).getByText(/Falta el campo totalSinImpuestos/)).toBeInTheDocument();
    expect(screen.getByText(KEY)).toBeInTheDocument();
    // La línea llega con seis decimales ("2.000000", "10.000000") y se muestra sin ceros de más.
    const line = screen.getByRole("row", { name: /SRV-001/ });
    expect(within(line).getByRole("cell", { name: "2" })).toBeInTheDocument();
    expect(within(line).getByRole("cell", { name: "10.00" })).toBeInTheDocument();
    // Un rechazo del SRI no se reintenta tal cual.
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("offers a retry only when the document can be retried", async () => {
    let state = "SIGNATURE_FAILED";
    const stub = api(null, {
      "GET /documents/:id": () => json(200, invoice(state)),
      "POST /documents/:id/retry": () => {
        state = "SIGNED";
        return json(202, { id: ID, state: "SIGNATURE_FAILED" });
      },
    });
    renderWithTenant(<DocumentoPage />);
    expect(await screen.findByText(/Revise que el emisor tenga un certificado vigente/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText(/Reintento solicitado/)).toBeInTheDocument();
    expect(stub.to("POST", `/documents/${ID}/retry`)).toHaveLength(1);
    expect(stub.to("POST", `/documents/${ID}/retry`)[0]?.headers.get("X-Requested-With")).toBe("einvoice-web");
    // Tras pedirlo, la hoja se vuelve a cargar y refleja el nuevo estado.
    expect((await screen.findAllByText("Firmada")).length).toBeGreaterThanOrEqual(1);
  });

  it("keeps refreshing after a retry until the worker has moved the document", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Como en la realidad: el reintento se acepta al instante y el worker lo procesa un poco después.
    let state = "SIGNATURE_FAILED";
    const stub = api(null, {
      "GET /documents/:id": () => json(200, invoice(state)),
      "POST /documents/:id/retry": () => json(202, { id: ID, state: "SIGNATURE_FAILED" }),
    });
    renderWithTenant(<DocumentoPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(/Reintento solicitado/)).toBeInTheDocument();
    // Sin firmar es un estado en reposo: sin el reintento, la hoja no se refrescaría sola.
    expect(screen.getAllByText("Sin firmar").length).toBeGreaterThanOrEqual(1);

    state = "SIGNED";
    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect((await screen.findAllByText("Firmada")).length).toBeGreaterThanOrEqual(1);
    // Y si después ya no cambia nada, la vigilancia termina sola al cabo de un minuto. Se avanza de
    // cinco en cinco segundos para que React vuelva a pintar entre un refresco y el siguiente.
    state = "SIGNATURE_FAILED";
    for (let step = 0; step < 14; step++) {
      await act(() => vi.advanceTimersByTimeAsync(5000));
    }
    const settled = stub.to("GET", `/documents/${ID}`).length;
    for (let step = 0; step < 6; step++) {
      await act(() => vi.advanceTimersByTimeAsync(5000));
    }
    expect(stub.to("GET", `/documents/${ID}`).length).toBe(settled);
    // Entre el reintento y el final de la vigilancia hubo como mucho un refresco cada cinco segundos.
    expect(settled).toBeLessThanOrEqual(16);
  });

  it("explains when the retry is refused", async () => {
    api(invoice("RECEIVED"), { "POST /documents/:id/retry": () => problem(409, "DOCUMENT_NOT_RETRYABLE") });
    renderWithTenant(<DocumentoPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Este comprobante ya no admite reintento.");
  });

  it("resends by email to the customer or to another address", async () => {
    const stub = api(invoice("AUTHORIZED", { authorizationNumber: KEY, authorizedAt: "2026-10-07T20:15:30Z" }), {
      "GET /documents/:id/deliveries": () =>
        json(200, [
          { id: "22222222-2222-4222-8222-222222222222", channel: "EMAIL", recipient: "maria@example.test", status: "SENT", attemptCount: 1, lastError: null, createdAt: "2026-10-07T20:16:00Z", sentAt: "2026-10-07T20:16:02Z", automatic: true },
          { id: "33333333-3333-4333-8333-333333333333", channel: "EMAIL", recipient: "malo@example.test", status: "FAILED", attemptCount: 1, lastError: "SMTP 550: buzón inexistente", createdAt: "2026-10-07T20:17:00Z", sentAt: null, automatic: false },
        ]),
      "POST /documents/:id/deliveries": (call) =>
        json(202, { id: "44444444-4444-4444-8444-444444444444", channel: "EMAIL", recipient: (call.body as { email?: string }).email ?? "maria@example.test", status: "PENDING", attemptCount: 0, createdAt: "2026-10-07T20:20:00Z", automatic: false }),
    });
    renderWithTenant(<DocumentoPage />);

    expect(await screen.findByText("Aceptado por el servidor de correo")).toBeInTheDocument();
    expect(screen.getByText(/SMTP 550: buzón inexistente/)).toBeInTheDocument();
    expect(screen.getByText(/Autorizada por el SRI/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Enviar por correo" }));
    expect(await screen.findByText(/Envío solicitado a maria@example.test/)).toBeInTheDocument();
    expect(stub.to("POST", `/documents/${ID}/deliveries`)[0]?.body).toEqual({});

    await userEvent.type(screen.getByLabelText("Enviar a otra dirección"), "contabilidad@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Enviar por correo" }));
    expect(await screen.findByText(/Envío solicitado a contabilidad@example.test/)).toBeInTheDocument();
    expect(stub.to("POST", `/documents/${ID}/deliveries`)[1]?.body).toEqual({ email: "contabilidad@example.test" });
  });

  it("links only the files the document already has", async () => {
    api(invoice("AUTHORIZED", { authorizationNumber: KEY, authorizedAt: "2026-10-07T20:15:30Z" }));
    const { unmount } = renderWithTenant(<DocumentoPage />);

    expect(await screen.findByRole("link", { name: "RIDE (PDF)" })).toHaveAttribute("href", `/api/backend/documents/${ID}/artifacts/ride`);
    expect(screen.getByRole("link", { name: "XML autorizado" })).toHaveAttribute("href", `/api/backend/documents/${ID}/artifacts/xml-authorized`);
    expect(screen.getByRole("link", { name: "XML firmado" })).toBeInTheDocument();
    unmount();

    api(invoice("SIGNATURE_FAILED"));
    renderWithTenant(<DocumentoPage />);
    expect(await screen.findByRole("link", { name: "XML sin firmar" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "RIDE (PDF)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "XML firmado" })).not.toBeInTheDocument();
  });

  it("turns a rejected invoice into a draft that will replace it", async () => {
    const CUSTOMER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const PRODUCT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const rejected = invoice("RETURNED", { customerId: CUSTOMER, replacesDocumentId: null, replacedByDocumentId: null });
    rejected.lines = [{ ...rejected.lines[0]!, productId: PRODUCT, discount: "1.50" } as never];
    api(rejected);
    renderWithTenant(<DocumentoPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Corregir y emitir de nuevo" }));

    const draft = listDrafts(TENANT_ID)[0]!;
    expect(draft).toMatchObject({
      customerId: CUSTOMER,
      customerName: "María Pérez",
      replacesDocumentId: ID,
      // Tal como se escribirían a mano, sin los ceros de relleno.
      lines: [{ productId: PRODUCT, quantity: "2", unitPrice: "10", discount: "1.50" }],
    });
    expect(router.push).toHaveBeenCalledWith(`/documents/invoices/new?borrador=${draft.id}`);
  });

  it("offers that only for documents the SRI rejected and that have no replacement yet", async () => {
    for (const [state, extra] of [
      ["AUTHORIZED", {}],
      ["SIGNED", {}],
      ["NOT_AUTHORIZED", { replacedByDocumentId: "12121212-1212-4121-8121-121212121212" }],
    ] as const) {
      api(invoice(state, extra));
      const view = renderWithTenant(<DocumentoPage />);
      await screen.findByText(KEY);

      expect(screen.queryByRole("button", { name: "Corregir y emitir de nuevo" }), state).not.toBeInTheDocument();
      view.unmount();
    }

    api(invoice("NOT_AUTHORIZED"));
    renderWithTenant(<DocumentoPage />, { role: "AUDITOR" });
    await screen.findByText(KEY);
    expect(screen.queryByRole("button", { name: "Corregir y emitir de nuevo" })).not.toBeInTheDocument();
  });

  it("links a rejected invoice with the one that replaced it, both ways", async () => {
    const OTHER = "12121212-1212-4121-8121-121212121212";
    api(invoice("RETURNED", { replacedByDocumentId: OTHER }));
    const view = renderWithTenant(<DocumentoPage />);
    expect(await screen.findByRole("link", { name: "la factura que lo reemplazó" })).toHaveAttribute("href", `/documents/${OTHER}`);
    view.unmount();

    api(invoice("RESERVED", { replacesDocumentId: OTHER }));
    renderWithTenant(<DocumentoPage />);
    expect(await screen.findByRole("link", { name: "un comprobante que el SRI rechazó" })).toHaveAttribute("href", `/documents/${OTHER}`);
  });

  it("gives an auditor no actions", async () => {
    api(invoice("AUTHORIZED", { authorizationNumber: KEY, authorizedAt: "2026-10-07T20:15:30Z" }));
    const { unmount } = renderWithTenant(<DocumentoPage />, { role: "AUDITOR" });
    expect(await screen.findByRole("link", { name: "RIDE (PDF)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar por correo" })).not.toBeInTheDocument();
    unmount();

    api(invoice("SIGNATURE_FAILED"));
    renderWithTenant(<DocumentoPage />, { role: "AUDITOR" });
    await screen.findByRole("link", { name: "XML sin firmar" });
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("explains a document that does not exist in this tenant", async () => {
    stubApi({
      "GET /documents/:id": () => problem(404, "NOT_FOUND"),
      "GET /documents/:id/sri-attempts": () => problem(404, "NOT_FOUND"),
      "GET /documents/:id/deliveries": () => problem(404, "NOT_FOUND"),
    });
    renderWithTenant(<DocumentoPage />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se encontró ese comprobante en esta empresa."));
    expect(screen.getByRole("link", { name: "Volver a los comprobantes" })).toHaveAttribute("href", "/documents");
  });

  const INVOICE_ID = "55555555-5555-4555-8555-555555555555";

  function note(extra: Record<string, unknown>) {
    return invoice("AUTHORIZED", {
      number: "001-001-000000004",
      modifiedDocument: { code: "01", number: "001-001-000000123", issueDate: "2026-10-01", documentId: INVOICE_ID },
      ...extra,
    });
  }

  it("shows a credit note with the invoice it modifies, its reason and lines", async () => {
    api(
      note({
        documentType: "04",
                reason: "Devolución de mercadería",
        lines: [{ ...invoice("X").lines[0], invoiceLineNo: 1 }],
      }),
    );
    renderWithTenant(<DocumentoPage />);

    expect(await screen.findByRole("heading", { name: "Nota de crédito 001-001-000000004" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Factura 001-001-000000123" }).closest("p")).toHaveTextContent("Modifica a: Factura 001-001-000000123 del 01/10/2026");
    expect(screen.getByRole("link", { name: "Factura 001-001-000000123" })).toHaveAttribute("href", `/documents/${INVOICE_ID}`);
    expect(screen.getByText("Devolución de mercadería")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /SRV-001/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corregir y emitir de nuevo" })).not.toBeInTheDocument();
  });

  it("does not offer to reissue a rejected credit note", async () => {
    api(note({ documentType: "04", state: "RETURNED", reason: "x" }));
    renderWithTenant(<DocumentoPage />);

    await screen.findByRole("heading", { name: "Nota de crédito 001-001-000000004" });
    expect(screen.queryByRole("button", { name: "Corregir y emitir de nuevo" })).not.toBeInTheDocument();
  });

  it("shows a debit note's reasons and its payment method", async () => {
    api(
      note({
        documentType: "05",
        lines: [],
        reasons: [{ reason: "Intereses de mora", value: "10.00", taxRateCode: "4", taxRate: "15.00", taxAmount: "1.50" }],
        payments: [{ methodCode: "20", amount: "11.50" }],
        total: "11.50",
      }),
      { "GET /catalogs/payment-methods": () => json(200, [{ code: "20", name: "OTROS CON UTILIZACION DEL SISTEMA FINANCIERO", validFrom: "2020-01-01" }]) },
    );
    renderWithTenant(<DocumentoPage />);

    expect(await screen.findByRole("heading", { name: "Nota de débito 001-001-000000004" })).toBeInTheDocument();
    const row = screen.getByText("Intereses de mora").closest("tr")!;
    expect(within(row).getByText("10.00")).toBeInTheDocument();
    expect(within(row).getByText("1.50")).toBeInTheDocument();
    expect(await screen.findByText(/Otros con utilización del sistema financiero/i)).toBeInTheDocument();
  });

  it("offers credit and debit notes on an authorized invoice, with what was already credited", async () => {
    api(invoice("AUTHORIZED", { creditedTotal: "5.00" }));
    renderWithTenant(<DocumentoPage />);

    expect(await screen.findByText("Acreditado $5.00 de $23.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nota de crédito" })).toHaveAttribute("href", `/documents/credit-notes/new?factura=${ID}`);
    expect(screen.getByRole("link", { name: "Nota de débito" })).toHaveAttribute("href", `/documents/debit-notes/new?factura=${ID}`);
  });

  it("does not offer notes on an unauthorized invoice or to someone who cannot bill", async () => {
    api(invoice("RETURNED", { creditedTotal: "0.00" }));
    const { unmount } = renderWithTenant(<DocumentoPage />);
    await screen.findByRole("heading", { name: "Factura 001-002-000000123" });
    expect(screen.queryByRole("link", { name: "Nota de crédito" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nota de débito" })).not.toBeInTheDocument();
    unmount();

    api(invoice("AUTHORIZED", { creditedTotal: "0.00" }));
    renderWithTenant(<DocumentoPage />, { role: "AUDITOR" });
    await screen.findByRole("heading", { name: "Factura 001-002-000000123" });
    expect(screen.queryByRole("link", { name: "Nota de crédito" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nota de débito" })).not.toBeInTheDocument();
  });
});
