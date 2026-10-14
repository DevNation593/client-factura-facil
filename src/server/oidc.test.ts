// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startFakeIdp, type FakeIdp } from "@/test/idp";

import { readConfig, type ServerConfig } from "./config";
import { beginLogin, completeLogin, safeReturnTo } from "./oidc";

describe("safeReturnTo", () => {
  it("keeps paths of this site", () => {
    expect(safeReturnTo("/documentos")).toBe("/documentos");
    expect(safeReturnTo("/documentos/abc?x=1")).toBe("/documentos/abc?x=1");
  });

  it("never returns somewhere else", () => {
    for (const value of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "documentos", "/a\r\nb", "javascript:alert(1)"]) {
      expect(safeReturnTo(value), String(value)).toBe("/");
    }
  });
});

describe("inicio de sesión", () => {
  let idp: FakeIdp;
  let config: ServerConfig;

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

  function answerWith(idToken: string) {
    idp.onToken(() => ({
      status: 200,
      body: { access_token: "acceso", token_type: "Bearer", expires_in: 300, refresh_token: "refresco", id_token: idToken },
    }));
  }

  it("exchanges the code with PKCE and opens a session that can later end the provider's", async () => {
    const { url, pending } = await beginLogin(config, "/documentos");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const idToken = await idp.idToken({ audience: "einvoice-web", subject: "u-1", nonce: pending.nonce, name: "Ana Pérez" });
    answerWith(idToken);

    const session = await completeLogin(config, new URL(`http://localhost:3000/auth/callback?code=abc&state=${pending.state}`), pending);

    expect(idp.tokenRequests.at(-1)?.get("code_verifier")).toBe(pending.codeVerifier);
    expect(session).toMatchObject({ accessToken: "acceso", refreshToken: "refresco", subject: "u-1", name: "Ana Pérez", idToken });
  });

  it("rejects a callback whose state is not the one it sent", async () => {
    const { pending } = await beginLogin(config, "/");
    answerWith(await idp.idToken({ audience: "einvoice-web", subject: "u-1", nonce: pending.nonce }));

    await expect(completeLogin(config, new URL("http://localhost:3000/auth/callback?code=abc&state=otro"), pending)).rejects.toThrow();
  });

  it("rejects an identity token issued for another sign-in", async () => {
    const { pending } = await beginLogin(config, "/");
    answerWith(await idp.idToken({ audience: "einvoice-web", subject: "u-1", nonce: "otro-nonce" }));

    await expect(
      completeLogin(config, new URL(`http://localhost:3000/auth/callback?code=abc&state=${pending.state}`), pending),
    ).rejects.toThrow();
  });
});
