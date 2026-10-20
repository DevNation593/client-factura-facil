import { describe, expect, it } from "vitest";

import { documentTypeLabel, documentTypeShort } from "./documentTypes";

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
});
