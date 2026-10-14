"use client";

import { useId, useState } from "react";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { ErrorNotice, Notice } from "@/components/Notice";
import { formatInstant } from "@/lib/dates";
import { useApi } from "@/lib/useApi";

type Taxpayer = components["schemas"]["Taxpayer"];

/**
 * Paso del emisor a producción. El sistema comprueba la evidencia (certificado vigente y un
 * comprobante autorizado en pruebas); el propietario declara que el SRI habilitó el RUC y activa.
 */
export function ProductionStep({ taxpayer, owner, onActivated }: { taxpayer: Taxpayer; owner: boolean; onActivated: () => void }) {
  const heading = useId();
  const readiness = useApi(
    () => unwrap(api.GET("/taxpayers/{id}/production-readiness", { params: { path: { id: taxpayer.id } } })),
    [taxpayer.id],
  );
  const [declared, setDeclared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  async function activate() {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await unwrap(
        api.POST("/taxpayers/{id}/production-activation", {
          params: { path: { id: taxpayer.id } },
          body: { sriProductionAuthorized: declared },
        }),
      );
      await readiness.reload({ quiet: true });
      onActivated();
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setSaving(false);
    }
  }

  const state = readiness.data;
  const missing = new Set(state?.missing ?? []);
  const complete = state !== undefined && missing.size === 0;
  return (
    <section aria-labelledby={heading}>
      <h2 id={heading}>Paso a producción</h2>
      <ErrorNotice error={readiness.error} />
      {state?.activatedAt ? (
        <>
          <p className="lead">En producción desde el {formatInstant(state.activatedAt)}. Los comprobantes que emita tienen validez tributaria.</p>
          {state.transmissionOpen ? null : (
            <Notice>
              La plataforma aún no transmite al SRI de producción: los comprobantes quedarán firmados, sin enviarse, hasta que se habilite.
            </Notice>
          )}
        </>
      ) : null}
      {state && !state.activatedAt ? (
        <>
          <p className="lead">
            Mientras el emisor esté en pruebas, sus comprobantes no tienen validez tributaria. Para pasar a producción hacen falta estas dos
            comprobaciones y su declaración.
          </p>
          <ul className="checklist">
            <li>
              Certificado de firma vigente: <strong>{missing.has("CERTIFICATE") ? "Pendiente" : "Cumplido"}</strong>.{" "}
              {missing.has("CERTIFICATE")
                ? "Cargue el certificado de firma del emisor."
                : `Vale hasta el ${formatInstant(state.certificateValidUntil)}.`}
            </li>
            <li>
              Un comprobante autorizado por el SRI en pruebas: <strong>{missing.has("TEST_AUTHORIZATION") ? "Pendiente" : "Cumplido"}</strong>.{" "}
              {missing.has("TEST_AUTHORIZATION")
                ? "Emita una factura en el ambiente de pruebas y espere a que el SRI la autorice."
                : `Autorizados: ${state.authorizedTestDocuments}.`}
            </li>
          </ul>
          {owner ? (
            <>
              <label className="check">
                <input type="checkbox" checked={declared} onChange={(event) => setDeclared(event.target.checked)} />
                Declaro que el SRI habilitó este RUC para emitir comprobantes electrónicos en producción.
              </label>
              <div className="actions">
                <button type="button" className="btn btn-primary" disabled={saving || !complete || !declared} onClick={activate}>
                  Activar producción
                </button>
              </div>
              <p className="field-hint">
                {complete
                  ? "A partir de la activación, cada comprobante es un documento tributario real. Este paso no se deshace desde la aplicación."
                  : "Complete los requisitos pendientes para poder activar producción."}
              </p>
            </>
          ) : (
            <p className="field-hint">Solo el propietario de la empresa puede activar producción.</p>
          )}
          <ErrorNotice error={error} />
        </>
      ) : null}
    </section>
  );
}
