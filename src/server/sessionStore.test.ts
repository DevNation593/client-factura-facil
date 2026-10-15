// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeCookieJar, putChunks, type FakeCookieJar } from "@/test/cookies";
import { accessToken, tokensResponse } from "@/test/tokens";

import { readConfig } from "./config";
import { openSession, readChunks, sealSession, SESSION_COOKIE, type Session } from "./session";
import { usableSession } from "./sessionStore";

const request = vi.hoisted(() => ({ jar: undefined as unknown }));
vi.mock("next/headers", () => ({ cookies: async () => request.jar }));

const config = readConfig({
  API_BASE_URL: "http://api.interno:8080",
  APP_BASE_URL: "http://localhost:3000",
  SESSION_SECRET: "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres",
});

const NEW_TOKEN = accessToken({ sub: "u-1", email: "ana@example.test" });

let jar: FakeCookieJar;
let refreshes: string[];

beforeEach(() => {
  refreshes = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** La API responde a /auth/refresh con lo que diga `reply`; todo lo demás es un error de la prueba. */
function api(reply: (refreshToken: string) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url !== "http://api.interno:8080/api/v1/auth/refresh") {
      throw new Error(`Llamada inesperada a ${url}`);
    }
    const { refreshToken } = JSON.parse(String(init?.body)) as { refreshToken: string };
    refreshes.push(refreshToken);
    return reply(refreshToken);
  });
}

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

function renewed() {
  api(async (refreshToken) => {
    // Como la API de verdad, tarda: las peticiones simultáneas se cruzan.
    await new Promise((resolve) => setTimeout(resolve, 50));
    return tokensResponse(NEW_TOKEN, `${refreshToken}-rotado`);
  });
}

describe("usableSession", () => {
  it("renews once when several requests arrive together with the same expiring session", async () => {
    renewed();
    await arrive(session("refresco-a", 5_000));

    const results = await Promise.all([usableSession(config), usableSession(config), usableSession(config)]);

    // La API cambia el token de renovación en cada uso: verlo dos veces cerraría la sesión.
    expect(refreshes).toEqual(["refresco-a"]);
    for (const result of results) {
      expect(result).toMatchObject({ accessToken: NEW_TOKEN, refreshToken: "refresco-a-rotado", name: "ana@example.test" });
    }
    expect(await stored(jar)).toMatchObject({ accessToken: NEW_TOKEN, refreshToken: "refresco-a-rotado" });
  });

  it("keeps the start of the session when it renews: the session does not last longer", async () => {
    renewed();
    const current = session("refresco-f", 5_000);
    await arrive(current);

    expect(await usableSession(config)).toMatchObject({ startedAt: current.startedAt });
  });

  it("gives a request that still carries the old cookies the session that was just renewed", async () => {
    renewed();
    const old = session("refresco-b", 5_000);
    await arrive(old);
    await usableSession(config);

    // Otra petición del mismo navegador que salió antes de recibir las cookies nuevas.
    const late = await arrive(old);
    const result = await usableSession(config);

    expect(refreshes).toHaveLength(1);
    expect(result).toMatchObject({ accessToken: NEW_TOKEN });
    expect(await stored(late)).toMatchObject({ accessToken: NEW_TOKEN });
  });

  it("ends the session when the API no longer accepts the refresh token", async () => {
    api(() => new Response(JSON.stringify({ status: 401, errorCode: "INVALID_REFRESH_TOKEN" }), { status: 401 }));
    await arrive(session("refresco-c", -1_000));

    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(await usableSession(config)).toBeNull();
    expect(jar.values.size).toBe(0);
    expect(String(info.mock.calls[0]?.[0])).toContain('"event":"session.refresh.rejected"');
  });

  it("keeps using a token that is still valid when the API cannot be reached to renew it", async () => {
    api(() => new Response("en mantenimiento", { status: 503 }));
    const current = session("refresco-d", 10_000);
    await arrive(current);
    const before = new Map(jar.values);

    expect(await usableSession(config)).toMatchObject({ accessToken: "viejo" });
    expect(jar.values).toEqual(before);
  });

  it("does not sign the user out when the token expired and the API is down", async () => {
    api(() => {
      throw new TypeError("fetch failed");
    });
    await arrive(session("refresco-e", -1_000));
    const before = new Map(jar.values);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await usableSession(config)).toBe("unavailable");
    expect(String(warn.mock.calls[0]?.[0])).toContain('"event":"session.refresh.unavailable"');
    // Dice si el usuario pudo seguir trabajando o se quedó sin poder renovar.
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({ accessStillValid: false });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("refresco-e");
    // La sesión sigue ahí: cuando la API vuelva, se renueva sin pedir la contraseña.
    expect(jar.values).toEqual(before);
  });
});
