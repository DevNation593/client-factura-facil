import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

type TokenReply = { status: number; body: unknown };

/** Proveedor OIDC mínimo, en la propia máquina, para probar el código de servidor contra HTTP real. */
export type FakeIdp = {
  issuer: string;
  /** Peticiones recibidas en el punto de tokens, en orden. */
  tokenRequests: URLSearchParams[];
  /** Decide qué responde el punto de tokens a partir de ahora. */
  onToken(handler: (parameters: URLSearchParams) => TokenReply | Promise<TokenReply>): void;
  /** Token de identidad firmado por este proveedor. */
  idToken(claims: { audience: string; subject: string; nonce: string; name?: string }): Promise<string>;
  close(): Promise<void>;
};

async function read(request: IncomingMessage): Promise<string> {
  const parts: Buffer[] = [];
  for await (const part of request) {
    parts.push(part as Buffer);
  }
  return Buffer.concat(parts).toString("utf8");
}

export async function startFakeIdp(): Promise<FakeIdp> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "prueba", alg: "RS256", use: "sig" };
  const tokenRequests: URLSearchParams[] = [];
  let handler: (parameters: URLSearchParams) => TokenReply | Promise<TokenReply> = () => ({ status: 500, body: "sin respuesta definida" });
  let issuer = "";

  const server: Server = createServer((request, response) => {
    void (async () => {
      const send = (status: number, body: unknown) => {
        const text = typeof body === "string" ? body : JSON.stringify(body);
        response.writeHead(status, { "Content-Type": typeof body === "string" ? "text/plain" : "application/json" });
        response.end(text);
      };
      if (request.url === "/.well-known/openid-configuration") {
        send(200, {
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          end_session_endpoint: `${issuer}/logout`,
          jwks_uri: `${issuer}/jwks`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
        });
        return;
      }
      if (request.url === "/jwks") {
        send(200, { keys: [jwk] });
        return;
      }
      if (request.url === "/token" && request.method === "POST") {
        const parameters = new URLSearchParams(await read(request));
        tokenRequests.push(parameters);
        const reply = await handler(parameters);
        send(reply.status, reply.body);
        return;
      }
      send(404, "no existe");
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    issuer,
    tokenRequests,
    onToken(next) {
      handler = next;
    },
    idToken(claims) {
      return new SignJWT({ nonce: claims.nonce, name: claims.name })
        .setProtectedHeader({ alg: "RS256", kid: "prueba" })
        .setIssuer(issuer)
        .setAudience(claims.audience)
        .setSubject(claims.subject)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
    },
    close() {
      return new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}
