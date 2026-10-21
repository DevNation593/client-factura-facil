import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { forgetLinkTokens } from "@/lib/authClient";
import { json, problem, stubApi } from "@/test/api";

import { ResetPasswordForm } from "./ResetPasswordForm";

function openLink(hash: string) {
  window.history.replaceState(null, "", `/reset-password${hash}`);
}

async function choose(password: string) {
  await userEvent.type(screen.getByLabelText("Contraseña nueva"), password);
  await userEvent.type(screen.getByLabelText("Repita la contraseña"), password);
  await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
}

afterEach(() => {
  forgetLinkTokens();
  window.history.replaceState(null, "", "/");
});

describe("Elegir una contraseña nueva", () => {
  it("sends the new password with the link's code and says every session was closed", async () => {
    openLink("#token=codigo-3");
    const api = stubApi({ "POST /auth/password-reset": () => json(200, {}) });
    render(<ResetPasswordForm />);

    await choose("la contraseña nueva");

    expect(await screen.findByRole("status")).toHaveTextContent("Su contraseña cambió");
    expect(api.to("POST", "/auth/password-reset")[0]?.body).toEqual({ token: "codigo-3", newPassword: "la contraseña nueva" });
    expect(window.location.hash).toBe("");
  });

  it("keeps the form when the link no longer works, offering another", async () => {
    openLink("#token=codigo-4");
    stubApi({ "POST /auth/password-reset": () => problem(400, "INVALID_LINK") });
    render(<ResetPasswordForm />);

    await choose("la contraseña nueva");

    expect(await screen.findByRole("alert")).toHaveTextContent("El enlace no es válido");
    expect(screen.getByRole("link", { name: "Pedir otro enlace" })).toHaveAttribute("href", "/forgot-password");
  });

  it("asks for the link again when the address has no code", () => {
    openLink("");
    render(<ResetPasswordForm />);

    expect(screen.getByRole("alert")).toHaveTextContent("Este enlace está incompleto");
    expect(screen.queryByLabelText("Contraseña nueva")).not.toBeInTheDocument();
  });
});
