"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { describeError } from "@/api/problem";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { postAuth } from "@/lib/authClient";
import { sessionNavigation } from "@/lib/sessionNavigation";

/** Correo y contraseña. Al entrar, navegación completa: la aplicación se carga ya con la sesión. */
export function LoginForm({ returnTo, notice }: { returnTo: string | null; notice: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setFailure(null);
    try {
      const body = await postAuth("login", { email, password, volver: returnTo ?? "/" });
      sessionNavigation.leave(typeof body.redirectTo === "string" ? body.redirectTo : "/");
    }
    catch (error) {
      setFailure(describeError(error));
      setSending(false);
    }
  }

  return (
    <>
      {notice ? <Notice kind="error">{notice}</Notice> : null}
      <form className="form" onSubmit={submit}>
        <Field label="Correo" className="wide">
          <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
        </Field>
        <Field label="Contraseña" className="wide">
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={1024} required />
        </Field>
        <div className="actions wide">
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? "Ingresando…" : "Ingresar"}
          </button>
        </div>
      </form>
      {failure ? <Notice kind="error">{failure}</Notice> : null}
      <p className="gate-links">
        <Link href="/olvide-contrasena">Olvidé mi contraseña</Link>
        <Link href="/registro">Crear una cuenta</Link>
      </p>
    </>
  );
}
