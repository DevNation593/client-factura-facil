"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { NoTenant } from "@/components/NoTenant";
import { Notice } from "@/components/Notice";
import { SubmoduleTabs } from "@/components/SubmoduleTabs";
import { deleteDraft, listDrafts, type Draft } from "@/lib/drafts";
import { useTenant } from "@/lib/tenantContext";

const when = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" });

/** Facturas a medio escribir en este navegador. Aún no tienen número: se asigna al emitirlas. */
export default function BorradoresPage() {
  const { active } = useTenant();
  if (!active) {
    return <NoTenant />;
  }
  return <DraftList key={active.id} tenantId={active.id} />;
}

function DraftList({ tenantId }: { tenantId: string }) {
  const [drafts, setDrafts] = useState<Draft[]>(() => listDrafts(tenantId));

  function discard(id: string) {
    deleteDraft(tenantId, id);
    setDrafts(listDrafts(tenantId));
  }

  return (
    <>
      <div className="sheet-head">
        <h1>Borradores</h1>
      </div>
      <SubmoduleTabs type="01" />
      <Notice>
        Los borradores se guardan solo en este navegador. No se ven desde otro equipo y se pierden si borra los datos de navegación.
      </Notice>
      {drafts.length === 0 ? (
        <EmptyState icon="draft">No hay borradores.</EmptyState>
      ) : (
        <table className="ruled">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col" className="num">
                Líneas
              </th>
              <th scope="col">Último cambio</th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr key={draft.id}>
                <td>{draft.customerName || "Sin cliente"}</td>
                <td className="num">{draft.lines.length}</td>
                <td>{when.format(new Date(draft.updatedAt))}</td>
                <td className="actions">
                  <Link href={`/documents/invoices/new?borrador=${draft.id}`}>
                    Continuar{" "}
                    <span className="sr-only">el borrador de {draft.customerName || "cliente sin elegir"}</span>
                  </Link>
                  <button type="button" className="btn-link" onClick={() => discard(draft.id)}>
                    Descartar{" "}
                    <span className="sr-only">el borrador de {draft.customerName || "cliente sin elegir"}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
