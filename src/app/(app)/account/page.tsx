"use client";

import { useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { describeError } from "@/api/problem";
import { Field } from "@/components/Field";
import { ErrorNotice, Notice } from "@/components/Notice";
import { MAX_PASSWORD, MIN_PASSWORD, passwordProblem } from "@/lib/authClient";
import { useApi } from "@/lib/useApi";

/** La cuenta de quien inició sesión: su correo, si está confirmado y su contraseña. */
export default function CuentaPage() {
  const me = useApi(() => unwrap(api.GET("/auth/me")), []);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<unknown>(undefined);

  async function resend() {
    setResendError(undefined);
    try {
      await unwrap(api.POST("/auth/email-verification/resend"));
      setResent(true);
    }
    catch (error) {
      setResendError(error);
    }
  }

  return (
    <>
      <div className="sheet-head">
        <h1>Mi cuenta</h1>
      </div>
      <ErrorNotice error={me.error} />
      {me.data ? (
        <dl className="facts">
          <dt>Correo</dt>
          <dd>{me.data.email}</dd>
          <dt>Confirmación del correo</dt>
          <dd>{me.data.emailVerified ? "Confirmado" : "Sin confirmar"}</dd>
        </dl>
      ) : null}
      {me.data && !me.data.emailVerified ? (
        <Notice kind="warning">
          <p>Su correo aún no está confirmado. Abra el enlace que le enviamos al crear la cuenta.</p>
          {resent ? (
            <p>Le enviamos un enlace nuevo. Revise también el correo no deseado.</p>
          ) : (
            <p className="actions">
              <button type="button" className="btn" onClick={resend}>
                Enviar el enlace otra vez
              </button>
            </p>
          )}
        </Notice>
      ) : null}
      <ErrorNotice error={resendError} />

      <h2>Cambiar la contraseña</h2>
      <p className="lead">Las demás sesiones abiertas con esta cuenta se cerrarán; esta sigue.</p>
      <ChangePasswordForm />
    </>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeated, setRepeated] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = passwordProblem(password, repeated);
    if (problem) {
      setFailure(problem);
      return;
    }
    setSaving(true);
    setFailure(null);
    setDone(false);
    try {
      await unwrap(api.POST("/auth/password", { body: { currentPassword: current, newPassword: password } }));
      setDone(true);
      setCurrent("");
      setPassword("");
      setRepeated("");
    }
    catch (error) {
      setFailure(describeError(error));
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form className="form" onSubmit={submit}>
        <Field label="Contraseña actual" className="wide">
          <input type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} maxLength={1024} required />
        </Field>
        <Field label="Contraseña nueva" hint={`Entre ${MIN_PASSWORD} y ${MAX_PASSWORD} caracteres.`}>
          <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={1024} required />
        </Field>
        <Field label="Repita la contraseña nueva">
          <input type="password" autoComplete="new-password" value={repeated} onChange={(event) => setRepeated(event.target.value)} maxLength={1024} required />
        </Field>
        <div className="actions wide">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </div>
      </form>
      {failure ? <Notice kind="error">{failure}</Notice> : null}
      {done ? <Notice kind="success">Su contraseña cambió. Las demás sesiones se cerraron.</Notice> : null}
    </>
  );
}
