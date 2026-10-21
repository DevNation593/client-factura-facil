// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { sealSession, SESSION_COOKIE } from "@/server/session";
import { fakeCookieJar, putChunks } from "@/test/cookies";

import { POST } from "./route";

const incoming = vi.hoisted(() => ({ jar: undefined as unknown }));
vi.mock("next/headers", () => ({ cookies: async () => incoming.jar }));

const SECRET = "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres";
const APP = "http://localhost:3000";
const API = "http://api.interno:8080";

beforeAll(() => {
  vi.stubEnv("API_BASE_URL", API);
  vi.stubEnv("APP_BASE_URL", APP);
  vi.stubEnv("SESSION_SECRET", SECRET);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function signedInJar() {
  const jar = fakeCookieJar();
  const session = { accessToken: "el-token", refreshToken: "el-refresco", expiresAt: Date.now() + 300_000, startedAt: Date.now(), subject: "u-1" };
  putChunks(jar, SESSION_COOKIE, await sealSession(session, SECRET));
  incoming.jar = jar;
  return jar;
}

function logout(headers: Record<string, string>) {
  return POST(new NextRequest(`${APP}/auth/logout`, { method: "POST", headers }));
}

const SAME_ORIGIN = { "X-Requested-With": "einvoice-web", Origin: APP, "Sec-Fetch-Site": "same-origin" };

describe("cierre de sesión", () => {
  it("closes the session in the API too and goes back to the sign-in screen", async () => {
    const api = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", api);
    const jar = await signedInJar();

    const response = await logout(SAME_ORIGIN);

    expect(await response.json()).toEqual({ redirectTo: "/sign-in" });
    expect(jar.values.size).toBe(0);
    const [url, init] = api.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe(`${API}/api/v1/auth/logout`);
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: "el-refresco" });
  });

  it("signs out here even when the API does not answer", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const jar = await signedInJar();

    const response = await logout(SAME_ORIGIN);

    expect(response.status).toBe(200);
    expect(jar.values.size).toBe(0);
  });

  it("ignores a request from another site", async () => {
    const jar = await signedInJar();

    const response = await logout({ Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" });

    expect(response.status).toBe(403);
    expect(jar.values.size).toBeGreaterThan(0);
  });
});
