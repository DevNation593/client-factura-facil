"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { CatalogPicker } from "@/components/CatalogPicker";
import { Field } from "@/components/Field";
import { ErrorNotice, Notice } from "@/components/Notice";
import { formatIssueDate } from "@/lib/dates";
import { normalizeInvoiceNumber } from "@/lib/invoiceNumber";
import { useApi } from "@/lib/useApi";

type Document = components["schemas"]["Document"];

/** Factura escrita a mano que modifica la nota: su número, su fecha y su comprador. */
export type ManualInvoice = { number: string; date: string; customerId: string; customerLabel: string };

export const emptyManualInvoice: ManualInvoice = { number: "", date: "", customerId: "", customerLabel: "" };

/** Carga la factura de la plataforma que modifica la nota y exige que sea una factura autorizada. */
export function AuthorizedInvoice({
  tenantId,
  invoiceId,
  children,
}: {
  tenantId: string;
  invoiceId: string;
  children: (invoice: Document) => ReactNode;
}) {
  const invoice = useApi(() => unwrap(api.GET("/documents/{id}", { params: { path: { id: invoiceId } } })), [tenantId, invoiceId]);
  if (invoice.error) {
    return <ErrorNotice error={invoice.error} />;
  }
  if (!invoice.data) {
    return <p className="lead">Cargando la factura…</p>;
  }
  if (invoice.data.documentType !== "01") {
    return <Notice kind="warning">El comprobante elegido no es una factura. Elija una factura desde los <Link href="/documentos">comprobantes</Link>.</Notice>;
  }
  if (invoice.data.state !== "AUTHORIZED") {
    return (
      <Notice kind="warning">
        Solo se puede emitir una nota sobre una factura autorizada. <Link href={`/documentos/${invoice.data.id}`}>Vea el estado de la factura {invoice.data.number}</Link>.
      </Notice>
    );
  }
  return <>{children(invoice.data)}</>;
}

/** Datos de la factura de la plataforma que modifica la nota. */
export function InvoiceFacts({ invoice }: { invoice: Document }) {
  return (
    <dl className="facts">
      <dt>Modifica a</dt>
      <dd>
        <Link href={`/documentos/${invoice.id}`}>
          Factura {invoice.number} del {formatIssueDate(invoice.issueDate)}
        </Link>
      </dd>
      <dt>Cliente</dt>
      <dd>
        {invoice.customer.name} ({invoice.customer.idNumber})
      </dd>
    </dl>
  );
}

/** Aviso de la factura que no se emitió en la plataforma. */
export function ManualInvoiceNotice() {
  return (
    <Notice>
      ¿La factura se emitió aquí? <Link href="/documentos">Ábrela desde Comprobantes</Link>
    </Notice>
  );
}

/** Campos de la factura escrita a mano: su número, su fecha y un cliente del catálogo. */
export function ManualInvoiceFields({ tenantId, value, onChange }: { tenantId: string; value: ManualInvoice; onChange: (value: ManualInvoice) => void }) {
  const numberValid = normalizeInvoiceNumber(value.number) !== null;

  async function searchCustomers(query: string) {
    const page = await unwrap(api.GET("/customers", { params: { query: { size: 20, ...(query ? { q: query } : {}) } } }));
    return page.items;
  }

  return (
    <>
      <Field
        label="Número de la factura"
        hint="EEE-PPP-SSSSSSSSS: establecimiento, punto de emisión y secuencial. Puede escribir los 15 dígitos sin guiones."
        error={value.number.trim() !== "" && !numberValid ? "Escriba el número completo, por ejemplo 001-001-000000123." : undefined}
      >
        {/* Teclado numérico en el teléfono: no tiene guion, así que se aceptan los 15 dígitos y al salir se muestran con guiones. */}
        <input
          inputMode="numeric"
          placeholder="001-001-000000123"
          value={value.number}
          onChange={(event) => onChange({ ...value, number: event.target.value })}
          onBlur={() => onChange({ ...value, number: normalizeInvoiceNumber(value.number) ?? value.number })}
        />
      </Field>
      <Field label="Fecha de la factura">
        <input type="date" value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} />
      </Field>
      <Field label="Cliente" className="wide">
        <CatalogPicker
          tenantId={tenantId}
          value={value.customerId}
          selectedLabel={value.customerLabel}
          placeholder="Elija o busque un cliente"
          load={searchCustomers}
          optionLabel={(customer) => `${customer.name} (${customer.idNumber})`}
          onSearchStart={() => onChange({ ...value, customerLabel: "", customerId: "" })}
          onSelect={(customer) => onChange({ ...value, customerLabel: `${customer.name} (${customer.idNumber})`, customerId: customer.id })}
        />
      </Field>
    </>
  );
}
