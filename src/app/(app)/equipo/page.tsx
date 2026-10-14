"use client";

import { useState } from "react";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { formatInstant } from "@/lib/dates";
import { grantableRoles, roleLabel, type Role } from "@/lib/roles";
import { canWrite, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";

type Member = components["schemas"]["Member"];

function nameOf(member: Member): string {
  return member.email ?? "una persona sin correo informado";
}

/** Quién trabaja en la empresa y con qué rol. */
export default function EquipoPage() {
  const { active } = useTenant();
  if (!active) {
    return <NoTenant />;
  }
  if (!canWrite(active)) {
    return <Notice>Su rol en esta empresa no permite gestionar el equipo. Lo hacen el propietario y los administradores.</Notice>;
  }
  return <Team key={active.id} role={active.role} />;
}

function Team({ role }: { role: Role }) {
  const members = useApi(() => unwrap(api.GET("/members")), []);
  const [error, setError] = useState<unknown>(undefined);
  const [busy, setBusy] = useState(false);
  const grantable = grantableRoles(role);
  const owner = role === "OWNER";

  /** Una operación sobre el equipo: sin dobles envíos, con su error a la vista y la lista releída. */
  async function run(action: () => Promise<unknown>, reload: () => Promise<void>) {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await reload();
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setBusy(false);
    }
  }

  function changeRole(member: Member, next: Role) {
    if (!window.confirm(`¿Cambiar el rol de ${nameOf(member)} a ${roleLabel(next)}?`)) {
      return;
    }
    void run(
      () => unwrap(api.PUT("/members/{userId}/role", { params: { path: { userId: member.userId } }, body: { role: next } })),
      () => members.reload({ quiet: true }),
    );
  }

  function remove(member: Member) {
    if (!window.confirm(`¿Retirar a ${nameOf(member)} de la empresa? Dejará de tener acceso de inmediato.`)) {
      return;
    }
    void run(
      () => unwrap(api.DELETE("/members/{userId}", { params: { path: { userId: member.userId } } })),
      () => members.reload({ quiet: true }),
    );
  }

  return (
    <>
      <div className="sheet-head">
        <h1>Equipo</h1>
      </div>
      <ErrorNotice error={members.error} />
      <ErrorNotice error={error} />

      <h2 id="miembros">Miembros</h2>
      {members.loading ? <p>Cargando…</p> : null}
      {members.data ? (
        <div className="table-scroll">
          <table className="ruled" aria-labelledby="miembros">
            <thead>
              <tr>
                <th scope="col">Persona</th>
                <th scope="col">Rol</th>
                <th scope="col">Desde</th>
                <th scope="col">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.data.map((member) => {
                // El propietario y uno mismo no se cambian ni se retiran desde aquí.
                const editable = member.role !== "OWNER" && !member.self;
                return (
                  <tr key={member.userId}>
                    <td>
                      <span>{member.email ?? "Sin correo informado"}</span>
                      {member.self ? " (usted)" : ""}
                    </td>
                    <td className="field">
                      {owner && editable ? (
                        <select
                          aria-label={`Rol de ${nameOf(member)}`}
                          value={member.role}
                          disabled={busy}
                          onChange={(event) => changeRole(member, event.target.value as Role)}
                        >
                          {grantable.map((option) => (
                            <option key={option} value={option}>
                              {roleLabel(option)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        roleLabel(member.role)
                      )}
                    </td>
                    <td>{formatInstant(member.since)}</td>
                    <td>
                      {editable && grantable.includes(member.role) ? (
                        <button type="button" className="btn-link" disabled={busy} onClick={() => remove(member)}>
                          Retirar <span className="sr-only">a {nameOf(member)}</span>
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
