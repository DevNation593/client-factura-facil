import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { listDrafts, newDraft, saveDraft } from "@/lib/drafts";
import { renderWithTenant, TENANT_ID } from "@/test/render";

import BorradoresPage from "./page";

describe("Borradores", () => {
  it("lists this tenant's drafts and lets the user continue or discard them", async () => {
    const draft = { ...newDraft(), customerName: "María Pérez" };
    saveDraft(TENANT_ID, draft);
    saveDraft("22222222-2222-4222-8222-222222222222", { ...newDraft(), customerName: "De otra empresa" });
    renderWithTenant(<BorradoresPage />);

    expect(screen.getByText("María Pérez")).toBeInTheDocument();
    expect(screen.queryByText("De otra empresa")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continuar el borrador de María Pérez/ })).toHaveAttribute(
      "href",
      `/invoices/new?borrador=${draft.id}`,
    );

    await userEvent.click(screen.getByRole("button", { name: /Descartar el borrador de María Pérez/ }));

    expect(screen.getByText("No hay borradores.")).toBeInTheDocument();
    expect(listDrafts(TENANT_ID)).toHaveLength(0);
  });

  it("says that drafts live only in this browser", () => {
    renderWithTenant(<BorradoresPage />);

    expect(screen.getByRole("status")).toHaveTextContent(/solo en este navegador/);
  });
});
