import { describe, expect, it } from "vitest";

import { ApiError, describeError, toApiError } from "./problem";

function problem(status: number, body: Record<string, unknown>): ApiError {
  return toApiError(new Response(null, { status }), body);
}

describe("describeError", () => {
  it("maps known error codes to a message for the user", () => {
    expect(describeError(problem(422, { status: 422, errorCode: "PAYMENTS_MISMATCH", correlationId: "c1" }))).toBe(
      "La suma de los pagos no coincide con el total de la factura.",
    );
    expect(describeError(problem(422, { status: 422, errorCode: "CERTIFICATE_UNREADABLE", correlationId: "c1" }))).toBe(
      "El archivo no es un certificado .p12 válido o la contraseña es incorrecta.",
    );
    expect(describeError(problem(400, { status: 400, errorCode: "TENANT_REQUIRED", correlationId: "c1" }))).toBe(
      "Elija la empresa con la que quiere trabajar.",
    );
    expect(describeError(problem(409, { status: 409, errorCode: "DOCUMENT_NOT_RETRYABLE", correlationId: "c1" }))).toBe(
      "Este comprobante ya no admite reintento.",
    );
  });

  it("falls back to the detail sent by the server", () => {
    const error = problem(422, {
      status: 422,
      errorCode: "INVALID_LINE",
      detail: "La cantidad de la línea 2 debe ser mayor que cero",
      correlationId: "c1",
    });

    expect(describeError(error)).toBe("La cantidad de la línea 2 debe ser mayor que cero");
  });

  it("has a generic message when the server says nothing useful", () => {
    expect(describeError(problem(500, { status: 500, errorCode: "INTERNAL_ERROR", correlationId: "abc-123" }))).toBe(
      "Ocurrió un error inesperado. Si persiste, indique este código a soporte: abc-123.",
    );
    expect(describeError(toApiError(new Response(null, { status: 502 }), "<html>Bad Gateway</html>"))).toBe(
      "El servidor no está disponible en este momento. Inténtelo de nuevo en unos minutos.",
    );
  });

  it("has its own message for a network failure", () => {
    expect(describeError(new TypeError("Failed to fetch"))).toBe(
      "No se pudo contactar con el servidor. Revise su conexión e inténtelo de nuevo.",
    );
  });

  it("says when the session expired", () => {
    const error = problem(401, { status: 401, errorCode: "UNAUTHENTICATED", correlationId: "c1" });

    expect(error.status).toBe(401);
    expect(describeError(error)).toBe("Su sesión terminó. Inicie sesión de nuevo.");
  });
});

describe("toApiError", () => {
  it("collects field errors", () => {
    const error = problem(400, {
      status: 400,
      errorCode: "VALIDATION_FAILED",
      correlationId: "c1",
      errors: [
        { field: "ruc", message: "debe tener trece dígitos" },
        { field: "legalName", message: "es obligatorio" },
        { message: "sin campo" },
      ],
    });

    expect(error.errorCode).toBe("VALIDATION_FAILED");
    expect(error.correlationId).toBe("c1");
    expect(error.fieldErrors).toEqual({ ruc: "debe tener trece dígitos", legalName: "es obligatorio" });
    expect(describeError(error)).toBe("Revise los campos marcados.");
  });

  it("says the server is unavailable, not that something unexpected happened, when the API is down or slow", () => {
    for (const status of [502, 503, 504]) {
      expect(describeError(problem(status, { status, errorCode: "INTERNAL_ERROR", correlationId: "abc-123" })), String(status)).toBe(
        "El servidor no está disponible en este momento. Inténtelo de nuevo en unos minutos.",
      );
    }
  });

  it("survives a body that is not a problem document", () => {
    const error = toApiError(new Response(null, { status: 404 }), null);

    expect(error.status).toBe(404);
    expect(error.errorCode).toBe("UNKNOWN");
    expect(error.fieldErrors).toEqual({});
  });
});
