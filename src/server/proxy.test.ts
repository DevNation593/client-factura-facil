// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readConfig } from "./config";
import { buildBackendRequest, type ProxyInput } from "./proxy";
import type { Session } from "./session";

const config = readConfig({
  API_BASE_URL: "http://api.interno:8080",
  APP_BASE_URL: "https://facturas.example.com",
  OIDC_ISSUER: "https://idp.example.com/realms/einvoice",
  OIDC_CLIENT_ID: "einvoice-web",
  SESSION_SECRET: "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres",
});

const session: Session = {
  accessToken: "el-token",
  expiresAt: Date.now() + 300_000,
  startedAt: Date.now(),
  subject: "u-1",
};

const TENANT = "0b9d6c5e-3f0a-4a57-9c0e-2f1d3b4a5c6d";

function input(overrides: Partial<ProxyInput> = {}): ProxyInput {
  return {
    method: "GET",
    path: ["customers"],
    search: "",
    headers: new Headers(),
    body: null,
    session,
    tenantId: TENANT,
    config,
    ...overrides,
  };
}

function sameOrigin(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "X-Requested-With": "einvoice-web",
    "Sec-Fetch-Site": "same-origin",
    Origin: "https://facturas.example.com",
    ...extra,
  });
}

function expectForwarded(result: ReturnType<typeof buildBackendRequest>) {
  if ("error" in result) {
    throw new Error(`rechazada con ${result.error}`);
  }
  return result;
}

