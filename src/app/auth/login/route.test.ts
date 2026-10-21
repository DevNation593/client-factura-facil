// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { openSession, readChunks, SESSION_COOKIE } from "@/server/session";
import { fakeCookieJar, type FakeCookieJar } from "@/test/cookies";
import { accessToken, tokensResponse } from "@/test/tokens";

import { POST } from "./route";

const incoming = vi.hoisted(() => ({ jar: undefined as unknown }));
vi.mock("next/headers", () => ({ cookies: async () => incoming.jar }));

const SECRET = "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres";
const APP = "http://localhost:3000";
const API = "http://api.interno:8080";
const SAME_ORIGIN = { "X-Requested-With": "einvoice-web", Origin: APP, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" };

let jar: FakeCookieJar;

beforeAll(() => {
  vi.stubEnv("API_BASE_URL", API);
  vi.stubEnv("APP_BASE_URL", APP);
  vi.stubEnv("SESSION_SECRET", SECRET);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  jar = fakeCookieJar();
  incoming.jar = jar;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function login(body: unknown, headers: Record<string, string> = SAME_ORIGIN) {
  return POST(new NextRequest(`${APP}/auth/login`, { method: "POST", headers, body: JSON.stringify(body) }));
}

describe("ingreso", () => {
  it("keeps the API's tokens in the encrypted session and goes where the user was going", async () => {
    const token = accessToken({ sub: "u-7", email: "ana@example.test" });
    const api = vi.fn(async () => tokensResponse(token, "refresco-1"));
    vi.stubGlobal("fetch", api);

    const response = await login({ email: "ana@example.test", password: "una contraseña larga", volver: "/documents?page=2" }, {
      ...SAME_ORIGIN,
      // La primera la inventa el navegador; la última la añade el proxy de entrada.
      "X-Forwarded-For": "10.0.0.1, 203.0.113.9",
    });

    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ redirectTo: "/documents?page=2" });
    // La respuesta no lleva los tokens: solo la cookie cifrada.
    expect(text).not.toContain(token);
    const session = await openSession(readChunks(SESSION_COOKIE, (name) => jar.get(name)?.value), SECRET);
    expect(session).toMatchObject({ accessToken: token, refreshToken: "refresco-1", subject: "u-7", name: "ana@example.test" });
    const [url, init] = api.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe(`${API}/api/v1/auth/login`);
    expect(JSON.parse(String(init.body))).toEqual({ email: "ana@example.test", password: "una contraseña larga" });
    // La API limita los intentos por la IP del navegador, no por la de la web.
    expect(new Headers(init.headers).get("X-Forwarded-For")).toBe("203.0.113.9");
  });

  it("never sends the user to another site after signing in", async () => {
    vi.stubGlobal("fetch", async () => tokensResponse(accessToken({ sub: "u-7" }), "r"));
    for (const volver of ["https://evil.example", "//evil.example", "/\\evil"]) {
      expect(await (await login({ email: "a@b.ec", password: "x", volver })).json()).toEqual({ redirectTo: "/" });
    }
  });

  it("passes on the API's refusal, with its code and when to try again", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ status: 429, errorCode: "ACCOUNT_LOCKED", detail: "Demasiados intentos" }), {
        status: 429,
        headers: { "Retry-After": "600", "Content-Type": "application/problem+json" },
      }));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await login({ email: "a@b.ec", password: "mala" });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("600");
    expect(await response.json()).toMatchObject({ errorCode: "ACCOUNT_LOCKED" });
    expect(jar.values.size).toBe(0);
  });

  it("answers 503 when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect((await login({ email: "a@b.ec", password: "x" })).status).toBe(503);
  });

  it("ignores a form sent from another site", async () => {
    const api = vi.fn();
    vi.stubGlobal("fetch", api);

    const response = await login({ email: "a@b.ec", password: "x" }, { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" });

    expect(response.status).toBe(403);
    expect(api).not.toHaveBeenCalled();
  });
});
