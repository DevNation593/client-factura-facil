"use client";

import { useState, type ReactNode } from "react";

import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";

/** Un valor secreto recién creado: es la única vez que se puede ver, con su botón para copiarlo. */
export function SecretNotice({
  label,
  value,
  copyLabel,
  children,
}: {
  label: string;
  value: string;
  copyLabel: string;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    }
    catch {
      // Sin permiso para el portapapeles: el valor sigue a la vista para copiarlo a mano.
      setCopied(false);
    }
  }

  return (
    <Notice kind="success">
      {children}
      <Field label={label}>
        <input value={value} readOnly onFocus={(event) => event.target.select()} />
      </Field>
      <p className="actions">
        <button type="button" className="btn" onClick={copy}>
          {copyLabel}
        </button>
        {copied ? <span role="status">Copiado.</span> : null}
      </p>
    </Notice>
  );
}
