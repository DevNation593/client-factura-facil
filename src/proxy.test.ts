// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

function nonceOf(policy: string | null): string {
  return /'nonce-([^']+)'/.exec(policy ?? "")?.[1] ?? "";
}

describe("proxy", () => {
  it("gives every page a policy with a nonce of its own, and tells the renderer which", () => {
    const first = proxy(new NextRequest("http://localhost:3000/documentos"));
    const second = proxy(new NextRequest("http://localhost:3000/documentos"));

    const policy = first.headers.get("Content-Security-Policy");
    expect(policy).toContain("script-src 'self' 'nonce-");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(nonceOf(policy)).not.toBe("");
    expect(nonceOf(second.headers.get("Content-Security-Policy"))).not.toBe(nonceOf(policy));
    // Next lee el nonce de la política que viaja con la petición y lo pone en sus scripts.
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonceOf(policy));
  });

  it("tells the pages which address was asked for, so signing in can come back to it", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/invitacion?codigo=abc", { headers: { "x-return-to": "https://evil.example/" } }),
    );

    // Lo pone el servidor: lo que mande el navegador en esa cabecera se descarta.
    expect(response.headers.get("x-middleware-request-x-return-to")).toBe("/invitacion?codigo=abc");
  });

  it("forces https only when the application is served over it", () => {
    vi.stubEnv("APP_BASE_URL", "https://facturas.example.com");
    expect(proxy(new NextRequest("https://facturas.example.com/")).headers.get("Content-Security-Policy")).toContain("upgrade-insecure-requests");

    vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
    expect(proxy(new NextRequest("http://localhost:3000/")).headers.get("Content-Security-Policy")).not.toContain("upgrade-insecure-requests");
  });

  it("leaves the API, the static files and prefetches alone", () => {
    const matcher = config.matcher[0];
    const pattern = new RegExp(`^${matcher?.source}$`);

    for (const path of ["/", "/documentos", "/ingresar", "/auth/login"]) {
      expect(pattern.test(path), path).toBe(true);
    }
    for (const path of ["/api/backend/customers", "/api/session", "/_next/static/chunks/main.js", "/favicon.ico"]) {
      expect(pattern.test(path), path).toBe(false);
    }
    expect(matcher?.missing).toContainEqual({ type: "header", key: "next-router-prefetch" });
  });
});
