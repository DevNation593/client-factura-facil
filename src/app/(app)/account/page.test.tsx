import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import CuentaPage from "./page";

const ME = { id: "11111111-1111-4111-8111-111111111111", email: "ana@example.test", emailVerified: false };

describe("Mi cuenta", () => {
  it("shows the email, whether it is confirmed, and sends the link again on request", async () => {
    const api = stubApi({
      "GET /auth/me": () => json(200, ME),
      "POST /auth/email-verification/resend": () => new Response(null, { status: 202 }),
    });
    renderWithTenant(<CuentaPage />);

    expect(await screen.findByText("ana@example.test")).toBeInTheDocument();
    expect(screen.getByText("Sin confirmar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enviar el enlace otra vez" }));

    expect(await screen.findByText(/Le enviamos un enlace nuevo/)).toBeInTheDocument();
    expect(api.to("POST", "/auth/email-verification/resend")).toHaveLength(1);
  });

  it("does not offer the link once the email is confirmed", async () => {
    stubApi({ "GET /auth/me": () => json(200, { ...ME, emailVerified: true }) });
    renderWithTenant(<CuentaPage />);

    expect(await screen.findByText("Confirmado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar el enlace otra vez" })).not.toBeInTheDocument();
  });

  it("changes the password knowing the current one", async () => {
    const api = stubApi({
      "GET /auth/me": () => json(200, { ...ME, emailVerified: true }),
      "POST /auth/password": () => new Response(null, { status: 204 }),
    });
    renderWithTenant(<CuentaPage />);
    await screen.findByText("Confirmado");

    await userEvent.type(screen.getByLabelText("Contraseña actual"), "una contraseña larga");
    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "la contraseña nueva");
    await userEvent.type(screen.getByLabelText("Repita la contraseña nueva"), "la contraseña nueva");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(await screen.findByText(/Las demás sesiones se cerraron/)).toBeInTheDocument();
    expect(api.to("POST", "/auth/password")[0]?.body).toEqual({ currentPassword: "una contraseña larga", newPassword: "la contraseña nueva" });
  });

  it("says when the current password is wrong", async () => {
    stubApi({
      "GET /auth/me": () => json(200, { ...ME, emailVerified: true }),
      "POST /auth/password": () => problem(422, "INVALID_CURRENT_PASSWORD"),
    });
    renderWithTenant(<CuentaPage />);
    await screen.findByText("Confirmado");

    await userEvent.type(screen.getByLabelText("Contraseña actual"), "no es");
    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "la contraseña nueva");
    await userEvent.type(screen.getByLabelText("Repita la contraseña nueva"), "la contraseña nueva");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La contraseña actual no es correcta.");
  });
});
