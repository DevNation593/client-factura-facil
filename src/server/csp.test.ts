// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildCsp, newNonce } from "./csp";

function directives(policy: string): Record<string, string> {
  return Object.fromEntries(
    policy.split(";").map((directive) => {
      const [name, ...values] = directive.trim().split(/\s+/);
      return [name, values.join(" ")];
    }),
  );
}

describe("buildCsp", () => {
  it("only lets the page run its own scripts, marked with the nonce of this response", () => {
    const policy = directives(buildCsp({ nonce: "abc123", development: false, secure: true }));

    expect(policy).toEqual({
      "default-src": "'self'",
      "script-src": "'self' 'nonce-abc123' 'strict-dynamic'",
      "style-src": "'self' 'nonce-abc123'",
      "img-src": "'self' data:",
      "font-src": "'self'",
      "connect-src": "'self'",
      "object-src": "'none'",
      "base-uri": "'self'",
      "form-action": "'self'",
      "frame-ancestors": "'none'",
      "upgrade-insecure-requests": "",
    });
  });

  it("never allows inline or evaluated scripts outside development", () => {
    const policy = buildCsp({ nonce: "abc123", development: false, secure: true });

    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("unsafe-inline");
  });

  it("gives the development server what it needs, and nothing of that to production", () => {
    const policy = directives(buildCsp({ nonce: "abc123", development: true, secure: false }));

    // React reconstruye trazas con eval en desarrollo, y la recarga en caliente usa un WebSocket y estilos en línea.
    expect(policy["script-src"]).toBe("'self' 'nonce-abc123' 'strict-dynamic' 'unsafe-eval'");
    expect(policy["connect-src"]).toBe("'self' ws:");
    expect(policy["style-src"]).toBe("'self' 'unsafe-inline'");
  });

  it("does not force https when the application is served over http on this machine", () => {
    expect(buildCsp({ nonce: "abc123", development: false, secure: false })).not.toContain("upgrade-insecure-requests");
  });
});

describe("newNonce", () => {
  it("is different every time and safe to put in a header", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => newNonce()));

    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    }
  });
});
