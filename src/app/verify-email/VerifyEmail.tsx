"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { describeError } from "@/api/problem";
import { Notice } from "@/components/Notice";
import { postAuth, useLinkToken } from "@/lib/authClient";

type Outcome = { kind: "done" } | { kind: "failed"; message: string };

/** Una sola confirmación por código, aunque el efecto se ejecute dos veces (modo estricto de React). */
const confirmations = new Map<string, Promise<unknown>>();

function confirm(token: string): Promise<unknown> {
  let running = confirmations.get(token);
  if (!running) {
    running = postAuth("email-verification", { token });
    confirmations.set(token, running);
  }
  return running;
}

/** Confirma el correo con el código del enlace, nada más abrir la página. */
export function VerifyEmail() {
  const token = useLinkToken();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let current = true;
    confirm(token)
      .then(() => current && setOutcome({ kind: "done" }))
      .catch((error: unknown) => current && setOutcome({ kind: "failed", message: describeError(error) }));
    return () => {
      current = false;
    };
  }, [token]);

  if (token === null) {
    return <Failed message="Este enlace está incompleto. Ábralo tal como llegó en el correo." />;
  }
  if (outcome === null) {
    return <p>Confirmando su correo…</p>;
  }
  if (outcome.kind === "failed") {
    return <Failed message={outcome.message} />;
  }
  return (
    <>
      <Notice kind="success">Su correo quedó confirmado.</Notice>
      <p className="actions">
        <Link className="btn btn-primary" href="/">
          Ir a la aplicación
        </Link>
      </p>
    </>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <>
      <Notice kind="error">{message}</Notice>
      <p>
        Puede pedir otro enlace desde <Link href="/account">su cuenta</Link>.
      </p>
    </>
  );
}
