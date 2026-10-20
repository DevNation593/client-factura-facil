"use client";

import Link from "next/link";
import { useState } from "react";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { Field } from "@/components/Field";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice } from "@/components/Notice";
import { Pager } from "@/components/Pager";
import { StateBadge } from "@/components/StateBadge";
import { formatIssueDate } from "@/lib/dates";
import { describeState } from "@/lib/documentStates";
import { documentTypeShort } from "@/lib/documentTypes";
import { canBill, useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";
import { usePolling } from "@/lib/usePolling";

type DocumentTypeCode = components["schemas"]["DocumentTypeCode"];

const PAGE_SIZE = 20;

const TYPE_FILTERS = [
  { value: "", label: "Todos los tipos" },
  { value: "01", label: "Facturas" },
  { value: "04", label: "Notas de crédito" },
  { value: "05", label: "Notas de débito" },
] as const;

/** Monitor de comprobantes: qué se emitió y en qué punto está cada uno ante el SRI. */
export default function DocumentosPage() {
  const { active } = useTenant();
  const [page, setPage] = useState(0);
  const [type, setType] = useState("");
  const documents = useApi(
    () =>
      unwrap(
        api.GET("/documents", {
          params: { query: { page, size: PAGE_SIZE, ...(type ? { documentType: type as DocumentTypeCode } : {}) } },
        }),
      ),
    [active?.id, page, type],
  );
  // Mientras algún comprobante siga avanzando, la lista se refresca sola.
  const inProgress = documents.data?.items.some((document) => !describeState(document.state).final) ?? false;
  usePolling(() => void documents.reload({ quiet: true }), inProgress);

  if (!active) {
    return <NoTenant />;
  }
  return (
    <>
      <div className="sheet-head">
        <h1>Comprobantes</h1>
        {canBill(active) ? (
          <Link className="btn btn-primary" href="/facturas/nueva">
            Nueva factura
          </Link>
        ) : null}
      </div>
      <div className="form">
        <Field label="Tipo">
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(0);
            }}
          >
            {TYPE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorNotice error={documents.error} />
      {documents.loading && !documents.data ? <p>Cargando…</p> : null}
      {documents.data && documents.data.items.length === 0 ? (
        <p className="empty">Aún no se ha emitido ningún comprobante.</p>
      ) : null}
      {documents.data && documents.data.items.length > 0 ? (
        <div className="table-scroll">
          <table className="ruled">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Número</th>
                <th scope="col">Cliente</th>
                <th scope="col">Fecha</th>
                <th scope="col" className="num">
                  Total
                </th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {documents.data.items.map((document) => (
                <tr key={document.id}>
                  <td>{documentTypeShort(document.documentType)}</td>
                  <td className="code">
                    <Link href={`/documentos/${document.id}`}>{document.number}</Link>
                  </td>
                  <td>{document.customerName}</td>
                  <td>{formatIssueDate(document.issueDate)}</td>
                  <td className="num">{document.total}</td>
                  <td>
                    <StateBadge state={document.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {documents.data ? <Pager page={page} size={PAGE_SIZE} total={documents.data.total} onPage={setPage} /> : null}
    </>
  );
}
