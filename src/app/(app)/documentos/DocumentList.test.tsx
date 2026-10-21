import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { json, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import { DocumentList } from "./DocumentList";

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

describe("Listado de un tipo de comprobante", () => {
  it("shows each state in words, not only with colour", async () => {
    stubApi({ "GET /documents": () => page([summary(1, "AUTHORIZED"), summary(2, "RETURNED"), summary(3, "SIGNATURE_FAILED")]) });
    renderWithTenant(<DocumentList type="01" />);

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
    renderWithTenant(<DocumentList type="01" />);
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
    renderWithTenant(<DocumentList type="01" />);
    await screen.findByText("Autorizada");

    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(api.to("GET", "/documents")).toHaveLength(1);
  });

  it("asks only for its own type, on every page", async () => {
    const api = stubApi({ "GET /documents": () => page([{ ...summary(1, "AUTHORIZED"), documentType: "04" }], 45) });
    renderWithTenant(<DocumentList type="04" />);
    await screen.findByText("Autorizada");
    expect(api.to("GET", "/documents")[0]?.query.get("documentType")).toBe("04");

    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => expect(api.to("GET", "/documents").at(-1)?.query.get("page")).toBe("1"));
    expect(api.to("GET", "/documents").every((call) => call.query.get("documentType") === "04")).toBe(true);
  });

  it("invites to issue the first invoice, but not an auditor", async () => {
    stubApi({ "GET /documents": () => page([]) });
    const { unmount } = renderWithTenant(<DocumentList type="01" />);
    expect(await screen.findByRole("heading", { name: "Facturas" })).toBeInTheDocument();
    expect(await screen.findByText("Aún no se ha emitido ninguna factura.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nueva factura" })).toHaveAttribute("href", "/facturas/nueva");
    unmount();

    renderWithTenant(<DocumentList type="01" />, { role: "AUDITOR" });
    await waitFor(() => expect(screen.getByText("Aún no se ha emitido ninguna factura.")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Nueva factura" })).not.toBeInTheDocument();
  });

  it("leads each note to its own issuing tab", async () => {
    stubApi({ "GET /documents": () => page([]) });
    const { unmount } = renderWithTenant(<DocumentList type="04" />);
    expect(await screen.findByText("Aún no se ha emitido ninguna nota de crédito.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nueva nota de crédito" })).toHaveAttribute("href", "/notas/nueva?tipo=credito");
    unmount();

    renderWithTenant(<DocumentList type="05" />);
    expect(await screen.findByText("Aún no se ha emitido ninguna nota de débito.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nueva nota de débito" })).toHaveAttribute("href", "/notas/nueva?tipo=debito");
  });

  it.each([
    ["06", "Guías de remisión", "La plataforma todavía no emite guías de remisión."],
    ["03", "Liquidaciones de compra", "La plataforma todavía no emite liquidaciones de compra."],
    ["07", "Retenciones", "La plataforma todavía no emite retenciones."],
  ] as const)("lists type %s without offering to issue what the platform cannot", async (type, title, notice) => {
    const api = stubApi({ "GET /documents": () => page([]) });
    renderWithTenant(<DocumentList type={type} />);

    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(notice)).toBeInTheDocument();
    await waitFor(() => expect(api.to("GET", "/documents")[0]?.query.get("documentType")).toBe(type));
    expect(screen.queryByRole("link", { name: /^Nueva/ })).not.toBeInTheDocument();
  });

  it("names the other party as each type does, and leaves a missing total blank", async () => {
    stubApi({ "GET /documents": () => page([{ ...summary(1, "AUTHORIZED"), documentType: "07", total: null }]) });
    renderWithTenant(<DocumentList type="07" />);

    expect(await screen.findByRole("columnheader", { name: "Sujeto retenido" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Tipo" })).not.toBeInTheDocument();
    expect(screen.getByText("—", { selector: "td.num" })).toBeInTheDocument();
  });
});
