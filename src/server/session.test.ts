// @vitest-environment node
import { describe, expect, it } from "vitest";

import { MAX_CHUNK, MAX_SESSION_AGE_MS, openSession, sealSession, type Session } from "./session";

const SECRET = "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres";

function session(overrides: Partial<Session> = {}): Session {
  return {
    accessToken: "token-de-acceso.eyJhbGciOi",
    refreshToken: "token-de-refresco",
    expiresAt: Date.now() + 300_000,
    startedAt: Date.now(),
    subject: "u-123",
    name: "Ana Pérez",
    ...overrides,
  };
}

describe("session cookies", () => {
  it("round-trips a session", async () => {
    const original = session();

    const chunks = await sealSession(original, SECRET);

    expect(await openSession(chunks, SECRET)).toEqual(original);
  });

  it("splits large tokens across several cookies", async () => {
    const original = session({ accessToken: "a".repeat(9000) });

    const chunks = await sealSession(original, SECRET);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK);
    }
    expect(await openSession(chunks, SECRET)).toEqual(original);
  });

  it("rejects a tampered, foreign or incomplete cookie", async () => {
    const chunks = await sealSession(session({ accessToken: "a".repeat(9000) }), SECRET);
    const first = chunks[0] as string;
    const flipped = first.slice(0, 40) + (first[40] === "A" ? "B" : "A") + first.slice(41);

    expect(await openSession([flipped, ...chunks.slice(1)], SECRET)).toBeNull();
    expect(await openSession(chunks, "otro-secreto-distinto-de-mas-de-treinta-y-dos-caracteres")).toBeNull();
    expect(await openSession(chunks.slice(0, -1), SECRET)).toBeNull();
    expect(await openSession([], SECRET)).toBeNull();
    expect(await openSession(["esto-no-es-una-sesion"], SECRET)).toBeNull();
  });

  it("does not expose the tokens in the sealed value", async () => {
    const chunks = await sealSession(session({ accessToken: "secreto-visible", refreshToken: "otro-visible" }), SECRET);

    const sealed = chunks.join("");
    expect(sealed).not.toContain("secreto-visible");
    expect(sealed).not.toContain("otro-visible");
    expect(sealed).not.toContain("Ana");
  });

  it("ends a session that has lived too long, even if it keeps being refreshed", async () => {
    const old = session({ startedAt: Date.now() - MAX_SESSION_AGE_MS - 1000 });

    expect(await openSession(await sealSession(old, SECRET), SECRET)).toBeNull();
  });

  it("rejects content that is not a session", async () => {
    const chunks = await sealSession({ accessToken: 42 } as unknown as Session, SECRET);

    expect(await openSession(chunks, SECRET)).toBeNull();
  });
});
