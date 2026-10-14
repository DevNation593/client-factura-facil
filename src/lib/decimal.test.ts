import { describe, expect, it } from "vitest";

import { add, compare, format, mul, parse, formatUnitPrice, plainDecimal, roundHalfUp, sub, type Dec } from "./decimal";

function dec(text: string): Dec {
  const value = parse(text, 12);
  if (value === null) {
    throw new Error(`no es decimal: ${text}`);
  }
  return value;
}

describe("decimal", () => {
  it("parses decimal strings and rejects everything else", () => {
    expect(format(dec("1.50"), 2)).toBe("1.50");
    expect(format(dec("0.000001"), 6)).toBe("0.000001");
    expect(format(dec("12"), 2)).toBe("12.00");
    expect(format(dec(" 7.5 "), 2)).toBe("7.50");

    for (const bad of ["1,5", "-1", "+1", "1e3", "", " ", ".5", "5.", "1.2.3", "abc", "1 000", "0x10", "1234567890123"]) {
      expect(parse(bad, 6), bad).toBeNull();
    }
    // Más decimales de los que admite el campo.
    expect(parse("1.123", 2)).toBeNull();
    expect(parse("1.12", 2)).not.toBeNull();
  });

  it("multiplies exactly", () => {
    expect(format(mul(dec("0.1"), dec("0.2")), 2)).toBe("0.02");
    expect(format(mul(dec("1.5"), dec("9.333333")), 7)).toBe("13.9999995");
    expect(format(mul(dec("0.1"), dec("3")), 1)).toBe("0.3");
  });

  it("adds and subtracts across different scales", () => {
    expect(format(add(dec("0.1"), dec("0.25")), 2)).toBe("0.35");
    expect(format(sub(dec("10"), dec("0.01")), 2)).toBe("9.99");
    expect(format(sub(dec("1"), dec("2.5")), 2)).toBe("-1.50");
  });

  it("rounds half up", () => {
    expect(format(roundHalfUp(dec("13.9999995"), 2), 2)).toBe("14.00");
    expect(format(roundHalfUp(dec("2.345"), 2), 2)).toBe("2.35");
    expect(format(roundHalfUp(dec("2.344999"), 2), 2)).toBe("2.34");
    expect(format(roundHalfUp(dec("0.005"), 2), 2)).toBe("0.01");
    expect(format(roundHalfUp(dec("0.0049"), 2), 2)).toBe("0.00");
    expect(format(sub(dec("0"), dec("2.345")), 2)).toBe("-2.35");
  });

  it("formats with a fixed scale", () => {
    expect(format(dec("5"), 0)).toBe("5");
    expect(format(dec("0.5"), 2)).toBe("0.50");
    expect(format(dec("1234.5"), 6)).toBe("1234.500000");
  });

  it("compares by value, not by text", () => {
    expect(compare(dec("1.0"), dec("1"))).toBe(0);
    expect(compare(dec("0.99"), dec("1"))).toBe(-1);
    expect(compare(dec("10"), dec("9.999999"))).toBe(1);
  });
});

describe("presentación", () => {
  it("shows a quantity as it would be written by hand", () => {
    expect(plainDecimal("2.000000")).toBe("2");
    expect(plainDecimal("1.500000")).toBe("1.5");
    expect(plainDecimal("10")).toBe("10");
    expect(plainDecimal("0.000000")).toBe("0");
    expect(plainDecimal("100.000100")).toBe("100.0001");
  });

  it("shows a unit price with at least two decimals and never rounds it", () => {
    expect(formatUnitPrice("12.500000")).toBe("12.50");
    expect(formatUnitPrice("0.125000")).toBe("0.125");
    expect(formatUnitPrice("9.333333")).toBe("9.333333");
    expect(formatUnitPrice("7")).toBe("7.00");
    expect(formatUnitPrice("10.00")).toBe("10.00");
  });
});
