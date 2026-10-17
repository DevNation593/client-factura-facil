import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { json, problem, stubApi } from "@/test/api";

import { RegisterForm } from "./RegisterForm";

async function fill(email: string, password: string, repeated: string) {
  await userEvent.type(screen.getByLabelText("Correo"), email);
  await userEvent.type(screen.getByLabelText("Contraseña"), password);
  await userEvent.type(screen.getByLabelText("Repita la contraseña"), repeated);
  await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
}

describe("Crear una cuenta", () => {
  it("creates the account and says an email is on its way", async () => {
    const api = stubApi({ "POST /auth/register": () => json(202, {}) });
    render(<RegisterForm />);

    await fill("ana@example.test", "una contraseña larga", "una contraseña larga");

    expect(await screen.findByRole("status")).toHaveTextContent("Le enviamos un correo a ana@example.test");
    expect(api.to("POST", "/auth/register")[0]?.body).toEqual({ email: "ana@example.test", password: "una contraseña larga" });
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/ingresar");
  });

  it("checks both passwords before sending anything", async () => {
    const api = stubApi({});
    render(<RegisterForm />);

    await fill("ana@example.test", "una contraseña larga", "otra contraseña larga");
    expect(await screen.findByRole("alert")).toHaveTextContent("Las dos contraseñas no coinciden.");

    await userEvent.clear(screen.getByLabelText("Contraseña"));
    await userEvent.clear(screen.getByLabelText("Repita la contraseña"));
    await userEvent.type(screen.getByLabelText("Contraseña"), "corta");
    await userEvent.type(screen.getByLabelText("Repita la contraseña"), "corta");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("entre 12 y 128 caracteres");

    expect(api.calls).toHaveLength(0);
  });

  it("shows the API's reason when it refuses the password", async () => {
    stubApi({ "POST /auth/register": () => problem(422, "WEAK_PASSWORD") });
    render(<RegisterForm />);

    await fill("ana@example.test", "ana@example.test", "ana@example.test");

    expect(await screen.findByRole("alert")).toHaveTextContent("no puede ser su correo");
  });
});
