import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { route, router } from "@/test/navigation";
import { renderWithTenant } from "@/test/render";

import InvitacionPage from "./page";

const PREVIEW = { tenantName: "Ferretería Sur", role: "BILLER", email: "ana@example.test", expiresAt: "2026-10-22T15:00:00Z" };
const JOINED = { id: "77777777-7777-4777-8777-777777777777", name: "Ferretería Sur", status: "ACTIVE", role: "BILLER" };

describe("Invitación", () => {
  it("shows what the user is joining before they accept, then takes them into that company", async () => {
    route.search = "?codigo=codigo-de-la-invitacion";
    const select = vi.fn();
    const reload = vi.fn(async () => {});
    const api = stubApi({
      "POST /invitations/preview": () => json(200, PREVIEW),
      "POST /invitations/accept": () => json(200, JOINED),
    });
    // Quien llega por un enlace puede no pertenecer todavía a ninguna empresa.
    renderWithTenant(<InvitacionPage />, { active: false, overrides: { select, reload } });

    expect(await screen.findByText(/Ferretería Sur/)).toBeInTheDocument();
    expect(screen.getByText(/Facturador/)).toBeInTheDocument();
    expect(api.to("POST", "/invitations/preview")[0]?.body).toEqual({ token: "codigo-de-la-invitacion" });
    expect(api.to("POST", "/invitations/accept")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar invitación" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/documentos"));
    expect(api.to("POST", "/invitations/accept")[0]?.body).toEqual({ token: "codigo-de-la-invitacion" });
    expect(reload).toHaveBeenCalled();
    expect(select).toHaveBeenCalledWith(JOINED.id);
  });

  it("says so when the link is no longer valid", async () => {
    route.search = "?codigo=caducado";
    stubApi({ "POST /invitations/preview": () => problem(404, "INVITATION_NOT_VALID") });
    renderWithTenant(<InvitacionPage />, { active: false });

    expect(await screen.findByRole("alert")).toHaveTextContent(/no es válida/);
    expect(screen.queryByRole("button", { name: "Aceptar invitación" })).not.toBeInTheDocument();
  });

  it("tells the user to sign in with the invited account when it is for another email", async () => {
    route.search = "?codigo=de-otra-persona";
    stubApi({ "POST /invitations/preview": () => problem(403, "INVITATION_EMAIL_MISMATCH") });
    renderWithTenant(<InvitacionPage />, { active: false });

    expect(await screen.findByRole("alert")).toHaveTextContent(/es para otro correo/);
  });

  it("explains a failure when accepting and lets the user try again", async () => {
    route.search = "?codigo=codigo";
    const api = stubApi({
      "POST /invitations/preview": () => json(200, PREVIEW),
      "POST /invitations/accept": () => problem(409, "ALREADY_MEMBER"),
    });
    renderWithTenant(<InvitacionPage />, { active: false });

    await userEvent.click(await screen.findByRole("button", { name: "Aceptar invitación" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya forma parte/);
    expect(screen.getByRole("button", { name: "Aceptar invitación" })).toBeEnabled();
    expect(api.to("POST", "/invitations/accept")).toHaveLength(1);
  });

  it("explains how invitations work when opened without a code", () => {
    const api = stubApi({});
    renderWithTenant(<InvitacionPage />, { active: false });

    expect(screen.getByText(/Abra el enlace que le compartió/)).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });
});
