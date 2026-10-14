import type { components } from "./schema";

export type Problem = components["schemas"]["Problem"];

/** Error devuelto por la API, con lo necesario para explicárselo al usuario. */
export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly correlationId?: string;
  readonly detail?: string;
  /** Mensajes por campo; solo los trae VALIDATION_FAILED. */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, problem: Partial<Problem> | null) {
    super(problem?.detail ?? problem?.errorCode ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = problem?.errorCode ?? "UNKNOWN";
    this.correlationId = problem?.correlationId;
    this.detail = problem?.detail;
    const fieldErrors: Record<string, string> = {};
    for (const item of problem?.errors ?? []) {
      if (item.field && item.message) {
        fieldErrors[item.field] = item.message;
      }
    }
    this.fieldErrors = fieldErrors;
  }
}

export function toApiError(response: Response, body: unknown): ApiError {
  const problem = body !== null && typeof body === "object" ? (body as Partial<Problem>) : null;
  return new ApiError(response.status, problem);
}

/**
 * Códigos cuyo mensaje del servidor no basta o conviene decir de otra forma. Para el resto se
 * muestra el detalle que envía la API, que ya viene en español.
 */
const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Su sesión terminó. Inicie sesión de nuevo.",
  FORBIDDEN: "No tiene permiso para hacer esto.",
  ROLE_FORBIDDEN: "Su rol en esta empresa no permite esta operación.",
  TENANT_REQUIRED: "Elija la empresa con la que quiere trabajar.",
  TENANT_FORBIDDEN: "Ya no tiene acceso a esa empresa. Elija otra.",
  NOT_FOUND: "No se encontró lo que buscaba.",
  VALIDATION_FAILED: "Revise los campos marcados.",
  RUC_ALREADY_REGISTERED: "Ese RUC ya está registrado en la plataforma.",
  CUSTOMER_ALREADY_EXISTS: "Ya existe un cliente con esa identificación.",
  PRODUCT_SKU_TAKEN: "Ya existe un producto con ese código.",
  ESTABLISHMENT_CODE_TAKEN: "Ya existe un establecimiento con ese código.",
  EMISSION_POINT_CODE_TAKEN: "Ya existe un punto de emisión con ese código.",
  SEQUENCE_ALREADY_USED: "El secuencial ya no se puede cambiar: el punto de emisión ya tiene comprobantes.",
  IDENTIFICATION_INVALID: "El número de identificación no corresponde al tipo elegido.",
  PAYMENTS_MISMATCH: "La suma de los pagos no coincide con el total de la factura.",
  FINAL_CONSUMER_LIMIT_EXCEEDED: "Una factura a consumidor final no puede superar el monto permitido: identifique al cliente.",
  CERTIFICATE_UNREADABLE: "El archivo no es un certificado .p12 válido o la contraseña es incorrecta.",
  CERTIFICATE_EXPIRED: "El certificado está caducado.",
  CERTIFICATE_NOT_YET_VALID: "El certificado todavía no está vigente.",
  CERTIFICATE_KEY_MISMATCH: "La clave privada del archivo no corresponde a su certificado.",
  RIMPE_REGIME_UNSUPPORTED: "Todavía no se pueden registrar contribuyentes RIMPE negocio popular.",
  REPLACED_DOCUMENT_NOT_REJECTED: "Solo se puede reemplazar un comprobante que el SRI devolvió o no autorizó, o cuyo XML no se pudo generar.",
  REPLACED_DOCUMENT_OTHER_ISSUER: "El comprobante que se reemplaza es de otro emisor. Emita la factura nueva con el mismo emisor.",
  DOCUMENT_ALREADY_REPLACED: "Ese comprobante ya fue reemplazado por otra factura. Revise los comprobantes.",
  INVITATION_NOT_VALID: "La invitación no es válida: el enlace no existe, caducó o ya se usó. Pida una nueva a quien le invitó.",
  INVITATION_EMAIL_MISMATCH: "Esta invitación es para otro correo. Cierre sesión e ingrese con la cuenta a la que se envió.",
  EMAIL_NOT_VERIFIED: "Su cuenta aún no tiene el correo verificado. Verifíquelo y vuelva a abrir el enlace.",
  ALREADY_MEMBER: "Esa persona ya forma parte de la empresa.",
  ROLE_NOT_GRANTABLE: "Su rol no permite conceder ni retirar ese rol.",
  OWNER_PROTECTED: "El propietario de la empresa no se puede retirar ni cambiar de rol.",
  WEBHOOKS_DISABLED: "Los avisos a otros sistemas no están habilitados en esta instalación. Pídalo a quien la administra.",
  WEBHOOK_LIMIT_REACHED: "La empresa ya tiene el máximo de direcciones registradas. Borre alguna antes de registrar otra.",
  WEBHOOK_DELIVERY_NOT_RETRYABLE: "Solo se puede reintentar un aviso que falló; este está pendiente o ya se entregó.",
  WEBHOOK_SUBSCRIPTION_DISABLED: "Esa dirección está apagada. Enciéndala antes de reintentar sus avisos.",
  INVITATION_LIMIT_REACHED: "La empresa ya tiene demasiadas invitaciones pendientes. Anule alguna antes de invitar a alguien más.",
  RATE_LIMITED: "Está haciendo demasiadas peticiones. Espere unos segundos e inténtelo de nuevo.",
  PRODUCTION_NOT_ENABLED: "Un emisor se registra en el ambiente de pruebas; el paso a producción se activa después.",
  PRODUCTION_REQUIREMENTS_NOT_MET: "El emisor todavía no cumple los requisitos para pasar a producción.",
  IDEMPOTENCY_KEY_REUSED: "Este borrador ya se había emitido con otro contenido. Revise los comprobantes antes de volver a emitir.",
  DOCUMENT_NOT_RETRYABLE: "Este comprobante ya no admite reintento.",
  DOCUMENT_NOT_AUTHORIZED: "Solo se puede enviar un comprobante autorizado.",
  DELIVERY_DISABLED: "El envío de comprobantes por correo no está habilitado en la plataforma.",
  DELIVERY_LIMIT_REACHED: "Este comprobante ya alcanzó el máximo de envíos por correo.",
  DELIVERY_RECIPIENT_MISSING: "El comprobante no tiene correo del cliente: indique una dirección.",
};

/** Mensaje en español para mostrar al usuario. Nunca incluye datos técnicos salvo el código de soporte. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "No se pudo contactar con el servidor. Revise su conexión e inténtelo de nuevo.";
  }
  const known = MESSAGES[error.errorCode];
  if (known) {
    return known;
  }
  if (error.status >= 502 && error.status <= 504) {
    // La API está caída, reiniciándose o tarda: no es un fallo que el usuario deba reportar.
    return "El servidor no está disponible en este momento. Inténtelo de nuevo en unos minutos.";
  }
  if (error.status >= 500) {
    return error.correlationId
      ? `Ocurrió un error inesperado. Si persiste, indique este código a soporte: ${error.correlationId}.`
      : "El servidor no está disponible en este momento. Inténtelo de nuevo en unos minutos.";
  }
  return error.detail ?? "No se pudo completar la operación.";
}
