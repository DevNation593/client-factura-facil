import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { json, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import DocumentosPage from "./page";

function summary(index: number, state: string) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    documentType: "01",
    state,
    number: `001-001-${String(index).padStart(9, "0")}`,
    issueDate: "2026-10-07",
    customerName: `Cliente ${index}`,
    total: "23.00",
  };
}

function page(items: unknown[], total = items.length) {
  return json(200, { items, page: 0, size: 20, total });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Comprobantes", () => {
  it("shows each state in words, not only with colour", async () => {
    stubApi({ "GET /documents": () => page([summary(1, "AUTHORIZED"), summary(2, "RETURNED"), summary(3, "SIGNATURE_FAILED")]) });
    renderWithTenant(<DocumentosPage />);

    expect(await screen.findByText("Autorizada")).toBeInTheDocument();
    expect(screen.getByText("Devuelta por el SRI")).toBeInTheDocument();
    expect(screen.getByText("Sin firmar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "001-001-000000001" })).toHaveAttribute("href", "/documentos/00000000-0000-4000-8000-000000000001");
    expect(screen.getByText("07/10/2026", { selector: "tr:nth-child(1) td" })).toBeInTheDocument();
  });

  it("keeps refreshing while something is in progress, and stops afterwards", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let state = "RECEIVED";
    const api = stubApi({ "GET /documents": () => page([summary(1, state)]) });
    renderWithTenant(<DocumentosPage />);
    expect(await screen.findByText("Recibida por el SRI")).toBeInTheDocument();
    expect(api.to("GET", "/documents")).toHaveLength(1);

    state = "AUTHORIZED";
    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(await screen.findByText("Autorizada")).toBeInTheDocument();
    expect(api.to("GET", "/documents")).toHaveLength(2);

    // Todo en estado final: ya no se consulta más.
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(api.to("GET", "/documents")).toHaveLength(2);
  });

  it("does not poll when nothing is in progress", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = stubApi({ "GET /documents": () => page([summary(1, "AUTHORIZED"), summary(2, "NOT_AUTHORIZED")]) });
    renderWithTenant(<DocumentosPage />);
    await screen.findByText("Autorizada");

    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(api.to("GET", "/documents")).toHaveLength(1);
  });

  it("invites to issue the first invoice, but not an auditor", async () => {
    stubApi({ "GET /documents": () => page([]) });
    const { unmount } = renderWithTenant(<DocumentosPage />);
    expect(await screen.findByText("Aún no se ha emitido ningún comprobante.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nueva factura" })).toHaveAttribute("href", "/facturas/nueva");
    unmount();

    renderWithTenant(<DocumentosPage />, { role: "AUDITOR" });
    await waitFor(() => expect(screen.getByText("Aún no se ha emitido ningún comprobante.")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Nueva factura" })).not.toBeInTheDocument();
  });

  it("shows the document type of each row", async () => {
    stubApi({ "GET /documents": () => page([{ ...summary(1, "AUTHORIZED"), documentType: "04" }, summary(2, "AUTHORIZED")]) });
    renderWithTenant(<DocumentosPage />);

    expect(await screen.findByRole("columnheader", { name: "Tipo" })).toBeInTheDocument();
    expect(screen.getByText("N. crédito")).toBeInTheDocument();
    expect(screen.getByText("Factura")).toBeInTheDocument();
  });

  it("filters by type and goes back to the first page", async () => {
    const api = stubApi({ "GET /documents": () => page([summary(1, "AUTHORIZED")], 45) });
    renderWithTenant(<DocumentosPage />);
    await screen.findByText("Autorizada");
    expect(api.to("GET", "/documents")[0]?.query.has("documentType")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(api.to("GET", "/documents").at(-1)?.query.get("page")).toBe("1"));

    const select = screen.getByRole("combobox", { name: "Tipo" });
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Todos los tipos",
      "Facturas",
      "Notas de crédito",
      "Notas de débito",
    ]);
    await userEvent.selectOptions(select, "Notas de crédito");

    await waitFor(() => {
      const last = api.to("GET", "/documents").at(-1)!;
      expect(last.query.get("documentType")).toBe("04");
      expect(last.query.get("page")).toBe("0");
    });
  });
});
