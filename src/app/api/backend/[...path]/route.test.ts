// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { sealSession, SESSION_COOKIE, type Session } from "@/server/session";
import { fakeCookieJar, putChunks, type FakeCookieJar } from "@/test/cookies";
import { startFakeIdp, type FakeIdp } from "@/test/idp";

import { POST } from "./route";

const incoming = vi.hoisted(() => ({ jar: undefined as unknown }));
vi.mock("next/headers", () => ({ cookies: async () => incoming.jar }));

const SECRET = "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres";
const API = "http://api.interno:8080";
const APP = "http://localhost:3000";
const TENANT_OF_THE_TAB = "0b9d6c5e-3f0a-4a57-9c0e-2f1d3b4a5c6d";
const TENANT_OF_THE_COOKIE = "7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

let idp: FakeIdp;
let jar: FakeCookieJar;
let upstream: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

beforeAll(async () => {
  idp = await startFakeIdp();
  vi.stubEnv("API_BASE_URL", API);
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
  upstream = vi.fn(async () => new Response(JSON.stringify({ id: "c-1" }), { status: 201, headers: { "Content-Type": "application/json" } }));
  // Solo las llamadas a la API se simulan; las del proveedor de identidad van de verdad.
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith(API) ? upstream(String(input), init ?? {}) : real(input, init));
});

async function signedIn(overrides: Partial<Session> = {}) {
  const session: Session = { accessToken: "el-token", expiresAt: Date.now() + 300_000, startedAt: Date.now(), subject: "u-1", ...overrides };
  putChunks(jar, SESSION_COOKIE, await sealSession(session, SECRET));
}

const SAME_ORIGIN = { "X-Requested-With": "einvoice-web", "Sec-Fetch-Site": "same-origin", Origin: APP, "Content-Type": "application/json" };

function post(body: BodyInit, headers: Record<string, string> = SAME_ORIGIN): NextRequest {
  return new NextRequest(`${APP}/api/backend/customers`, { method: "POST", headers, body, duplex: "half" } as never);
}

function call(request: NextRequest) {
  return POST(request, { params: Promise.resolve({ path: ["customers"] }) });
}

/** Cuerpo sin Content-Length que entrega `total` bytes en trozos, contando cuántos se le pidieron. */
function stream(total: number) {
  const chunk = new Uint8Array(64 * 1024);
  const state = { produced: 0 };
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (state.produced >= total) {
          controller.close();
          return;
        }
        state.produced += chunk.byteLength;
        controller.enqueue(chunk);
      },
    },
    { highWaterMark: 0 },
  );
  return { body, state };
}

