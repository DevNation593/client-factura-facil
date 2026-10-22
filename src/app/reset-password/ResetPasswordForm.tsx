"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { describeError } from "@/api/problem";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { MAX_PASSWORD, MIN_PASSWORD, passwordProblem, postAuth, useLinkToken } from "@/lib/authClient";

/** Contraseña nueva con el código del enlace. Al terminar se cierran todas las sesiones de la cuenta. */
export function ResetPasswordForm() {
  // El código está en el fragmento de la dirección: solo existe en el navegador.
  const token = useLinkToken();
  const [password, setPassword] = useState("");
  const [repeated, setRepeated] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = passwordProblem(password, repeated);
    if (problem) {
      setFailure(problem);
      return;
    }
    setSending(true);
    setFailure(null);
    try {
      await postAuth("password-reset", { token: token ?? "", newPassword: password });
      setDone(true);
    }
    catch (error) {
      setFailure(describeError(error));
    }
    finally {
      setSending(false);
    }
  }

  if (token === undefined) {
    return null;
  }
  if (token === null) {
    return (
      <>
        <Notice kind="error">Este enlace está incompleto. Ábralo tal como llegó en el correo, o pida otro.</Notice>
        <p className="gate-links">
          <Link href="/forgot-password">Pedir otro enlace</Link>
        </p>
      </>
    );
  }
  if (done) {
    return (
      <>
        <Notice kind="success">Su contraseña cambió. Por seguridad se cerraron todas las sesiones abiertas.</Notice>
        <p className="actions">
          <Link className="btn btn-primary" href="/sign-in">
            Ingresar
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <form className="form" onSubmit={submit}>
        <Field label="Contraseña nueva" className="wide" hint={`Entre ${MIN_PASSWORD} y ${MAX_PASSWORD} caracteres.`}>
          <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={1024} required />
        </Field>
        <Field label="Repita la contraseña" className="wide">
          <input type="password" autoComplete="new-password" value={repeated} onChange={(event) => setRepeated(event.target.value)} maxLength={1024} required />
        </Field>
        <div className="actions wide">
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? "Guardando…" : "Guardar contraseña"}
          </button>
        </div>
      </form>
      {failure ? <Notice kind="error">{failure}</Notice> : null}
      <p className="gate-links">
        <Link href="/forgot-password">Pedir otro enlace</Link>
      </p>
    </>
  );
}
