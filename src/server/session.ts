import { CompactEncrypt, compactDecrypt } from "jose";

/**
 * Sesión del usuario. Vive cifrada en cookies httpOnly: el navegador la transporta pero no puede
 * leerla, y el código de la página nunca ve los tokens.
 */
export type Session = {
  accessToken: string;
  refreshToken?: string;
  /** Caducidad del token de acceso, en milisegundos desde la época. */
  expiresAt: number;
  /** Inicio de la sesión: no se prolonga más allá de MAX_SESSION_AGE_MS aunque se renueve el token. */
  startedAt: number;
  /** Id del usuario en la API. */
  subject: string;
  /** Lo que se muestra del usuario: su correo. */
  name?: string;
};

/** Nombre base de las cookies de sesión; los trozos son `einvoice_session.0`, `.1`… */
export const SESSION_COOKIE = "einvoice_session";

/** Una cookie admite unos 4096 bytes con su nombre y atributos: los trozos dejan margen. */
export const MAX_CHUNK = 3500;

/** Duración máxima de una sesión, por mucho que se renueve el token. */
export const MAX_SESSION_AGE_MS = 12 * 60 * 60 * 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function key(secret: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(secret)));
}

/** Cifra un valor cualquiera (AES-256-GCM, con integridad) y lo reparte en trozos del tamaño de una cookie. */
export async function seal(value: unknown, secret: string): Promise<string[]> {
  const sealed = await new CompactEncrypt(encoder.encode(JSON.stringify(value)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(await key(secret));
  const chunks: string[] = [];
  for (let start = 0; start < sealed.length; start += MAX_CHUNK) {
    chunks.push(sealed.slice(start, start + MAX_CHUNK));
  }
  return chunks;
}

/** Descifra lo que produjo seal. Nulo si falta algo, fue manipulado o se cifró con otro secreto. */
export async function open(chunks: string[], secret: string): Promise<unknown | null> {
  if (chunks.length === 0) {
    return null;
  }
  try {
    const { plaintext } = await compactDecrypt(chunks.join(""), await key(secret), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    return JSON.parse(decoder.decode(plaintext));
  }
  catch {
    return null;
  }
}

export function sealSession(session: Session, secret: string): Promise<string[]> {
  return seal(session, secret);
}

export async function openSession(chunks: string[], secret: string): Promise<Session | null> {
  const value = await open(chunks, secret);
  if (!isSession(value)) {
    return null;
  }
  if (Date.now() - value.startedAt > MAX_SESSION_AGE_MS) {
    return null;
  }
  return value;
}

function isSession(value: unknown): value is Session {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === "string"
    && candidate.accessToken.length > 0
    && typeof candidate.expiresAt === "number"
    && typeof candidate.startedAt === "number"
    && typeof candidate.subject === "string"
    && (candidate.refreshToken === undefined || typeof candidate.refreshToken === "string")
    && (candidate.name === undefined || typeof candidate.name === "string")
  );
}

/** Reúne en orden los trozos de una cookie repartida (`nombre.0`, `nombre.1`…) hasta el primero que falte. */
export function readChunks(name: string, get: (cookie: string) => string | undefined): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < 20; index++) {
    const value = get(`${name}.${index}`);
    if (value === undefined || value === "") {
      break;
    }
    chunks.push(value);
  }
  return chunks;
}