describe("proxy de la API", () => {
  it("stops reading a body that grows past the limit, even without Content-Length", async () => {
    await signedIn();
    const { body, state } = stream(32 * 1024 * 1024);

    const response = await call(post(body));

    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
    // No se guardó en memoria más que el límite y lo que ya venía en camino.
    expect(state.produced).toBeLessThan(2 * 1024 * 1024);
  });

  it("does not read the body of a request without a session", async () => {
    const request = post(stream(32 * 1024 * 1024).body);

    const response = await call(request);

    expect(response.status).toBe(401);
    expect(request.bodyUsed).toBe(false);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("does not read the body of a request from another site", async () => {
    await signedIn();
    const request = post(stream(32 * 1024 * 1024).body, { ...SAME_ORIGIN, Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" });

    const response = await call(request);

    expect(response.status).toBe(403);
    expect(request.bodyUsed).toBe(false);
  });

  it("forwards a body within the limit with the session's token", async () => {
    await signedIn();

    const response = await call(post(JSON.stringify({ name: "Ana" })));

    expect(response.status).toBe(201);
    const [url, init] = upstream.mock.calls[0] ?? [];
    expect(url).toBe(`${API}/api/v1/customers`);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer el-token");
    expect(new TextDecoder().decode(init?.body as Uint8Array)).toBe('{"name":"Ana"}');
  });

  it("passes on the API's answer when the user is over the request limit, with how long to wait", async () => {
    await signedIn();
    upstream.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 429, errorCode: "RATE_LIMITED", correlationId: "c-1" }), {
        status: 429,
        headers: { "Content-Type": "application/problem+json", "Retry-After": "30", "X-Interno": "no debe salir" },
      }),
    );

    const response = await call(post(JSON.stringify({ name: "Ana" })));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("X-Interno")).toBeNull();
    expect(((await response.json()) as { errorCode: string }).errorCode).toBe("RATE_LIMITED");
  });

  /** Líneas de log escritas durante la prueba, ya interpretadas. */
  function captureLog() {
    const lines: Record<string, unknown>[] = [];
    for (const level of ["info", "warn", "error"] as const) {
      vi.spyOn(console, level).mockImplementation((line: unknown) => {
        lines.push(JSON.parse(String(line)) as Record<string, unknown>);
      });
    }
    return lines;
  }

  it("gives up on an API that does not answer, says so and leaves a trace an operator can follow", async () => {
    vi.stubEnv("API_TIMEOUT_MS", "50");
    try {
      await signedIn();
      const log = captureLog();
      upstream.mockImplementationOnce(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      );

      const response = await call(post(JSON.stringify({ name: "Ana" })));

      expect(response.status).toBe(504);
      const body = (await response.json()) as { correlationId: string };
      expect(log).toContainEqual(
        expect.objectContaining({ event: "proxy.upstream.timeout", level: "warn", correlationId: body.correlationId, method: "POST", path: "customers" }),
      );
      // Ni el token de la sesión ni el cuerpo de la petición llegan al log.
      expect(JSON.stringify(log)).not.toContain("el-token");
      expect(JSON.stringify(log)).not.toContain("Ana");
    }
    finally {
      vi.stubEnv("API_TIMEOUT_MS", "");
    }
  });

  it("does not cut short an answer that started in time but takes longer than the limit to arrive whole", async () => {
    vi.stubEnv("API_TIMEOUT_MS", "50");
    try {
      await signedIn();
      const encoder = new TextEncoder();
      // Como hace fetch de verdad: si la señal se dispara con el cuerpo a medias, el cuerpo falla.
      upstream.mockImplementationOnce((_url, init) => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode("primera parte, "));
            const rest = setTimeout(() => {
              controller.enqueue(encoder.encode("segunda parte"));
              controller.close();
            }, 200);
            init.signal?.addEventListener("abort", () => {
              clearTimeout(rest);
              controller.error(init.signal?.reason);
            });
          },
        });
        return Promise.resolve(new Response(body, { status: 200, headers: { "Content-Type": "application/pdf" } }));
      });

      const response = await call(post(JSON.stringify({ name: "Ana" })));

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("primera parte, segunda parte");
    }
    finally {
      vi.stubEnv("API_TIMEOUT_MS", "");
    }
  });

  it("reports an unreachable API with the same code it logged", async () => {
    await signedIn();
    const log = captureLog();
    upstream.mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await call(post(JSON.stringify({ name: "Ana" })));

    expect(response.status).toBe(502);
    const body = (await response.json()) as { correlationId: string };
    expect(log).toContainEqual(expect.objectContaining({ event: "proxy.upstream.failed", correlationId: body.correlationId }));
  });

  it("works with the company of the tab that made the request, not the one another tab left in the cookie", async () => {
    await signedIn();
    jar.set("einvoice_tenant", TENANT_OF_THE_COOKIE);

    await call(post(JSON.stringify({ name: "Ana" }), { ...SAME_ORIGIN, "X-Tenant-Id": TENANT_OF_THE_TAB }));

    expect(new Headers(upstream.mock.calls[0]?.[1].headers).get("X-Tenant-Id")).toBe(TENANT_OF_THE_TAB);
  });

  it("answers 503 and keeps the session when it cannot be renewed right now", async () => {
    idp.onToken(() => ({ status: 503, body: "en mantenimiento" }));
    await signedIn({ refreshToken: "refresco", expiresAt: Date.now() - 1_000 });
    const before = new Map(jar.values);

    const response = await call(post(JSON.stringify({ name: "Ana" })));

    expect(response.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
    expect(jar.values).toEqual(before);
  });
});
