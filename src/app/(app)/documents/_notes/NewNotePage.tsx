"use client";

import { useSearchParams } from "next/navigation";

import { NoTenant } from "@/components/NoTenant";
import { Notice } from "@/components/Notice";
import { SubmoduleTabs } from "@/components/SubmoduleTabs";
import { canBill, useTenant } from "@/lib/tenantContext";

import { CreditNoteForm } from "./CreditNoteForm";
import { DebitNoteForm } from "./DebitNoteForm";

const KINDS = {
  credit: { title: "Nueva nota de crédito", type: "04" },
  debit: { title: "Nueva nota de débito", type: "05" },
} as const;

/** Emisión de una nota de crédito o de débito, sobre una factura de la plataforma (`factura`) o escrita a mano. */
export function NewNotePage({ kind }: { kind: keyof typeof KINDS }) {
  const { active } = useTenant();
  const invoiceId = useSearchParams().get("factura");
  if (!active) {
    return <NoTenant />;
  }
  if (!canBill(active)) {
    return <Notice>Su rol en esta empresa no permite emitir notas.</Notice>;
  }
  const { title, type } = KINDS[kind];
  const key = `${active.id}:${invoiceId ?? ""}`;
  return (
    <>
      <div className="sheet-head">
        <h1>{title}</h1>
      </div>
      <SubmoduleTabs type={type} />
      {kind === "credit" ? (
        <CreditNoteForm key={key} tenantId={active.id} invoiceId={invoiceId} />
      ) : (
        <DebitNoteForm key={key} tenantId={active.id} invoiceId={invoiceId} />
      )}
    </>
  );
}
