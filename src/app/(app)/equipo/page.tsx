"use client";

import { useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { Field } from "@/components/Field";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { formatInstant } from "@/lib/dates";
import { grantableRoles, roleLabel, type Role } from "@/lib/roles";
import { canWrite, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";

type Member = components["schemas"]["Member"];
type Invitation = components["schemas"]["Invitation"];
type CreatedInvitation = components["schemas"]["CreatedInvitation"];

function nameOf(member: Member): string {
  return member.email ?? "una persona sin correo informado";
}

/** Quién trabaja en la empresa, con qué rol, y a quién se ha invitado. */
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
  const invitations = useApi(() => unwrap(api.GET("/invitations")), []);
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

  function revoke(invitation: Invitation) {
    if (!window.confirm(`¿Anular la invitación de ${invitation.email}? Su enlace dejará de servir.`)) {
      return;
    }
    void run(
      () => unwrap(api.DELETE("/invitations/{id}", { params: { path: { id: invitation.id } } })),
      () => invitations.reload({ quiet: true }),
    );
  }

  return (
    <>
      <div className="sheet-head">
        <h1>Equipo</h1>
      </div>
      <ErrorNotice error={members.error ?? invitations.error} />
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

      <h2>Invitar a alguien</h2>
      <p className="lead">
        La persona entra con su propia cuenta, usando el correo al que la invite. Usted le comparte el enlace: la aplicación no lo envía.
      </p>
      <InviteForm grantable={grantable} onInvited={() => invitations.reload({ quiet: true })} />

      <h2 id="pendientes">Invitaciones pendientes</h2>
      {invitations.data?.length === 0 ? <p className="empty">No hay invitaciones pendientes.</p> : null}
      {invitations.data && invitations.data.length > 0 ? (
        <div className="table-scroll">
          <table className="ruled" aria-labelledby="pendientes">
            <thead>
              <tr>
                <th scope="col">Correo</th>
                <th scope="col">Rol</th>
                <th scope="col">Vale hasta</th>
                <th scope="col">Invitó</th>
                <th scope="col">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invitations.data.map((invitation) => (
                <tr key={invitation.id}>
                  <td>{invitation.email}</td>
                  <td>{roleLabel(invitation.role)}</td>
                  <td>{formatInstant(invitation.expiresAt)}</td>
                  <td>{invitation.invitedBy ?? ""}</td>
                  <td>
                    {grantable.includes(invitation.role) ? (
                      <button type="button" className="btn-link" disabled={busy} onClick={() => revoke(invitation)}>
                        Anular <span className="sr-only">la invitación de {invitation.email}</span>
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function InviteForm({ grantable, onInvited }: { grantable: Role[]; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(grantable[grantable.length - 1] ?? "AUDITOR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [created, setCreated] = useState<CreatedInvitation | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || email.trim() === "") {
      return;
    }
    setSaving(true);
    setError(undefined);
    setCreated(undefined);
    setCopied(false);
    try {
      setCreated(await unwrap(api.POST("/invitations", { body: { email: email.trim(), role } })));
      setEmail("");
      onInvited();
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setSaving(false);
    }
  }

  const link = created ? `${window.location.origin}/invitacion?codigo=${encodeURIComponent(created.token)}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    }
    catch {
      // Sin permiso para el portapapeles: el enlace sigue a la vista para copiarlo a mano.
      setCopied(false);
    }
  }

  return (
    <>
      <form className="form" onSubmit={submit}>
        <Field label="Correo de la persona" hint="El de la cuenta con la que va a iniciar sesión.">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
        </Field>
        <Field label="Rol que tendrá">
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {grantable.map((option) => (
              <option key={option} value={option}>
                {roleLabel(option)}
              </option>
            ))}
          </select>
        </Field>
        <div className="actions wide">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Invitar
          </button>
        </div>
      </form>
      <ErrorNotice error={error} />
      {created ? (
        <Notice kind="success">
          <p>
            Invitación creada. Comparta este enlace con esa persona: solo sirve para {created.email} y una sola vez. Vale hasta el{" "}
            {formatInstant(created.expiresAt)} y <strong>no se volverá a mostrar</strong>.
          </p>
          <Field label="Enlace de invitación">
            <input value={link} readOnly onFocus={(event) => event.target.select()} />
          </Field>
          <p className="actions">
            <button type="button" className="btn" onClick={copy}>
              Copiar enlace
            </button>
            {copied ? <span role="status">Enlace copiado.</span> : null}
          </p>
        </Notice>
      ) : null}
    </>
  );
}
