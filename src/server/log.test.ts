// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { logEvent } from "./log";

describe("logEvent", () => {
  it("writes one JSON line with when, how serious and what happened", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logEvent("warn", "proxy.upstream.failed", { correlationId: "c-1", status: 502 });

    expect(warn).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(warn.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(line).toMatchObject({ level: "warn", event: "proxy.upstream.failed", correlationId: "c-1", status: 502 });
    expect(new Date(String(line.time)).getTime()).not.toBeNaN();
  });

  it("uses the stream that matches the level", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    logEvent("info", "a");
    logEvent("error", "b");

    expect(info).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("never writes a credential, even if someone passes one by mistake", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    logEvent("error", "login.failed", {
      reason: "exchange",
      accessToken: "secreto-1",
      refresh_token: "secreto-2",
      Cookie: "secreto-3",
      password: "secreto-4",
      authorization: "Bearer secreto-5",
      sessionSecret: "secreto-6",
    });

    const written = String(error.mock.calls[0]?.[0]);
    expect(written).toContain("exchange");
    expect(written).not.toContain("secreto");
  });
});
