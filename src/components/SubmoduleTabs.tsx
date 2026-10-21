"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { components } from "@/api/schema";
import { documentSubmodule, submoduleTabs } from "@/lib/documentTypes";
import { canBill, useTenant } from "@/lib/tenantContext";

type DocumentTypeCode = components["schemas"]["DocumentTypeCode"];

/**
 * Pestañas de un submódulo de comprobantes (Emitidas, Borradores, Nueva…), con la pantalla actual
 * marcada. Nada si solo queda la de lo emitido: un auditor, o un tipo que la plataforma no emite.
 */
export function SubmoduleTabs({ type }: { type: DocumentTypeCode }) {
  const { active } = useTenant();
  const pathname = usePathname();
  const submodule = documentSubmodule(type);
  const tabs = submoduleTabs(submodule, canBill(active));
  if (tabs.length < 2) {
    return null;
  }
  return (
    <nav className="tabs" aria-label={submodule.title}>
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
