import { describe, expect, it } from "vitest";

import { availableBalance, prorateDiscount } from "./creditNote";

describe("prorateDiscount", () => {
  it("prorates the original discount by the credited quantity, half up to two decimals", () => {
    expect(prorateDiscount("1.50", "1", "3.000000")).toBe("0.50");
    expect(prorateDiscount("1.00", "1", "3")).toBe("0.33");
    expect(prorateDiscount("2.00", "1", "3")).toBe("0.67");
    expect(prorateDiscount("0.05", "1", "2")).toBe("0.03");
    expect(prorateDiscount("1.50", "3", "3")).toBe("1.50");
    expect(prorateDiscount("0.00", "1.5", "2")).toBe("0.00");
  });

  it("is null while the quantity is not a valid one", () => {
    expect(prorateDiscount("1.50", "", "3")).toBeNull();
    expect(prorateDiscount("1.50", "1,5", "3")).toBeNull();
    expect(prorateDiscount("1.50", "1", "0")).toBeNull();
  });
});

describe("availableBalance", () => {
  it("is the invoice total minus what its credit notes already credit", () => {
    expect(availableBalance("23.00", "5.00")).toBe("18.00");
    expect(availableBalance("23.00", "23.00")).toBe("0.00");
    expect(availableBalance("23.00", null)).toBe("23.00");
  });
});
