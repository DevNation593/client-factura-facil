// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { clientIp } from "./authRoute";
import { readConfig } from "./config";

const ENV = {
  API_BASE_URL: "http://localhost:8080",
  APP_BASE_URL: "http://localhost:3000",
  SESSION_SECRET: "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres",
};

function ipFrom(headers: Record<string, string>, hops?: string): string | null {
  const config = readConfig({ ...ENV, TRUSTED_PROXY_HOPS: hops });
  return clientIp(new NextRequest("http://localhost:3000/auth/login", { method: "POST", headers }), config);
}

describe("clientIp", () => {
  it("takes the only entry a replacing proxy leaves", () => {
    expect(ipFrom({ "X-Forwarded-For": "203.0.113.9" })).toBe("203.0.113.9");
    expect(ipFrom({ "X-Forwarded-For": " 2001:db8::1 " })).toBe("2001:db8::1");
  });

  it("ignores what the browser writes to the left of the trusted proxies", () => {
    // Cloud Run directo: el frente de Google añade la IP real al final.
    expect(ipFrom({ "X-Forwarded-For": "1.2.3.4, 203.0.113.9" })).toBe("203.0.113.9");
    expect(ipFrom({ "X-Forwarded-For": "1.2.3.4, 5.6.7.8, 203.0.113.9" })).toBe("203.0.113.9");
    // Con un balanceador HTTPS delante: IP real, luego la del balanceador.
    expect(ipFrom({ "X-Forwarded-For": "1.2.3.4, 203.0.113.9, 34.120.0.1" }, "2")).toBe("203.0.113.9");
    expect(ipFrom({ "X-Forwarded-For": "203.0.113.9, 34.120.0.1" }, "2")).toBe("203.0.113.9");
  });

  it("trusts the first entry when there are fewer than the trusted proxies", () => {
    expect(ipFrom({ "X-Forwarded-For": "203.0.113.9" }, "2")).toBe("203.0.113.9");
  });

  it("gives no address for an empty or oversized entry", () => {
    expect(ipFrom({ "X-Forwarded-For": "203.0.113.9, " })).toBeNull();
    expect(ipFrom({ "X-Forwarded-For": "x".repeat(65) })).toBeNull();
    // La basura a la izquierda no estorba.
    expect(ipFrom({ "X-Forwarded-For": `${"x".repeat(500)},, 203.0.113.9` })).toBe("203.0.113.9");
  });

  it("falls back to X-Real-IP and then to nothing", () => {
    expect(ipFrom({ "X-Real-IP": "203.0.113.9" })).toBe("203.0.113.9");
    expect(ipFrom({ "X-Forwarded-For": " ", "X-Real-IP": "203.0.113.9" })).toBe("203.0.113.9");
    expect(ipFrom({})).toBeNull();
  });
});
