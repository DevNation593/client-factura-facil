import { describe, expect, it } from "vitest";

import { DOCUMENT_SUBMODULES, documentSubmodule, documentTypeLabel, documentTypeShort, submoduleTabs } from "./documentTypes";

describe("documentTypes", () => {
  it("names the six document types", () => {
    expect(documentTypeLabel("01")).toBe("Factura");
    expect(documentTypeLabel("03")).toBe("Liquidación de compra");
    expect(documentTypeLabel("04")).toBe("Nota de crédito");
    expect(documentTypeLabel("05")).toBe("Nota de débito");
    expect(documentTypeLabel("06")).toBe("Guía de remisión");
    expect(documentTypeLabel("07")).toBe("Comprobante de retención");
  });

  it("has a short name for lists", () => {
    expect(documentTypeShort("01")).toBe("Factura");
    expect(documentTypeShort("03")).toBe("Liquidación");
    expect(documentTypeShort("04")).toBe("N. crédito");
    expect(documentTypeShort("05")).toBe("N. débito");
    expect(documentTypeShort("06")).toBe("Guía");
    expect(documentTypeShort("07")).toBe("Retención");
  });

  it("falls back for an unknown code", () => {
    expect(documentTypeLabel("99")).toBe("Comprobante");
    expect(documentTypeShort("99")).toBe("Comprobante");
  });

  it("has one submodule per type, in the order of the menu", () => {
    expect(DOCUMENT_SUBMODULES.map((entry) => [entry.code, entry.title, entry.href])).toEqual([
      ["01", "Facturas", "/documents/invoices"],
      ["04", "Notas de crédito", "/documents/credit-notes"],
      ["05", "Notas de débito", "/documents/debit-notes"],
      ["06", "Guías de remisión", "/documents/waybills"],
      ["03", "Liquidaciones de compra", "/documents/purchase-settlements"],
      ["07", "Retenciones", "/documents/withholdings"],
    ]);
  });

  it("issues each type inside its own submodule, and only the types the platform issues", () => {
    expect(documentSubmodule("01").issue?.href).toBe("/documents/invoices/new");
    expect(documentSubmodule("04").issue?.href).toBe("/documents/credit-notes/new");
    expect(documentSubmodule("05").issue?.href).toBe("/documents/debit-notes/new");
    expect(documentSubmodule("06").issue).toBeNull();
    expect(documentSubmodule("03").issue).toBeNull();
    expect(documentSubmodule("07").issue).toBeNull();
  });

  it("gives each submodule its tabs, the issuing ones only to whoever can issue", () => {
    const labels = (code: "01" | "04" | "07", canIssue: boolean) => submoduleTabs(documentSubmodule(code), canIssue).map((tab) => tab.label);

    expect(labels("01", true)).toEqual(["Emitidas", "Borradores", "Nueva factura"]);
    expect(labels("04", true)).toEqual(["Emitidas", "Nueva nota de crédito"]);
    expect(labels("07", true)).toEqual(["Emitidas"]);
    expect(labels("01", false)).toEqual(["Emitidas"]);
  });
});
