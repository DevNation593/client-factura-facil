import { describe, expect, it } from "vitest";

import { DOCUMENT_MODULES, documentModule, documentTypeLabel, documentTypeShort } from "./documentTypes";

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
    expect(DOCUMENT_MODULES.map((entry) => [entry.code, entry.title, entry.href])).toEqual([
      ["01", "Facturas", "/documents/invoices"],
      ["04", "Notas de crédito", "/documents/credit-notes"],
      ["05", "Notas de débito", "/documents/debit-notes"],
      ["06", "Guías de remisión", "/documents/waybills"],
      ["03", "Liquidaciones de compra", "/documents/purchase-settlements"],
      ["07", "Retenciones", "/documents/withholdings"],
    ]);
  });

  it("offers to issue only the types the platform issues", () => {
    expect(documentModule("01").issue?.href).toBe("/invoices/new");
    expect(documentModule("04").issue?.href).toBe("/notes/new?tipo=credito");
    expect(documentModule("05").issue?.href).toBe("/notes/new?tipo=debito");
    expect(documentModule("06").issue).toBeNull();
    expect(documentModule("03").issue).toBeNull();
    expect(documentModule("07").issue).toBeNull();
  });
});
