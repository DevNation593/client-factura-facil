"use client";

import { useState, type FormEvent } from "react";

import { api, unwrap } from "@/api/client";
import { ApiError } from "@/api/problem";
import type { components } from "@/api/schema";
import { Field } from "@/components/Field";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { ProductionStep } from "@/components/ProductionStep";
import { canWrite, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";

type Taxpayer = components["schemas"]["Taxpayer"];
type Establishment = components["schemas"]["Establishment"];
type EmissionPoint = components["schemas"]["EmissionPoint"];

const RUC = /^[0-9]{10}001$/;
const THREE_DIGITS = /^[0-9]{3}$/;

const ENVIRONMENTS: Record<string, string> = { "1": "Pruebas", "2": "Producción" };

function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fieldErrors : {};
}

/** Alta del emisor: quién factura, desde qué establecimientos y por qué puntos de emisión. */
export default function EmisorPage() {
  const { active } = useTenant();
  const taxpayers = useApi(() => unwrap(api.GET("/taxpayers")), [active?.id]);

  if (!active) {
    return <NoTenant />;
  }
  const taxpayer = taxpayers.data?.[0];
  const editable = canWrite(active);
  return (
    <>
      <div className="sheet-head">
        <h1>Emisor</h1>
      </div>
      <ErrorNotice error={taxpayers.error} />
      {taxpayers.loading ? <p>Cargando…</p> : null}
      {taxpayers.data && !taxpayer ? (
        editable ? (
          <TaxpayerForm onCreated={() => taxpayers.reload()} />
        ) : (
          <Notice>Esta empresa todavía no tiene registrado su emisor. Lo registra un propietario o un administrador.</Notice>
        )
      ) : null}
      {taxpayer ? (
        <IssuerDetails
          taxpayer={taxpayer}
          editable={editable}
          owner={active.role === "OWNER"}
          onChanged={() => taxpayers.reload({ quiet: true })}
        />
      ) : null}
    </>
  );
}

function TaxpayerForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    ruc: "",
    legalName: "",
    tradeName: "",
    headOfficeAddress: "",
    phone: "",
    accountingRequired: false,
    specialTaxpayerCode: "",
    withholdingAgentCode: "",
    rimpeRegime: "NONE" as "NONE" | "EMPRENDEDOR",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [rucError, setRucError] = useState<string | undefined>(undefined);
  const errors = fieldErrors(error);

  function set<K extends keyof typeof form>(name: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) {
      return;
    }
    if (!RUC.test(form.ruc)) {
      setRucError("El RUC del emisor tiene 13 dígitos y termina en 001.");
      return;
    }
    setRucError(undefined);
    setSaving(true);
    setError(undefined);
    try {
      await unwrap(
        api.POST("/taxpayers", {
          body: {
            ruc: form.ruc,
            legalName: form.legalName.trim(),
            tradeName: form.tradeName.trim() || null,
            headOfficeAddress: form.headOfficeAddress.trim(),
            phone: form.phone.trim() || null,
            defaultEnvironment: "1",
            accountingRequired: form.accountingRequired,
            specialTaxpayerCode: form.specialTaxpayerCode.trim() || null,
            withholdingAgentCode: form.withholdingAgentCode.trim() || null,
            rimpeRegime: form.rimpeRegime,
          },
        }),
      );
      onCreated();
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="lead">
        Registre los datos con los que la empresa consta en el RUC. Aparecerán tal cual en cada comprobante. El emisor empieza en el ambiente de
        pruebas, donde los comprobantes no tienen validez tributaria; el paso a producción se activa después.
      </p>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="RUC" hint="Trece dígitos, terminado en 001." error={rucError ?? errors.ruc}>
          <input value={form.ruc} onChange={(event) => set("ruc", event.target.value.trim())} inputMode="numeric" maxLength={13} required />
        </Field>
        <Field label="Razón social" error={errors.legalName}>
          <input value={form.legalName} onChange={(event) => set("legalName", event.target.value)} maxLength={300} required />
        </Field>
        <Field label="Nombre comercial" hint="Opcional." error={errors.tradeName}>
          <input value={form.tradeName} onChange={(event) => set("tradeName", event.target.value)} maxLength={300} />
        </Field>
        <Field label="Dirección de la matriz" error={errors.headOfficeAddress}>
          <input value={form.headOfficeAddress} onChange={(event) => set("headOfficeAddress", event.target.value)} maxLength={300} required />
        </Field>
        <Field label="Teléfono" hint="Opcional. Sale en el RIDE." error={errors.phone}>
          <input value={form.phone} onChange={(event) => set("phone", event.target.value)} inputMode="tel" maxLength={30} />
        </Field>
        <Field label="Régimen RIMPE">
          <select value={form.rimpeRegime} onChange={(event) => set("rimpeRegime", event.target.value as "NONE" | "EMPRENDEDOR")}>
            <option value="NONE">No aplica</option>
            <option value="EMPRENDEDOR">Emprendedor</option>
          </select>
        </Field>
        <Field label="Contribuyente especial n.º" hint="Solo si tiene resolución." error={errors.specialTaxpayerCode}>
          <input value={form.specialTaxpayerCode} onChange={(event) => set("specialTaxpayerCode", event.target.value)} maxLength={13} />
        </Field>
        <Field label="Agente de retención, resolución n.º" hint="Solo si fue designado." error={errors.withholdingAgentCode}>
          <input value={form.withholdingAgentCode} onChange={(event) => set("withholdingAgentCode", event.target.value)} inputMode="numeric" maxLength={8} />
        </Field>
        <label className="check wide">
          <input type="checkbox" checked={form.accountingRequired} onChange={(event) => set("accountingRequired", event.target.checked)} />
          Obligado a llevar contabilidad
        </label>
        <div className="actions wide">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Registrar emisor
          </button>
        </div>
      </form>
      <ErrorNotice error={error} />
    </>
  );
}

