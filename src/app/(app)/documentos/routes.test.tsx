import { screen, waitFor } from "@testing-library/react";
import { redirect } from "next/navigation";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

import { DOCUMENT_MODULES } from "@/lib/documentTypes";
import { json, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import DocumentosPage from "./page";

const pages = import.meta.glob<{ default: ComponentType }>("./*/page.tsx", { eager: true });

/** La página que Next sirve en la dirección de un submódulo. */
function pageAt(href: string): ComponentType {
  const page = pages[`.${href.replace(/^\/documentos/, "")}/page.tsx`];
  if (!page) {
    throw new Error(`Sin página para ${href}`);
  }
  return page.default;
}

describe("Submódulos de comprobantes", () => {
  it.each(DOCUMENT_MODULES.map((entry) => [entry.href, entry.code, entry.title] as const))(
    "%s lists only type %s",
    async (href, code, title) => {
      const api = stubApi({ "GET /documents": () => json(200, { items: [], page: 0, size: 20, total: 0 }) });
      const Page = pageAt(href);
      renderWithTenant(<Page />);

      expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
      await waitFor(() => expect(api.to("GET", "/documents")).toHaveLength(1));
      expect(api.to("GET", "/documents")[0]?.query.get("documentType")).toBe(code);
    },
  );

  it("opens the invoices when no type is given", () => {
    DocumentosPage();

    expect(redirect).toHaveBeenCalledWith("/documentos/facturas");
  });
});
