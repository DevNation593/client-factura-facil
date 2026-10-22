"use client";

import Link from "next/link";
import { useState } from "react";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";
import { NoTenant } from "@/components/NoTenant";
import { ErrorNotice, Notice } from "@/components/Notice";
import { Pager } from "@/components/Pager";
import { StateBadge } from "@/components/StateBadge";
import { SubmoduleTabs } from "@/components/SubmoduleTabs";
import { formatIssueDate } from "@/lib/dates";
import { describeState } from "@/lib/documentStates";
import { documentSubmodule } from "@/lib/documentTypes";
import { useTenant } from "@/lib/tenantContext";
import { useApi } from "@/lib/useApi";
import { usePolling } from "@/lib/usePolling";

type DocumentTypeCode = components["schemas"]["DocumentTypeCode"];

const PAGE_SIZE = 20;

/** Monitor de un tipo de comprobante: qué se emitió y en qué punto está cada uno ante el SRI. */
export function DocumentList({ type }: { type: DocumentTypeCode }) {
  const { active } = useTenant();
  const section = documentSubmodule(type);
  const [page, setPage] = useState(0);
  const documents = useApi(
    () => unwrap(api.GET("/documents", { params: { query: { page, size: PAGE_SIZE, documentType: type } } })),
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
        <h1>{section.title}</h1>
      </div>
      <SubmoduleTabs type={type} />
      {section.issue ? null : <Notice>La plataforma todavía no emite {section.title.toLowerCase()}.</Notice>}
      <ErrorNotice error={documents.error} />
      {documents.loading && !documents.data ? <p>Cargando…</p> : null}
      {documents.data && documents.data.items.length === 0 ? <p className="empty">{section.empty}</p> : null}
      {documents.data && documents.data.items.length > 0 ? (
        <div className="table-scroll">
          <table className="ruled">
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">{section.counterpart}</th>
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
                  <td className="code">
                    <Link href={`/documents/${document.id}`}>{document.number}</Link>
                  </td>
                  <td>{document.customerName}</td>
                  <td>{formatIssueDate(document.issueDate)}</td>
                  <td className="num">{document.total ?? "—"}</td>
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
