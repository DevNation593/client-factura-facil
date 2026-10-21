"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { describeError } from "@/api/problem";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { MAX_PASSWORD, MIN_PASSWORD, passwordProblem, postAuth } from "@/lib/authClient";

/** Crea la cuenta. La respuesta es la misma si el correo ya tenía una: lo explica el correo que llega. */
export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeated, setRepeated] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

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
      await postAuth("register", { email, password });
      setSentTo(email);
    }
    catch (error) {
      setFailure(describeError(error));
    }
    finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <>
        <Notice kind="success">
          Le enviamos un correo a {sentTo} para confirmar que es suyo. Ya puede ingresar; confirme el correo cuando le llegue.
        </Notice>
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
        <Field label="Correo" className="wide">
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
        </Field>
        <Field label="Contraseña" className="wide" hint={`Entre ${MIN_PASSWORD} y ${MAX_PASSWORD} caracteres. Una frase es más fácil de recordar.`}>
          <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={1024} required />
        </Field>
        <Field label="Repita la contraseña" className="wide">
          <input type="password" autoComplete="new-password" value={repeated} onChange={(event) => setRepeated(event.target.value)} maxLength={1024} required />
        </Field>
        <div className="actions wide">
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? "Creando…" : "Crear cuenta"}
          </button>
        </div>
      </form>
      {failure ? <Notice kind="error">{failure}</Notice> : null}
      <p className="gate-links">
        <Link href="/sign-in">Ya tengo una cuenta</Link>
      </p>
    </>
  );
}
