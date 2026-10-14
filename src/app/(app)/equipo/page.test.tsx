import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { json, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import EquipoPage from "./page";

const OWNER = { userId: "11111111-1111-4111-8111-111111111111", email: "dueno@example.test", role: "OWNER", since: "2026-09-01T15:00:00Z", self: true };
const ADMIN = { userId: "22222222-2222-4222-8222-222222222222", email: "admin@example.test", role: "ADMIN", since: "2026-09-02T15:00:00Z", self: false };
const BILLER = { userId: "33333333-3333-4333-8333-333333333333", email: "caja@example.test", role: "BILLER", since: "2026-09-03T15:00:00Z", self: false };

const NO_CONTENT = () => new Response(null, { status: 204 });

type Routes = Parameters<typeof stubApi>[0];

function team(extra: Routes = {}, members: unknown[] = [OWNER, ADMIN, BILLER]) {
  return stubApi({
    "GET /members": () => json(200, members),
    ...extra,
  });
}

describe("Equipo", () => {
  it("shows who is in the company, with their role", async () => {
    team();
    renderWithTenant(<EquipoPage />);

    const members = await screen.findByRole("table", { name: "Miembros" });
    expect(within(members).getByText("dueno@example.test")).toBeInTheDocument();
    expect(within(members).getByText(/Propietario/)).toBeInTheDocument();
    expect(within(members).getByText(/usted/i)).toBeInTheDocument();
    expect(within(members).getByLabelText("Rol de admin@example.test")).toHaveValue("ADMIN");
    // Ni el propietario ni uno mismo se cambian de rol.
    expect(within(members).queryByLabelText("Rol de dueno@example.test")).not.toBeInTheDocument();
    // Ya no se invita a nadie: cada usuario trabaja en las empresas que crea.
    expect(screen.queryByText(/Invitar/)).not.toBeInTheDocument();
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

  it("removes a member after confirming", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const api = team({ "DELETE /members/:id": NO_CONTENT });
    renderWithTenant(<EquipoPage />);
    await screen.findByRole("table", { name: "Miembros" });

    await userEvent.click(screen.getByRole("button", { name: "Retirar a caja@example.test" }));
    await waitFor(() => expect(api.to("DELETE", `/members/${BILLER.userId}`)).toHaveLength(1));
    // Al propietario no se le ofrece retirarse.
    expect(screen.queryByRole("button", { name: "Retirar a dueno@example.test" })).not.toBeInTheDocument();

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
  });

  it("is not for roles that do not manage the company", () => {
    const api = team();
    renderWithTenant(<EquipoPage />, { role: "BILLER" });

    expect(screen.getByText(/Su rol en esta empresa no permite gestionar el equipo/)).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });
});
