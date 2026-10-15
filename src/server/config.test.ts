// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readConfig } from "./config";

const VALID = {
  API_BASE_URL: "http://localhost:8080",
  APP_BASE_URL: "http://localhost:3000",
  SESSION_SECRET: "un-secreto-de-pruebas-de-mas-de-treinta-y-dos-caracteres",
};

describe("readConfig", () => {
  it("reads a complete configuration", () => {
    const config = readConfig(VALID);

    expect(config.apiBaseUrl.origin).toBe("http://localhost:8080");
    expect(config.appBaseUrl.origin).toBe("http://localhost:3000");
    expect(config.secureCookies).toBe(false);
    expect(readConfig({ ...VALID, APP_BASE_URL: "https://facturas.example.com" }).secureCookies).toBe(true);
  });

  it("names the missing variable", () => {
    for (const name of Object.keys(VALID)) {
      expect(() => readConfig({ ...VALID, [name]: "" }), name).toThrow(name);
      expect(() => readConfig({ ...VALID, [name]: undefined }), name).toThrow(name);
    }
  });

  it("rejects a short session secret", () => {
    expect(() => readConfig({ ...VALID, SESSION_SECRET: "corto" })).toThrow("SESSION_SECRET");
    expect(() => readConfig({ ...VALID, SESSION_SECRET: "change-me" })).toThrow("SESSION_SECRET");
  });

  it("requires http or https addresses", () => {
    expect(() => readConfig({ ...VALID, API_BASE_URL: "ftp://localhost" })).toThrow("API_BASE_URL");
    expect(() => readConfig({ ...VALID, API_BASE_URL: "localhost:8080" })).toThrow("API_BASE_URL");
  });

  it("waits 30 seconds for the API unless told otherwise", () => {
    expect(readConfig(VALID).apiTimeoutMs).toBe(30_000);
    expect(readConfig({ ...VALID, API_TIMEOUT_MS: "5000" }).apiTimeoutMs).toBe(5000);
    expect(readConfig({ ...VALID, API_TIMEOUT_MS: "" }).apiTimeoutMs).toBe(30_000);
    for (const bad of ["0", "-1", "abc", "1.5"]) {
      expect(() => readConfig({ ...VALID, API_TIMEOUT_MS: bad }), bad).toThrow("API_TIMEOUT_MS");
    }
  });

  it("refuses to serve the application without TLS anywhere but on this machine", () => {
    // Por http las cookies de sesión viajarían sin Secure.
    expect(() => readConfig({ ...VALID, APP_BASE_URL: "http://facturas.example.com" })).toThrow("APP_BASE_URL debe usar https");
    expect(readConfig({ ...VALID, APP_BASE_URL: "http://127.0.0.1:3000" }).secureCookies).toBe(false);
  });
});
