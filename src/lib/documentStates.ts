import type { components } from "@/api/schema";

export type DocumentState = components["schemas"]["DocumentState"];

export type StateInfo = {
  /** Cómo se le dice al usuario. */
  label: string;
  tone: "progress" | "success" | "warning" | "danger";
  /** Si el comprobante ya no avanza solo: no hace falta seguir consultándolo. */
  final: boolean;
  /** Qué significa y, si hace falta, qué hacer. */
  help: string;
};

/**
 * Los estados del contrato, explicados. Es un Record sobre el tipo generado: si el contrato añade
 * un estado, esto deja de compilar hasta describirlo.
 */
const STATES: Record<DocumentState, StateInfo> = {
  RESERVED: {
    label: "Emitida",
    tone: "progress",
    final: false,
    help: "Ya tiene número y clave de acceso. Falta generar y firmar su XML.",
  },
  GENERATED: { label: "XML generado", tone: "progress", final: false, help: "El XML es válido. Falta firmarlo." },
  SIGNED: {
    label: "Firmada",
    tone: "progress",
    final: false,
    help: "Firmada y a la espera de transmitirse al SRI. Si la transmisión de este ambiente no está habilitada en la plataforma, se queda aquí.",
  },
  SENDING: {
    label: "Enviando al SRI",
    tone: "progress",
    final: false,
    help: "Se está enviando, o el SRI no respondió con claridad y se está comprobando si la recibió antes de reenviar.",
  },
  RECEIVED: {
    label: "Recibida por el SRI",
    tone: "progress",
    final: false,
    help: "El SRI la recibió. Recibida no es autorizada: la autorización puede tardar hasta 24 horas.",
  },
  AUTHORIZED: { label: "Autorizada", tone: "success", final: true, help: "Autorizada por el SRI. Ya tiene validez tributaria." },
  XSD_INVALID: {
    label: "XML inválido",
    tone: "danger",
    final: true,
    help: "No se pudo generar un XML válido con estos datos. No se envió al SRI; puede corregirla y emitirla de nuevo.",
  },
  SIGNATURE_FAILED: {
    label: "Sin firmar",
    tone: "warning",
    final: true,
    help: "No se pudo firmar. Revise que el emisor tenga un certificado vigente y reintente.",
  },
  RETURNED: {
    label: "Devuelta por el SRI",
    tone: "danger",
    final: true,
    help: "El SRI no la recibió por los motivos que se indican más abajo. No tiene validez tributaria.",
  },
  NOT_AUTHORIZED: {
    label: "No autorizada",
    tone: "danger",
    final: true,
    help: "El SRI la rechazó por los motivos que se indican más abajo. No tiene validez tributaria.",
  },
};

export function describeState(state: string): StateInfo {
  return (STATES as Record<string, StateInfo | undefined>)[state]
    ?? { label: state, tone: "warning", final: true, help: "Estado que esta versión de la aplicación no conoce." };
}

export const KNOWN_STATES = Object.keys(STATES) as DocumentState[];

const RETRYABLE: ReadonlySet<string> = new Set(["RESERVED", "GENERATED", "SIGNATURE_FAILED", "SIGNED", "SENDING", "RECEIVED"]);

const REISSUABLE: ReadonlySet<string> = new Set(["RETURNED", "NOT_AUTHORIZED", "XSD_INVALID"]);

/**
 * Fallos sin reintento posible (el SRI lo rechazó, o con esos datos no sale un XML válido): el
 * comprobante no se corrige, se emite otro que lo reemplaza.
 */
export function canReissue(state: string): boolean {
  return REISSUABLE.has(state);
}

/** Estados desde los que la API admite un reintento (los rechazos del SRI no se reintentan tal cual). */
export function canRetry(state: string): boolean {
  return RETRYABLE.has(state);
}

export type ArtifactKind = "xml-unsigned" | "xml-signed" | "sri-authorization" | "xml-authorized" | "ride";

const WITH_UNSIGNED = new Set(["GENERATED", "SIGNATURE_FAILED", "SIGNED", "SENDING", "RECEIVED", "AUTHORIZED", "RETURNED", "NOT_AUTHORIZED"]);
const WITH_SIGNED = new Set(["SIGNED", "SENDING", "RECEIVED", "AUTHORIZED", "RETURNED", "NOT_AUTHORIZED"]);

/** Archivos que un comprobante en ese estado ya tiene para descargar, del más útil al más técnico. */
export function availableArtifacts(state: string): { kind: ArtifactKind; label: string }[] {
  const artifacts: { kind: ArtifactKind; label: string }[] = [];
  if (state === "AUTHORIZED") {
    artifacts.push({ kind: "ride", label: "RIDE (PDF)" }, { kind: "xml-authorized", label: "XML autorizado" });
  }
  if (WITH_SIGNED.has(state)) {
    artifacts.push({ kind: "xml-signed", label: "XML firmado" });
  }
  if (state === "AUTHORIZED") {
    artifacts.push({ kind: "sri-authorization", label: "Respuesta del SRI" });
  }
  if (WITH_UNSIGNED.has(state)) {
    artifacts.push({ kind: "xml-unsigned", label: "XML sin firmar" });
  }
  return artifacts;
}