function IssuerDetails({
  taxpayer,
  editable,
  owner,
  onChanged,
}: {
  taxpayer: Taxpayer;
  editable: boolean;
  owner: boolean;
  onChanged: () => void;
}) {
  const establishments = useApi(
    () => unwrap(api.GET("/taxpayers/{taxpayerId}/establishments", { params: { path: { taxpayerId: taxpayer.id } } })),
    [taxpayer.id],
  );
  return (
    <>
      <dl className="facts">
        <dt>RUC</dt>
        <dd className="num">{taxpayer.ruc}</dd>
        <dt>Razón social</dt>
        <dd>{taxpayer.legalName}</dd>
        {taxpayer.tradeName ? (
          <>
            <dt>Nombre comercial</dt>
            <dd>{taxpayer.tradeName}</dd>
          </>
        ) : null}
        <dt>Dirección de la matriz</dt>
        <dd>{taxpayer.headOfficeAddress}</dd>
        <dt>Teléfono</dt>
        <dd>{editable ? <PhoneForm taxpayer={taxpayer} onSaved={onChanged} /> : taxpayer.phone || "—"}</dd>
        <dt>Ambiente</dt>
        <dd>{ENVIRONMENTS[taxpayer.defaultEnvironment] ?? taxpayer.defaultEnvironment}</dd>
      </dl>

      <h2>Establecimientos y puntos de emisión</h2>
      <p className="lead">
        El número de una factura es establecimiento, punto de emisión y secuencial: por ejemplo 001-001-000000123.
      </p>
      <ErrorNotice error={establishments.error} />
      {establishments.data?.length === 0 ? <p className="empty">Aún no hay establecimientos.</p> : null}
      {establishments.data?.map((establishment) => (
        <EstablishmentBlock key={establishment.id} establishment={establishment} taxpayer={taxpayer} editable={editable} />
      ))}
      {editable ? <EstablishmentForm taxpayerId={taxpayer.id} onCreated={() => establishments.reload({ quiet: true })} /> : null}

      <ProductionStep taxpayer={taxpayer} owner={owner} onActivated={onChanged} />
    </>
  );
}

/** El teléfono es lo único del emisor que se cambia después del alta; vale para los comprobantes nuevos. */
function PhoneForm({ taxpayer, onSaved }: { taxpayer: Taxpayer; onSaved: () => void }) {
  const [value, setValue] = useState(taxpayer.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      const updated = await unwrap(
        api.PATCH("/taxpayers/{id}", { params: { path: { id: taxpayer.id } }, body: { phone: value.trim() || null } }),
      );
      setValue(updated.phone ?? "");
      setSaved(true);
      onSaved();
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor="telefono-emisor">
        Teléfono del emisor
      </label>
      <input
        id="telefono-emisor"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        inputMode="tel"
        maxLength={30}
        size={18}
        placeholder="Sin teléfono"
      />{" "}
      <button type="submit" className="btn-link" disabled={saving}>
        Guardar
      </button>
      {saved ? <span role="status"> Guardado. Sale en los comprobantes que emita desde ahora.</span> : null}
      <ErrorNotice error={error} />
    </form>
  );
}

