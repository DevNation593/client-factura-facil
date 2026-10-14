"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { api, unwrap } from "@/api/client";
import { ErrorNotice, Notice } from "@/components/Notice";
import { formatInstant } from "@/lib/dates";
import { roleLabel } from "@/lib/roles";
import { useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";

/** A donde lleva el enlace de una invitación: se ve a qué empresa y con qué rol, y se acepta. */
export default function InvitacionPage() {
  const code = useSearchParams().get("codigo");
  if (!code) {
    return (
      <>
        <div className="sheet-head">
          <h1>Invitación</h1>
        </div>
        <Notice>
          Para unirse a una empresa necesita una invitación. Abra el enlace que le compartió quien le invitó, con la sesión iniciada en la
          cuenta de ese correo.
        </Notice>
      </>
    );
  }
  return <Invitation key={code} code={code} />;
}

function Invitation({ code }: { code: string }) {
  const router = useRouter();
  const { select, reload } = useTenant();
  const preview = useApi(() => unwrap(api.POST("/invitations/preview", { body: { token: code } })), [code]);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  async function accept() {
    if (accepting) {
      return;
    }
    setAccepting(true);
    setError(undefined);
    try {
      const tenant = await unwrap(api.POST("/invitations/accept", { body: { token: code } }));
      // La empresa nueva pasa a ser la activa de esta pestaña.
      await reload();
      select(tenant.id);
      router.push("/documentos");
    }
    catch (problem) {
      setError(problem);
      setAccepting(false);
    }
  }

  return (
    <>
      <div className="sheet-head">
        <h1>Invitación</h1>
      </div>
      {preview.loading ? <p>Cargando…</p> : null}
      <ErrorNotice error={preview.error} />
      {preview.data ? (
        <>
          <p className="lead">
            Le han invitado a trabajar en <strong>{preview.data.tenantName}</strong> como <strong>{roleLabel(preview.data.role)}</strong>.
          </p>
          <p className="field-hint">
            Vale hasta el {formatInstant(preview.data.expiresAt)} y es para {preview.data.email}.
          </p>
          <p className="actions">
            <button type="button" className="btn btn-primary" onClick={accept} disabled={accepting}>
              Aceptar invitación
            </button>
          </p>
          <ErrorNotice error={error} />
        </>
      ) : null}
    </>
  );
}