describe("buildBackendRequest", () => {
  it("forwards to the API with the bearer token and the active tenant", () => {
    const result = expectForwarded(buildBackendRequest(input({ search: "?q=a&page=1" })));

    expect(result.url).toBe("http://api.interno:8080/api/v1/customers?q=a&page=1");
    expect(result.init.method).toBe("GET");
    const headers = new Headers(result.init.headers);
    expect(headers.get("Authorization")).toBe("Bearer el-token");
    expect(headers.get("X-Tenant-Id")).toBe(TENANT);
  });

  it("never forwards cookies or host headers, only what the API needs", () => {
    const headers = sameOrigin({
      Cookie: "einvoice_session.0=secreto",
      Host: "facturas.example.com",
      Authorization: "Bearer del-navegador",
      "X-Forwarded-For": "1.2.3.4",
      "Content-Type": "application/json",
      "Idempotency-Key": "clave-1",
      Accept: "application/json",
    });

    const result = expectForwarded(
      buildBackendRequest(input({ method: "POST", path: ["invoices"], headers, body: "{}" })),
    );

    const sent = new Headers(result.init.headers);
    expect([...sent.keys()].sort()).toEqual(
      ["accept", "authorization", "content-type", "idempotency-key", "x-tenant-id"].sort(),
    );
    expect(sent.get("Authorization")).toBe("Bearer el-token");
    expect(sent.get("X-Tenant-Id")).toBe(TENANT);
    expect(result.init.body).toBe("{}");
  });

  it("uses the company of the tab that made the request over the one left in the cookie", () => {
    const ofTheTab = "11111111-1111-4111-8111-111111111111";

    const result = expectForwarded(buildBackendRequest(input({ headers: new Headers({ "X-Tenant-Id": ofTheTab }) })));

    // Otra pestaña pudo cambiar la cookie; la petición dice con qué empresa trabaja quien la hizo.
    expect(new Headers(result.init.headers).get("X-Tenant-Id")).toBe(ofTheTab);
  });

  it("falls back to the cookie's company when the request names none or a malformed one", () => {
    for (const headers of [new Headers(), new Headers({ "X-Tenant-Id": "no-es-un-uuid" })]) {
      const result = expectForwarded(buildBackendRequest(input({ headers })));

      expect(new Headers(result.init.headers).get("X-Tenant-Id")).toBe(TENANT);
    }
  });

  it("omits the tenant header when no valid tenant is selected", () => {
    for (const tenantId of [null, "", "no-es-un-uuid", `${TENANT}\r\nX-Evil: 1`]) {
      const result = expectForwarded(buildBackendRequest(input({ tenantId })));

      expect(new Headers(result.init.headers).has("X-Tenant-Id")).toBe(false);
    }
  });

  it("rejects traversal, absolute and malformed paths", () => {
    const bad: string[][] = [
      [],
      ["..", "actuator"],
      ["customers", ".."],
      ["."],
      ["%2e%2e", "actuator"],
      ["http:", "evil.example"],
      ["customers", ""],
      ["cust\nomers"],
      ["customers/../../actuator"],
      ["customers?x=1"],
      ["customers#x"],
      ["a b"],
    ];
    for (const path of bad) {
      expect(buildBackendRequest(input({ path })), JSON.stringify(path)).toEqual({ error: 400 });
    }
    // Un identificador normal sí pasa.
    expectForwarded(buildBackendRequest(input({ path: ["documents", TENANT, "artifacts", "xml-signed"] })));
  });

  it("requires same origin and the marker header for requests that change data", () => {
    const post = (headers: Headers) => buildBackendRequest(input({ method: "POST", path: ["customers"], headers, body: "{}" }));

    expect(post(new Headers({ "Sec-Fetch-Site": "same-origin" }))).toEqual({ error: 403 });
    expect(post(new Headers({ "X-Requested-With": "einvoice-web", "Sec-Fetch-Site": "cross-site" }))).toEqual({ error: 403 });
    expect(post(new Headers({ "X-Requested-With": "einvoice-web", "Sec-Fetch-Site": "same-site" }))).toEqual({ error: 403 });
    expect(post(new Headers({ "X-Requested-With": "einvoice-web", Origin: "https://evil.example" }))).toEqual({ error: 403 });
    expect(post(new Headers({ "X-Requested-With": "einvoice-web" }))).toEqual({ error: 403 });
    expect(
      post(new Headers({ "X-Requested-With": "einvoice-web", "Sec-Fetch-Site": "same-origin", Origin: "https://evil.example" })),
    ).toEqual({ error: 403 });

    expectForwarded(post(sameOrigin()));
    expectForwarded(post(new Headers({ "X-Requested-With": "einvoice-web", Origin: "https://facturas.example.com" })));
    expectForwarded(buildBackendRequest(input({ method: "PUT", path: ["emission-points", TENANT, "sequence"], headers: sameOrigin(), body: "{}" })));
  });

  it("answers 401 without a session", () => {
    expect(buildBackendRequest(input({ session: null }))).toEqual({ error: 401 });
    expect(buildBackendRequest(input({ session: null, method: "POST", headers: sameOrigin(), body: "{}" }))).toEqual({ error: 401 });
  });

  it("forwards a DELETE under the same conditions as any request that changes data", () => {
    const result = expectForwarded(buildBackendRequest(input({ method: "DELETE", path: ["members", TENANT], headers: sameOrigin() })));
    expect(result.init.method).toBe("DELETE");
    expect(result.url).toBe(`http://api.interno:8080/api/v1/members/${TENANT}`);

    expect(buildBackendRequest(input({ method: "DELETE", path: ["members", TENANT], headers: new Headers() }))).toEqual({ error: 403 });
    expect(
      buildBackendRequest(
        input({ method: "DELETE", path: ["members", TENANT], headers: sameOrigin({ Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }) }),
      ),
    ).toEqual({ error: 403 });
  });

  it("allows only the methods the API uses", () => {
    for (const method of ["PATCH", "OPTIONS", "TRACE", "CONNECT"]) {
      expect(buildBackendRequest(input({ method, headers: sameOrigin() })), method).toEqual({ error: 405 });
    }
  });

  it("does not send a body with GET", () => {
    const result = expectForwarded(buildBackendRequest(input({ body: "ignorado" })));

    expect(result.init.body).toBeUndefined();
  });
});
