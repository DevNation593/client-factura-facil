import { describe, expect, it } from "vitest";

import { previewInvoice, sumAmounts, type PreviewLineInput } from "./invoicePreview";

function line(quantity: string, unitPrice: string, rate: "15" | "0" = "15", discount = "0.00"): PreviewLineInput {
  return { quantity, unitPrice, discount, rateCode: rate === "15" ? "4" : "0", ratePercent: rate === "15" ? "15.00" : "0.00" };
}

describe("previewInvoice", () => {
  it("matches the server on its own example", () => {
    // El mismo documento que usan las pruebas del backend: 2 × 10.00 al 15 % y 1.5 × 9.333333 al 0 %.
    const preview = previewInvoice([line("2", "10.00"), line("1.5", "9.333333", "0")]);

    expect(preview.lines).toEqual(["20.00", "14.00"]);
    expect(preview.subtotal).toBe("34.00");
    expect(preview.totalDiscount).toBe("0.00");
    expect(preview.taxes).toEqual([
      { rateCode: "0", ratePercent: "0.00", base: "14.00", amount: "0.00" },
      { rateCode: "4", ratePercent: "15.00", base: "20.00", amount: "3.00" },
    ]);
    expect(preview.total).toBe("37.00");
    expect(preview.complete).toBe(true);
  });

  it("computes the tax of each rate on the sum of its bases, not line by line", () => {
    // Tres líneas de 0.33: línea por línea serían 3 × 0.05 = 0.15; sobre la base 0.99 son 0.15 (0.1485).
    // Con 0.31 la diferencia se ve: 3 × 0.05 = 0.15 frente a 0.93 × 15 % = 0.14.
    const preview = previewInvoice([line("1", "0.31"), line("1", "0.31"), line("1", "0.31")]);

    expect(preview.taxes).toEqual([{ rateCode: "4", ratePercent: "15.00", base: "0.93", amount: "0.14" }]);
    expect(preview.total).toBe("1.07");
  });

  it("subtracts the discount from the base", () => {
    const preview = previewInvoice([line("2", "10.00", "15", "5.00")]);

    expect(preview.lines).toEqual(["15.00"]);
    expect(preview.totalDiscount).toBe("5.00");
    expect(preview.taxes[0]?.amount).toBe("2.25");
    expect(preview.total).toBe("17.25");
  });

  it("rounds each line half up before adding", () => {
    const preview = previewInvoice([line("3", "0.335", "0"), line("1", "0.005", "0")]);

    // 1.005 → 1.01 y 0.005 → 0.01
    expect(preview.lines).toEqual(["1.01", "0.01"]);
    expect(preview.subtotal).toBe("1.02");
  });

  it("is not complete while a line cannot be computed", () => {
    for (const bad of [line("", "10.00"), line("0", "10.00"), line("1", "1,5"), line("1", "10.00", "15", "20.00"), line("-1", "10")]) {
      const preview = previewInvoice([line("1", "10.00"), bad]);

      expect(preview.complete).toBe(false);
      expect(preview.lines).toEqual(["10.00", null]);
      // Lo calculable se sigue mostrando.
      expect(preview.subtotal).toBe("10.00");
    }
    expect(previewInvoice([]).complete).toBe(false);
  });

  it("treats an empty discount as zero", () => {
    expect(previewInvoice([line("1", "10.00", "15", "")]).total).toBe("11.50");
  });
});

describe("sumAmounts", () => {
  it("adds payment amounts exactly", () => {
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(sumAmounts(["30", "7.00"])).toBe("37.00");
    expect(sumAmounts([])).toBe("0.00");
  });

  it("is null when an amount is not valid", () => {
    expect(sumAmounts(["10.00", ""])).toBeNull();
    expect(sumAmounts(["1.234"])).toBeNull();
    expect(sumAmounts(["1,50"])).toBeNull();
  });
});
