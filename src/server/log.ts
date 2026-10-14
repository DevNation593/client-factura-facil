export type LogFields = Record<string, string | number | boolean | null | undefined>;

/** Nombres de campo que nunca se escriben, por si alguien pasa una credencial por descuido. */
const SENSITIVE = /token|secret|password|cookie|authorization/i;

/**
 * Registro de lo que le pasa al servidor web, una línea JSON por evento, para que quien opera pueda
 * diagnosticar un inicio de sesión o una llamada a la API que falla. Solo identificadores y motivos:
 * nunca tokens, cookies ni cuerpos de petición.
 */
export function logEvent(level: "info" | "warn" | "error", event: string, fields: LogFields = {}): void {
  const safe = Object.fromEntries(Object.entries(fields).filter(([name]) => !SENSITIVE.test(name)));
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...safe });
  if (level === "error") {
    console.error(line);
  }
  else if (level === "warn") {
    console.warn(line);
  }
  else {
    console.info(line);
  }
}
