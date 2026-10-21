"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";

import { ApiError } from "@/api/problem";
import { Field } from "@/components/Field";
import { ErrorNotice, Notice } from "@/components/Notice";
import { PointSelect } from "@/components/PointSelect";
import type { Issuer, Point } from "@/lib/issuer";

/** Avisos del emisor: sin registrar, o sin ningún punto de emisión habilitado. `issuer` es nulo si no existe y indefinido mientras carga. */
export function IssuerNotices({ issuer, points }: { issuer: Issuer | null | undefined; points: Point[] }) {
  return (
    <>
      {issuer === null ? (
        <Notice kind="warning">
          Antes de emitir hay que <Link href="/settings/issuer">registrar el emisor</Link>.
        </Notice>
      ) : null}
      {issuer && points.length === 0 ? (
        <Notice kind="warning">
          El emisor no tiene ningún punto de emisión habilitado. <Link href="/settings/issuer">Añada uno</Link> para poder emitir.
        </Notice>
      ) : null}
    </>
  );
}

/** Punto de emisión de la nota. */
export function PointField({ points, point, onChange }: { points: Point[]; point: Point | undefined; onChange: (point: Point) => void }) {
  return (
    <Field label="Punto de emisión" hint="El número de la nota se asigna al emitirla.">
      <PointSelect points={points} value={point} onChange={onChange} />
    </Field>
  );
}

/** El punto elegido entre los habilitados; mientras no se elige, el primero. */
export function selectedPoint(points: Point[], chosen: Point | undefined): Point | undefined {
  return points.find((candidate) => candidate.establishmentCode === chosen?.establishmentCode && candidate.emissionPointCode === chosen.emissionPointCode) ?? points[0];
}

/**
 * Estado del envío de una nota. La clave de idempotencia nace con el formulario: un doble clic o un
 * reintento tras un fallo emiten la misma nota.
 */
export function useNoteEmit(onIssued: (id: string) => void) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  /** Evita un segundo envío antes de que React vuelva a pintar el botón desactivado. */
  const inFlight = useRef(false);

  /** Envía la nota si `ready`; `issue` recibe la clave de idempotencia y devuelve el comprobante emitido. */
  async function submit(event: FormEvent, ready: boolean, issue: (idempotencyKey: string) => Promise<{ id: string }>) {
    event.preventDefault();
    if (inFlight.current || !ready) {
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError(undefined);
    try {
      const issued = await issue(idempotencyKey);
      onIssued(issued.id);
    }
    catch (problem) {
      setError(problem);
      inFlight.current = false;
      setSending(false);
    }
  }

  return { sending, error, submit };
}

/** Por qué no se emitió la nota: clave reutilizada, datos que el servidor rechazó, o el problema tal cual. */
export function NoteProblem({ error, fieldLabel }: { error: unknown; fieldLabel: (field: string) => string }) {
  const keyReused = error instanceof ApiError && error.errorCode === "IDEMPOTENCY_KEY_REUSED";
  // No hay un campo por cada dato que el servidor valida: se dice aquí cuál rechazó.
  const rejected = error instanceof ApiError ? Object.entries(error.fieldErrors) : [];
  if (keyReused) {
    return (
      <Notice kind="error">
        Esta nota ya se había emitido con otro contenido. Revise los <Link href="/documents">comprobantes</Link> antes de volver a emitir.
      </Notice>
    );
  }
  if (rejected.length > 0) {
    return (
      <Notice kind="error">
        El servidor no aceptó estos datos de la nota:
        <ul>
          {rejected.map(([field, message]) => (
            <li key={field}>
              {fieldLabel(field)}: {message}
            </li>
          ))}
        </ul>
      </Notice>
    );
  }
  return <ErrorNotice error={error} />;
}

/** Botón de emitir y, deshabilitado, lo que falta para poder emitir. */
export function NoteActions({ label, ready, sending, missing }: { label: string; ready: boolean; sending: boolean; missing: string[] }) {
  const missingHint = useId();
  return (
    <>
      <p className="actions">
        <button type="submit" className="btn btn-primary" disabled={!ready || sending} aria-describedby={missing.length > 0 ? missingHint : undefined}>
          {sending ? "Emitiendo…" : label}
        </button>
      </p>
      {missing.length > 0 ? (
        <p className="field-hint" id={missingHint}>
          Para emitir falta: {missing.join("; ")}.
        </p>
      ) : null}
    </>
  );
}
