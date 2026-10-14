import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import EquipoPage from "./page";

const OWNER = { userId: "11111111-1111-4111-8111-111111111111", email: "dueno@example.test", role: "OWNER", since: "2026-09-01T15:00:00Z", self: true };
const ADMIN = { userId: "22222222-2222-4222-8222-222222222222", email: "admin@example.test", role: "ADMIN", since: "2026-09-02T15:00:00Z", self: false };
const BILLER = { userId: "33333333-3333-4333-8333-333333333333", email: "caja@example.test", role: "BILLER", since: "2026-09-03T15:00:00Z", self: false };
const PENDING = { id: "44444444-4444-4444-8444-444444444444", email: "nueva@example.test", role: "AUDITOR", expiresAt: "2026-10-22T15:00:00Z", invitedBy: "dueno@example.test" };

const NO_CONTENT = () => new Response(null, { status: 204 });

type Routes = Parameters<typeof stubApi>[0];

function team(extra: Routes = {}, members: unknown[] = [OWNER, ADMIN, BILLER]) {
  return stubApi({
    "GET /members": () => json(200, members),
    "GET /invitations": () => json(200, [PENDING]),
    ...extra,
  });
}

describe("Equipo", () => {
  it("shows who is in the company, with their role, and who has been invited", async () => {
    team();
    renderWithTenant(<EquipoPage />);

    const members = await screen.findByRole("table", { name: "Miembros" });
    expect(within(members).getByText("dueno@example.test")).toBeInTheDocument();
    expect(within(members).getByText(/Propietario/)).toBeInTheDocument();
    expect(within(members).getByText(/usted/i)).toBeInTheDocument();
    expect(within(members).getByLabelText("Rol de admin@example.test")).toHaveValue("ADMIN");
    // Ni el propietario ni uno mismo se cambian de rol.
    expect(within(members).queryByLabelText("Rol de dueno@example.test")).not.toBeInTheDocument();

    const pending = screen.getByRole("table", { name: "Invitaciones pendientes" });
    expect(within(pending).getByText("nueva@example.test")).toBeInTheDocument();
    expect(within(pending).getByText("Auditor")).toBeInTheDocument();
  });

  it("invites someone and shows the link once, to copy and share", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const api = team({
      "POST /invitations": () =>
        json(201, { id: "55555555-5555-4555-8555-555555555555", email: "ana@example.test", role: "BILLER", expiresAt: "2026-10-22T15:00:00Z", token: "codigo-secreto-de-un-solo-uso" }),
    });
    renderWithTenant(<EquipoPage />);
    await screen.findByRole("table", { name: "Miembros" });

    await userEvent.type(screen.getByLabelText("Correo de la persona"), " ana@example.test ");
    await userEvent.selectOptions(screen.getByLabelText("Rol que tendrá"), "BILLER");
    await userEvent.click(screen.getByRole("button", { name: "Invitar" }));

    const link = await screen.findByLabelText("Enlace de invitación");
    expect(link).toHaveValue("http://localhost:3000/invitacion?codigo=codigo-secreto-de-un-solo-uso");
    expect(link).toHaveAttribute("readonly");
    expect(screen.getByText(/no se volverá a mostrar/)).toBeInTheDocument();
    expect(screen.getByText(/solo sirve para ana@example.test/)).toBeInTheDocument();
    expect(api.to("POST", "/invitations")[0]?.body).toEqual({ email: "ana@example.test", role: "BILLER" });

    await userEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/invitacion?codigo=codigo-secreto-de-un-solo-uso");
    expect(await screen.findByText("Enlace copiado.")).toBeInTheDocument();
    // Las pendientes se vuelven a leer.
    await waitFor(() => expect(api.to("GET", "/invitations").length).toBeGreaterThan(1));
  });

  it("explains why an invitation could not be created", async () => {
    team({ "POST /invitations": () => problem(409, "ALREADY_MEMBER") });
    renderWithTenant(<EquipoPage />);
    await screen.findByRole("table", { name: "Miembros" });

    await userEvent.type(screen.getByLabelText("Correo de la persona"), "caja@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Invitar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Esa persona ya forma parte de la empresa.");
    expect(screen.queryByLabelText("Enlace de invitación")).not.toBeInTheDocument();
  });

  it("changes a role only after the owner confirms", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const api = team({ "PUT /members/:id/role": () => json(200, { ...BILLER, role: "AUDITOR" }) });
    renderWithTenant(<EquipoPage />);
    const role = await screen.findByLabelText("Rol de caja@example.test");

    await userEvent.selectOptions(role, "AUDITOR");
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("caja@example.test"));
    expect(api.to("PUT", `/members/${BILLER.userId}/role`)).toHaveLength(0);
    expect(role).toHaveValue("BILLER");

    await userEvent.selectOptions(role, "AUDITOR");
    await waitFor(() => expect(api.to("PUT", `/members/${BILLER.userId}/role`)).toHaveLength(1));
    expect(api.to("PUT", `/members/${BILLER.userId}/role`)[0]?.body).toEqual({ role: "AUDITOR" });
  });

  it("removes a member and revokes an invitation, each after confirming", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const api = team({ "DELETE /members/:id": NO_CONTENT, "DELETE /invitations/:id": NO_CONTENT });
    renderWithTenant(<EquipoPage />);
    await screen.findByRole("table", { name: "Miembros" });

    await userEvent.click(screen.getByRole("button", { name: "Retirar a caja@example.test" }));
    await waitFor(() => expect(api.to("DELETE", `/members/${BILLER.userId}`)).toHaveLength(1));
    // Al propietario no se le ofrece retirarse.
    expect(screen.queryByRole("button", { name: "Retirar a dueno@example.test" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Anular la invitación de nueva@example.test" }));
    await waitFor(() => expect(api.to("DELETE", `/invitations/${PENDING.id}`)).toHaveLength(1));
  });

  it("does nothing when the user does not confirm removing someone", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const api = team({ "DELETE /members/:id": NO_CONTENT });
    renderWithTenant(<EquipoPage />);
    await screen.findByRole("table", { name: "Miembros" });

    await userEvent.click(screen.getByRole("button", { name: "Retirar a caja@example.test" }));

    expect(api.to("DELETE", `/members/${BILLER.userId}`)).toHaveLength(0);
  });

  it("lets an administrator manage only those below", async () => {
    team({}, [OWNER, { ...ADMIN, self: true }, { ...ADMIN, userId: "66666666-6666-4666-8666-666666666666", email: "otra-admin@example.test" }, BILLER]);
    renderWithTenant(<EquipoPage />, { role: "ADMIN" });
    await screen.findByRole("table", { name: "Miembros" });

    // Los roles solo los cambia el propietario.
    expect(screen.queryByLabelText("Rol de caja@example.test")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirar a caja@example.test" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirar a otra-admin@example.test" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirar a admin@example.test" })).not.toBeInTheDocument();
    const options = within(screen.getByLabelText("Rol que tendrá")).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Facturador", "Auditor"]);
  });

  it("is not for roles that do not manage the company", () => {
    const api = team();
    renderWithTenant(<EquipoPage />, { role: "BILLER" });

    expect(screen.getByText(/Su rol en esta empresa no permite gestionar el equipo/)).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });
});
