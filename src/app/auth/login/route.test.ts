// @vitest-environment node
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeCookieJar, type FakeCookieJar } from "@/test/cookies";
import { startFakeIdp, type FakeIdp } from "@/test/idp";

import { GET } from "./route";

const incoming = vi.hoisted(() => ({ jar: undefined as unknown }));
vi.mock("next/headers", () => ({ cookies: async () => incoming.jar }));

const APP = "http://localhost:3000";

let idp: FakeIdp;
let jar: FakeCookieJar;

/** Un puerto de esta máquina en el que nadie escucha. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

beforeAll(async () => {
  idp = await startFakeIdp();
  vi.stubEnv("API_BASE_URL", "http://api.interno:8080");
  vi.stubEnv("APP_BASE_URL", APP);
  vi.stubEnv("OIDC_CLIENT_ID", "einvoice-web");
  vi.stubEnv("SESSION_SECRET", "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await idp.close();
});

beforeEach(() => {
  jar = fakeCookieJar();
  incoming.jar = jar;
});

describe("inicio de sesión", () => {
  // Va primero: el proveedor se descubre una vez por proceso y un fallo no se recuerda.
  it("sends the user back with a message, and tells the operator, when the provider cannot be reached", async () => {
    vi.stubEnv("OIDC_ISSUER", `http://127.0.0.1:${await closedPort()}/realms/einvoice`);
    const lines: Record<string, unknown>[] = [];
    vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      lines.push(JSON.parse(String(line)) as Record<string, unknown>);
    });

    const response = await GET(new NextRequest(`${APP}/auth/login?volver=%2Fdocumentos`));

    expect(response.headers.get("location")).toBe(`${APP}/ingresar?error=proveedor`);
    expect(jar.values.size).toBe(0);
    expect(lines).toContainEqual(expect.objectContaining({ event: "login.failed", reason: "provider-unreachable" }));
  });

  it("sends the user to the provider with PKCE and remembers where they were going", async () => {
    vi.stubEnv("OIDC_ISSUER", idp.issuer);

    const response = await GET(new NextRequest(`${APP}/auth/login?volver=%2Fdocumentos`));

    const destination = new URL(response.headers.get("location") ?? "");
    expect(destination.origin + destination.pathname).toBe(`${idp.issuer}/authorize`);
    expect(destination.searchParams.get("code_challenge_method")).toBe("S256");
    expect(destination.searchParams.get("redirect_uri")).toBe(`${APP}/auth/callback`);
    expect(destination.searchParams.get("state")).toBeTruthy();
    // Lo necesario para validar la vuelta viaja cifrado en una cookie, no en la dirección.
    expect(jar.get("einvoice_login.0")?.value).toBeTruthy();
    expect(destination.search).not.toContain("documentos");
  });
});
