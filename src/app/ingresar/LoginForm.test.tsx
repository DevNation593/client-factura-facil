import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionNavigation } from "@/lib/sessionNavigation";
import { json, problem, stubApi } from "@/test/api";

import { LoginForm } from "./LoginForm";

afterEach(() => {
  vi.restoreAllMocks();
});

async function signIn(email: string, password: string) {
  await userEvent.type(screen.getByLabelText("Correo"), email);
  await userEvent.type(screen.getByLabelText("Contraseña"), password);
  await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
}

describe("Ingresar", () => {
  it("signs in and goes back to where the user was going, loading the whole application", async () => {
    const leave = vi.spyOn(sessionNavigation, "leave").mockImplementation(() => {});
    const api = stubApi({ "POST /auth/login": () => json(200, { redirectTo: "/documentos" }) });
    render(<LoginForm returnTo="/documentos" notice={null} />);

    await signIn("ana@example.test", "una contraseña larga");

    await vi.waitFor(() => expect(leave).toHaveBeenCalledWith("/documentos"));
    const call = api.to("POST", "/auth/login")[0];
    expect(call?.body).toEqual({ email: "ana@example.test", password: "una contraseña larga", volver: "/documentos" });
    // La marca que el servidor exige contra peticiones de otros sitios.
    expect(call?.headers.get("X-Requested-With")).toBe("einvoice-web");
  });

  it("says when the email or the password is wrong, without saying which", async () => {
    stubApi({ "POST /auth/login": () => problem(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos") });
    render(<LoginForm returnTo={null} notice={null} />);

    await signIn("ana@example.test", "no es");

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
  });

  it("explains a locked email and offers to choose a new password", async () => {
    stubApi({ "POST /auth/login": () => problem(429, "ACCOUNT_LOCKED") });
    render(<LoginForm returnTo={null} notice={null} />);

    await signIn("ana@example.test", "no es");

    expect(await screen.findByRole("alert")).toHaveTextContent(/Demasiados intentos fallidos/);
    expect(screen.getByRole("link", { name: "Olvidé mi contraseña" })).toHaveAttribute("href", "/olvide-contrasena");
    expect(screen.getByRole("link", { name: "Crear una cuenta" })).toHaveAttribute("href", "/registro");
  });

  it("shows why the user is here when the session ended", () => {
    render(<LoginForm returnTo="/clientes" notice="Su sesión terminó. Ingrese de nuevo para continuar donde estaba." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Su sesión terminó");
  });
});
