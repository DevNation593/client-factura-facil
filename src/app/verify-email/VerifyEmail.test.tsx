import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { forgetLinkTokens } from "@/lib/authClient";
import { json, problem, stubApi } from "@/test/api";

import { VerifyEmail } from "./VerifyEmail";

function openLink(hash: string) {
  window.history.replaceState(null, "", `/verify-email${hash}`);
}

afterEach(() => {
  forgetLinkTokens();
  window.history.replaceState(null, "", "/");
});

describe("Confirmar el correo", () => {
  it("confirms with the link's code once and takes it out of the address bar", async () => {
    openLink("#token=codigo-1");
    const api = stubApi({ "POST /auth/email-verification": () => json(200, {}) });
    render(<VerifyEmail />);

    expect(await screen.findByRole("status")).toHaveTextContent("Su correo quedó confirmado.");
    expect(api.to("POST", "/auth/email-verification").map((call) => call.body)).toEqual([{ token: "codigo-1" }]);
    expect(window.location.hash).toBe("");
  });

  it("explains a used or expired link and where to ask for another", async () => {
    openLink("#token=codigo-2");
    stubApi({ "POST /auth/email-verification": () => problem(400, "INVALID_LINK") });
    render(<VerifyEmail />);

    expect(await screen.findByRole("alert")).toHaveTextContent("El enlace no es válido, ya se usó o caducó.");
    expect(screen.getByRole("link", { name: "su cuenta" })).toHaveAttribute("href", "/account");
  });

  it("does not call the API when the link has no code", () => {
    openLink("");
    const api = stubApi({});
    render(<VerifyEmail />);

    expect(screen.getByRole("alert")).toHaveTextContent("Este enlace está incompleto.");
    expect(api.calls).toHaveLength(0);
  });
});
