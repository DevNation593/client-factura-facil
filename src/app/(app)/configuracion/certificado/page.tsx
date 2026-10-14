"use client";

import { useRef, useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { Field } from "@/components/Field";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { commonName } from "@/lib/distinguishedName";
import { canWrite, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";

const STATUS_LABELS: Record<string, string> = { ACTIVE: "En uso", REPLACED: "Reemplazado" };

/** Tamaño máximo del archivo que admite la API. */
const MAX_BYTES = 64 * 1024;

const date = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let start = 0; start < bytes.length; start += 8192) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(binary);
}

/**
 * Certificado de firma del emisor. El archivo y su contraseña van del formulario a la API y no se
 * guardan en ningún otro sitio: tras enviar, el formulario se vacía. No se puede volver a descargar.
 */
export default function CertificadoPage() {
  const { active } = useTenant();
  const taxpayers = useApi(() => unwrap(api.GET("/taxpayers")), [active?.id]);
  const taxpayer = taxpayers.data?.[0];
  const certificates = useApi(
    async () => (taxpayer ? unwrap(api.GET("/certificates", { params: { query: { taxpayerId: taxpayer.id } } })) : []),
    [taxpayer?.id],
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [uploaded, setUploaded] = useState(false);

  if (!active) {
    return <NoTenant />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !taxpayer) {
      return;
    }
    if (!file) {
      setFileError("Elija el archivo .p12 de su firma electrónica.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("El archivo es demasiado grande para ser un certificado (máximo 64 KB).");
      return;
    }
    setFileError(undefined);
    setSaving(true);
    setError(undefined);
    setUploaded(false);
    try {
      await unwrap(api.POST("/certificates", { body: { taxpayerId: taxpayer.id, p12: await toBase64(file), password } }));
      setUploaded(true);
      await certificates.reload({ quiet: true });
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      // Salga bien o mal, la contraseña y el archivo no se quedan en la página.
      setPassword("");
      setFile(null);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sheet-head">
        <h1>Certificado de firma</h1>
      </div>
      <ErrorNotice error={taxpayers.error} />
      {taxpayers.data && !taxpayer ? <Notice>Primero registre el emisor: el certificado se asocia a su RUC.</Notice> : null}
      {taxpayer ? (
        <>
          <p className="lead">
            Con este certificado se firman los comprobantes de {taxpayer.legalName}: se guarda cifrado y no se puede volver a
            descargar.
          </p>
          <ErrorNotice error={certificates.error} />
          {certificates.data?.length === 0 ? (
            <Notice kind="warning">Aún no hay certificado: las facturas se emiten, pero quedan sin firmar hasta que cargue uno.</Notice>
          ) : null}
          {certificates.data && certificates.data.length > 0 ? (
            <div className="table-scroll">
              <table className="ruled">
                <thead>
                  <tr>
                    <th scope="col">Titular</th>
                    <th scope="col">Válido desde</th>
                    <th scope="col">Válido hasta</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.data.map((certificate) => (
                    <tr key={certificate.id}>
                      <td>
                        {commonName(certificate.subject)}
                        <p className="field-hint break">{certificate.subject}</p>
                      </td>
                      <td>{date.format(new Date(certificate.validFrom))}</td>
                      <td>{date.format(new Date(certificate.validTo))}</td>
                      <td>{STATUS_LABELS[certificate.status] ?? certificate.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {canWrite(active) ? (
            <>
              <h2>Cargar un certificado</h2>
              <p className="lead">El nuevo certificado reemplaza al que esté en uso.</p>
              <form className="form" onSubmit={submit} noValidate>
                <Field label="Archivo de la firma electrónica (.p12)" error={fileError}>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".p12,.pfx,application/x-pkcs12"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    required
                  />
                </Field>
                <Field label="Contraseña del certificado">
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" required />
                </Field>
                <div className="actions wide">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    Cargar certificado
                  </button>
                </div>
              </form>
              {uploaded ? <Notice kind="success">Certificado cargado. Ya se puede firmar con él.</Notice> : null}
              <ErrorNotice error={error} />
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
