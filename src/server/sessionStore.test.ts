// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeCookieJar, putChunks, type FakeCookieJar } from "@/test/cookies";
import { startFakeIdp, type FakeIdp } from "@/test/idp";

import { readConfig, type ServerConfig } from "./config";
import { openSession, readChunks, sealSession, SESSION_COOKIE, type Session } from "./session";
import { usableSession } from "./sessionStore";

const request = vi.hoisted(() => ({ jar: undefined as unknown }));
vi.mock("next/headers", () => ({ cookies: async () => request.jar }));

let idp: FakeIdp;
let config: ServerConfig;
let jar: FakeCookieJar;

beforeAll(async () => {
  idp = await startFakeIdp();
  config = readConfig({
    API_BASE_URL: "http://api.interno:8080",
    APP_BASE_URL: "http://localhost:3000",
    OIDC_ISSUER: idp.issuer,
    OIDC_CLIENT_ID: "einvoice-web",
    SESSION_SECRET: "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres",
  });
});

afterAll(() => idp.close());

beforeEach(() => {
  idp.tokenRequests.length = 0;
});

/** Sesión cuyo token de acceso caduca dentro de `msLeft` milisegundos (negativo: ya caducó). */
function session(refreshToken: string, msLeft: number): Session {
  return { accessToken: "viejo", refreshToken, expiresAt: Date.now() + msLeft, startedAt: Date.now() - 60_000, subject: "u-1" };
}

async function arrive(current: Session): Promise<FakeCookieJar> {
  jar = fakeCookieJar();
  putChunks(jar, SESSION_COOKIE, await sealSession(current, config.sessionSecret));
  request.jar = jar;
  return jar;
}

function stored(from: FakeCookieJar): Promise<Session | null> {
  return openSession(readChunks(SESSION_COOKIE, (name) => from.get(name)?.value), config.sessionSecret);
}

function renewWith(accessToken: string) {
  idp.onToken(async (parameters) => {
    // Como un proveedor real, tarda: las peticiones simultáneas se cruzan.
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      status: 200,
      body: { access_token: accessToken, token_type: "Bearer", expires_in: 300, refresh_token: `${parameters.get("refresh_token")}-rotado` },
    };
  });
}

describe("usableSession", () => {
  it("renews once when several requests arrive together with the same expiring session", async () => {
    renewWith("nuevo");
    await arrive(session("refresco-a", 5_000));

    const results = await Promise.all([usableSession(config), usableSession(config), usableSession(config)]);

    // Un proveedor que rota el token de refresco rechazaría el segundo uso y cerraría la sesión.
    expect(idp.tokenRequests).toHaveLength(1);
    for (const result of results) {
      expect(result).toMatchObject({ accessToken: "nuevo", refreshToken: "refresco-a-rotado" });
    }
    expect(await stored(jar)).toMatchObject({ accessToken: "nuevo", refreshToken: "refresco-a-rotado" });
  });

  it("gives a request that still carries the old cookies the session that was just renewed", async () => {
    renewWith("nuevo");
    const old = session("refresco-b", 5_000);
    await arrive(old);
    await usableSession(config);

    // Otra petición del mismo navegador que salió antes de recibir las cookies nuevas.
    const late = await arrive(old);
    const result = await usableSession(config);

    expect(idp.tokenRequests).toHaveLength(1);
    expect(result).toMatchObject({ accessToken: "nuevo" });
    expect(await stored(late)).toMatchObject({ accessToken: "nuevo" });
  });

  it("ends the session when the provider no longer accepts the refresh token", async () => {
    idp.onToken(() => ({ status: 400, body: { error: "invalid_grant", error_description: "Token is not active" } }));
    await arrive(session("refresco-c", -1_000));

    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(await usableSession(config)).toBeNull();
    expect(jar.values.size).toBe(0);
    expect(String(info.mock.calls[0]?.[0])).toContain('"event":"session.refresh.rejected"');
  });

  it("keeps using a token that is still valid when the provider cannot be reached to renew it", async () => {
    idp.onToken(() => ({ status: 503, body: "en mantenimiento" }));
    const current = session("refresco-d", 10_000);
    await arrive(current);
    const before = new Map(jar.values);

    expect(await usableSession(config)).toMatchObject({ accessToken: "viejo" });
    expect(jar.values).toEqual(before);
  });

  it("does not sign the user out when the token expired and the provider is down", async () => {
    idp.onToken(() => ({ status: 503, body: "en mantenimiento" }));
    await arrive(session("refresco-e", -1_000));
    const before = new Map(jar.values);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await usableSession(config)).toBe("unavailable");
    expect(String(warn.mock.calls[0]?.[0])).toContain('"event":"session.refresh.unavailable"');
    // Dice si el usuario pudo seguir trabajando o se quedó sin poder renovar.
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({ accessStillValid: false });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("refresco-e");
    // La sesión sigue ahí: cuando el proveedor vuelva, se renueva sin pedir credenciales.
    expect(jar.values).toEqual(before);
  });
});
