"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { describeError } from "@/api/problem";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { postAuth } from "@/lib/authClient";

/** Pide el enlace para elegir otra contraseña. El mensaje es el mismo tenga o no cuenta ese correo. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setFailure(null);
    try {
      await postAuth("password-reset/request", { email });
      setSent(true);
    }
    catch (error) {
      setFailure(describeError(error));
    }
    finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <>
        <Notice kind="success">
          Si {email} tiene una cuenta, le llegará un correo con un enlace para elegir una contraseña nueva. El enlace vale una hora.
        </Notice>
        <p className="gate-links">
          <Link href="/ingresar">Volver a ingresar</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <form className="form" onSubmit={submit}>
        <Field label="Correo de su cuenta" className="wide">
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
        </Field>
        <div className="actions wide">
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? "Enviando…" : "Enviar enlace"}
          </button>
        </div>
      </form>
      {failure ? <Notice kind="error">{failure}</Notice> : null}
      <p className="gate-links">
        <Link href="/ingresar">Volver a ingresar</Link>
      </p>
    </>
  );
}
