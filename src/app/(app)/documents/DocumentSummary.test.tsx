import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { json, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import { DocumentSummary, SUMMARY_SIZE } from "./DocumentSummary";

function document(index: number, state: string, total: string) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    documentType: "01",
    state,
    number: `001-001-${String(index).padStart(9, "0")}`,
    issueDate: "2026-10-07",
    customerName: `Cliente ${index}`,
    total,
  };
}

describe("Resumen de las facturas", () => {
  it("counts the latest invoices at each point and says how many it looked at", async () => {
    const api = stubApi({
      "GET /documents": () =>
        json(200, {
          items: [
            document(1, "AUTHORIZED", "112.00"),
            document(2, "AUTHORIZED", "8.50"),
            document(3, "RECEIVED", "40.00"),
            document(4, "RETURNED", "5.00"),
          ],
          page: 0,
          size: SUMMARY_SIZE,
          total: 250,
        }),
    });
    renderWithTenant(<DocumentSummary type="01" />);

    const summary = await screen.findByRole("region", { name: "Resumen de facturas" });
    const value = (label: string) => within(summary).getByText(label).closest(".summary-tile")?.querySelector("dd")?.textContent;
    expect(value("Autorizadas")).toBe("2");
    expect(value("En proceso")).toBe("1");
    expect(value("Requieren atención")).toBe("1");
    expect(value("Total autorizado")).toBe("$120.50");
    expect(within(summary).getByText("Calculado con las últimas 4 de 250 facturas.")).toBeInTheDocument();
    expect(api.to("GET", "/documents")[0]?.query.get("size")).toBe(String(SUMMARY_SIZE));
    expect(api.to("GET", "/documents")[0]?.query.get("documentType")).toBe("01");
  });

  it("says nothing while there is no invoice yet", async () => {
    const api = stubApi({ "GET /documents": () => json(200, { items: [], page: 0, size: SUMMARY_SIZE, total: 0 }) });
    renderWithTenant(<DocumentSummary type="01" />);

    await waitFor(() => expect(api.to("GET", "/documents")).toHaveLength(1));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("says when it could not be loaded, instead of looking like there are no invoices, and lets you retry", async () => {
    let calls = 0;
    const api = stubApi({
      "GET /documents": () =>
        ++calls === 1
          ? json(503, { type: "about:blank", title: "Servicio no disponible", status: 503 })
          : json(200, { items: [document(1, "AUTHORIZED", "10.00")], page: 0, size: SUMMARY_SIZE, total: 1 }),
    });
    renderWithTenant(<DocumentSummary type="01" />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar el resumen" }));

    expect(await screen.findByRole("region", { name: "Resumen de facturas" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.to("GET", "/documents")).toHaveLength(2);
  });
});
