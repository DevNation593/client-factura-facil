import { describe, expect, it } from "vitest";

import { summarize } from "./documentSummary";

describe("summarize", () => {
  it("counts the documents at each point and adds up only what the SRI authorized", () => {
    const summary = summarize(
      [
        { state: "AUTHORIZED", total: "112.00" },
        { state: "AUTHORIZED", total: "8.50" },
        { state: "RECEIVED", total: "40.00" },
        { state: "SIGNATURE_FAILED", total: "10.00" },
        { state: "RETURNED", total: "5.00" },
      ],
      5,
    );

    expect(summary).toEqual({
      count: 5,
      total: 5,
      byTone: { success: 2, progress: 1, warning: 1, danger: 1 },
      authorizedAmount: "120.50",
    });
  });

  it("keeps the company total apart from the documents it summarizes", () => {
    const summary = summarize([{ state: "SENDING", total: null }], 250);

    expect(summary.count).toBe(1);
    expect(summary.total).toBe(250);
    expect(summary.authorizedAmount).toBe("0.00");
  });
});