function EstablishmentForm({ taxpayerId, onCreated }: { taxpayerId: string; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [codeError, setCodeError] = useState<string | undefined>(undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) {
      return;
    }
    if (!THREE_DIGITS.test(code)) {
      setCodeError("Tres dígitos, por ejemplo 001.");
      return;
    }
    setCodeError(undefined);
    setSaving(true);
    setError(undefined);
    try {
      await unwrap(
        api.POST("/taxpayers/{taxpayerId}/establishments", {
          params: { path: { taxpayerId } },
          body: { code, address: address.trim() },
        }),
      );
      setCode("");
      setAddress("");
      onCreated();
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h3>Añadir un establecimiento</h3>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Código del establecimiento" error={codeError}>
          <input value={code} onChange={(event) => setCode(event.target.value.trim())} inputMode="numeric" maxLength={3} required />
        </Field>
        <Field label="Dirección del establecimiento">
          <input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} required />
        </Field>
        <div className="actions wide">
          <button type="submit" className="btn" disabled={saving}>
            Añadir establecimiento
          </button>
        </div>
      </form>
      <ErrorNotice error={error} />
    </>
  );
}

function EstablishmentBlock({ establishment, taxpayer, editable }: { establishment: Establishment; taxpayer: Taxpayer; editable: boolean }) {
  const points = useApi(
    () => unwrap(api.GET("/emission-points", { params: { query: { establishmentId: establishment.id } } })),
    [establishment.id],
  );
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [codeError, setCodeError] = useState<string | undefined>(undefined);

  async function addPoint(event: FormEvent) {
    event.preventDefault();
    if (saving) {
      return;
    }
    if (!THREE_DIGITS.test(code)) {
      setCodeError("Tres dígitos, por ejemplo 001.");
      return;
    }
    setCodeError(undefined);
    setSaving(true);
    setError(undefined);
    try {
      await unwrap(api.POST("/emission-points", { body: { establishmentId: establishment.id, code } }));
      setCode("");
      await points.reload({ quiet: true });
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label={`Establecimiento ${establishment.code}`}>
      <h3>
        Establecimiento <span className="num">{establishment.code}</span>
      </h3>
      <p>{establishment.address}</p>
      <ErrorNotice error={points.error} />
      {points.data?.length === 0 ? <p className="empty">Sin puntos de emisión: añada uno para poder facturar desde aquí.</p> : null}
      {points.data && points.data.length > 0 ? (
        <table className="ruled">
          <thead>
            <tr>
              <th scope="col">Punto de emisión</th>
              <th scope="col">Estado</th>
              {editable ? <th scope="col">Secuencial inicial de facturas</th> : null}
            </tr>
          </thead>
          <tbody>
            {points.data.map((point) => (
              <tr key={point.id}>
                <td className="code">
                  {establishment.code}-{point.code}
                </td>
                <td>{point.enabled ? "Habilitado" : "Deshabilitado"}</td>
                {editable ? (
                  <td>
                    <SequenceForm point={point} label={`${establishment.code}-${point.code}`} environment={taxpayer.defaultEnvironment} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {editable ? (
        <>
          <form className="form" onSubmit={addPoint} noValidate>
            <Field label={`Código del nuevo punto de emisión del establecimiento ${establishment.code}`} error={codeError}>
              <input value={code} onChange={(event) => setCode(event.target.value.trim())} inputMode="numeric" maxLength={3} required />
            </Field>
            <div className="actions">
              <button type="submit" className="btn" disabled={saving}>
                Añadir punto de emisión
              </button>
            </div>
          </form>
          <ErrorNotice error={error} />
        </>
      ) : null}
    </section>
  );
}

/** Solo sirve antes del primer comprobante: para continuar la numeración que la empresa ya llevaba. */
function SequenceForm({ point, label, environment }: { point: EmissionPoint; label: string; environment: Taxpayer["defaultEnvironment"] }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [saved, setSaved] = useState<number | undefined>(undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextValue = Number(value);
    if (saving || !/^[0-9]{1,9}$/.test(value) || nextValue < 1) {
      return;
    }
    setSaving(true);
    setError(undefined);
    setSaved(undefined);
    try {
      const sequence = await unwrap(
        api.PUT("/emission-points/{id}/sequence", {
          params: { path: { id: point.id } },
          body: { environment, documentType: "01", nextValue },
        }),
      );
      setSaved(sequence.nextValue);
      setValue("");
    }
    catch (problem) {
      setError(problem);
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor={`secuencial-${point.id}`}>
        Próximo secuencial de {label}
      </label>
      <input
        id={`secuencial-${point.id}`}
        value={value}
        onChange={(event) => setValue(event.target.value.trim())}
        inputMode="numeric"
        maxLength={9}
        size={10}
        placeholder="1"
      />{" "}
      <button type="submit" className="btn-link" disabled={saving}>
        Fijar
      </button>
      {saved !== undefined ? <span role="status"> La próxima factura será la {saved}.</span> : null}
      <ErrorNotice error={error} />
    </form>
  );
}
