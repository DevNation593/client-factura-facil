import { describe, expect, it } from "vitest";

import { normalizeInvoiceNumber } from "./invoiceNumber";

describe("normalizeInvoiceNumber", () => {
  it("accepts the fifteen digits alone and inserts the hyphens", () => {
    expect(normalizeInvoiceNumber("001001000000123")).toBe("001-001-000000123");
    expect(normalizeInvoiceNumber(" 001001000000123 ")).toBe("001-001-000000123");
  });

  it("accepts the hyphenated number as it is", () => {
    expect(normalizeInvoiceNumber("001-001-000000123")).toBe("001-001-000000123");
  });

  it("is null for anything else", () => {
    expect(normalizeInvoiceNumber("")).toBeNull();
    expect(normalizeInvoiceNumber("001-001-123")).toBeNull();
    expect(normalizeInvoiceNumber("00100100000012")).toBeNull();
    expect(normalizeInvoiceNumber("0010010000001234")).toBeNull();
    expect(normalizeInvoiceNumber("001-001000000123")).toBeNull();
    expect(normalizeInvoiceNumber("00a-001-000000123")).toBeNull();
  });
});
