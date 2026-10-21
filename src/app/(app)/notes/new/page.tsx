"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { NoTenant } from "@/components/NoTenant";
import { Notice } from "@/components/Notice";
import { canBill, useTenant } from "@/lib/tenantContext";

import { CreditNoteForm } from "./CreditNoteForm";
import { DebitNoteForm } from "./DebitNoteForm";

type NoteType = "credito" | "debito";

const TABS: { type: NoteType; label: string }[] = [
  { type: "credito", label: "Nota de crédito" },
  { type: "debito", label: "Nota de débito" },
];

/** Dirección de una pestaña: conserva la factura elegida al cambiar de tipo de nota. */
function tabHref(type: NoteType, invoiceId: string | null): string {
  const query = new URLSearchParams({ tipo: type });
  if (invoiceId) {
    query.set("factura", invoiceId);
  }
  return `/notes/new?${query.toString()}`;
}

/** Emisión de notas de crédito y de débito, sobre una factura de la plataforma (`factura`) o escrita a mano. */
export default function NuevaNotaPage() {
  const { active } = useTenant();
  const params = useSearchParams();
  const type: NoteType = params.get("tipo") === "debito" ? "debito" : "credito";
  const invoiceId = params.get("factura");
  if (!active) {
    return <NoTenant />;
  }
  if (!canBill(active)) {
    return <Notice>Su rol en esta empresa no permite emitir notas.</Notice>;
  }
  return (
    <>
      <div className="sheet-head">
        <h1>Nueva nota</h1>
      </div>
      <nav className="tabs" aria-label="Tipo de nota">
        {TABS.map((tab) => (
          <Link key={tab.type} href={tabHref(tab.type, invoiceId)} aria-current={tab.type === type ? "page" : undefined}>
            {tab.label}
          </Link>
        ))}
      </nav>
      {type === "credito" ? (
        <CreditNoteForm key={`${active.id}:${invoiceId ?? ""}`} tenantId={active.id} invoiceId={invoiceId} />
      ) : (
        <DebitNoteForm key={`${active.id}:${invoiceId ?? ""}`} tenantId={active.id} invoiceId={invoiceId} />
      )}
    </>
  );
}
