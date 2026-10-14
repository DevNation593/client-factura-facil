// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sealSession, SESSION_COOKIE } from "@/server/session";
import { fakeCookieJar, putChunks } from "@/test/cookies";
import { startFakeIdp, type FakeIdp } from "@/test/idp";

import { POST } from "./route";

const incoming = vi.hoisted(() => ({ jar: undefined as unknown }));
vi.mock("next/headers", () => ({ cookies: async () => incoming.jar }));

const SECRET = "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres";
const APP = "http://localhost:3000";

let idp: FakeIdp;

beforeAll(async () => {
  idp = await startFakeIdp();
  vi.stubEnv("API_BASE_URL", "http://api.interno:8080");
  vi.stubEnv("APP_BASE_URL", APP);
  vi.stubEnv("OIDC_ISSUER", idp.issuer);
  vi.stubEnv("OIDC_CLIENT_ID", "einvoice-web");
  vi.stubEnv("SESSION_SECRET", SECRET);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await idp.close();
});

async function signedInJar() {
  const jar = fakeCookieJar();
  const session = { accessToken: "el-token", idToken: "el-token-de-identidad", expiresAt: Date.now() + 300_000, startedAt: Date.now(), subject: "u-1" };
  putChunks(jar, SESSION_COOKIE, await sealSession(session, SECRET));
  incoming.jar = jar;
  return jar;
}

function logout(headers: Record<string, string>) {
  return POST(new NextRequest(`${APP}/auth/logout`, { method: "POST", headers }));
}

describe("cierre de sesión", () => {
  it("ends the provider's session too, without asking the user to confirm there", async () => {
    const jar = await signedInJar();

    const response = await logout({ Origin: APP, "Sec-Fetch-Site": "same-origin" });

    const destination = new URL(((await response.json()) as { redirectTo: string }).redirectTo);
    expect(destination.origin + destination.pathname).toBe(`${idp.issuer}/logout`);
    // Con el token de identidad el proveedor sabe qué sesión cerrar y no pregunta.
    expect(destination.searchParams.get("id_token_hint")).toBe("el-token-de-identidad");
    expect(destination.searchParams.get("post_logout_redirect_uri")).toBe(`${APP}/ingresar`);
    expect(jar.values.size).toBe(0);
  });

  it("ignores a request from another site", async () => {
    const jar = await signedInJar();

    const response = await logout({ Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" });

    expect(response.status).toBe(403);
    expect(jar.values.size).toBeGreaterThan(0);
  });
});
