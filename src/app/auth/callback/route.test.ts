// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { beginLogin } from "@/server/oidc";
import { readConfig } from "@/server/config";
import { openSession, readChunks, seal, SESSION_COOKIE } from "@/server/session";
import { fakeCookieJar, putChunks, type FakeCookieJar } from "@/test/cookies";
import { startFakeIdp, type FakeIdp } from "@/test/idp";

import { GET } from "./route";

const incoming = vi.hoisted(() => ({ jar: undefined as unknown }));
vi.mock("next/headers", () => ({ cookies: async () => incoming.jar }));

const SECRET = "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres";
const APP = "http://localhost:3000";

let idp: FakeIdp;
let jar: FakeCookieJar;
let log: Record<string, unknown>[];

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

beforeEach(() => {
  jar = fakeCookieJar();
  incoming.jar = jar;
  log = [];
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
    log.push(JSON.parse(String(line)) as Record<string, unknown>);
  });
});

/** Deja en las cookies un inicio de sesión en curso y devuelve sus datos. */
async function pendingLogin(returnTo: string) {
  const { pending } = await beginLogin(readConfig(), returnTo);
  putChunks(jar, "einvoice_login", await seal(pending, SECRET));
  return pending;
}

function callback(query: string) {
  return GET(new NextRequest(`${APP}/auth/callback?${query}`));
}

describe("vuelta del proveedor de identidad", () => {
  it("opens the session and returns to where the user was going", async () => {
    const pending = await pendingLogin("/documentos?page=2");
    const idToken = await idp.idToken({ audience: "einvoice-web", subject: "u-1", nonce: pending.nonce, name: "Ana Pérez" });
    idp.onToken(() => ({ status: 200, body: { access_token: "acceso", token_type: "Bearer", expires_in: 300, refresh_token: "refresco", id_token: idToken } }));

    const response = await callback(`code=abc&state=${pending.state}`);

    expect(response.headers.get("location")).toBe(`${APP}/documentos?page=2`);
    const session = await openSession(readChunks(SESSION_COOKIE, (name) => jar.get(name)?.value), SECRET);
    expect(session).toMatchObject({ accessToken: "acceso", subject: "u-1", name: "Ana Pérez" });
    // El inicio de sesión en curso vale una sola vez.
    expect(jar.get("einvoice_login.0")).toBeUndefined();
    expect(log).toEqual([]);
  });

  it("refuses a callback nobody started here, and records it", async () => {
    const response = await callback("code=abc&state=inventado");

    expect(response.headers.get("location")).toBe(`${APP}/ingresar?error=sesion`);
    expect(jar.values.size).toBe(0);
    expect(log).toContainEqual(expect.objectContaining({ event: "login.failed", reason: "no-pending-login" }));
  });

  it("opens no session when the provider refuses the code, and records why without the code", async () => {
    const pending = await pendingLogin("/");
    idp.onToken(() => ({ status: 400, body: { error: "invalid_grant" } }));

    const response = await callback(`code=codigo-de-un-solo-uso&state=${pending.state}`);

    expect(response.headers.get("location")).toBe(`${APP}/ingresar?error=proveedor`);
    expect(jar.get(`${SESSION_COOKIE}.0`)).toBeUndefined();
    expect(log).toContainEqual(expect.objectContaining({ event: "login.failed", reason: "exchange" }));
    expect(JSON.stringify(log)).not.toContain("codigo-de-un-solo-uso");
    expect(JSON.stringify(log)).not.toContain(pending.codeVerifier);
  });

  it("opens no session when the state is not the one this browser was given", async () => {
    await pendingLogin("/");

    const response = await callback("code=abc&state=el-de-otro");

    expect(response.headers.get("location")).toBe(`${APP}/ingresar?error=proveedor`);
    expect(jar.get(`${SESSION_COOKIE}.0`)).toBeUndefined();
  });
});
