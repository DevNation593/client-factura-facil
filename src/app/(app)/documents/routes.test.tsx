import { screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";

import { DOCUMENT_SUBMODULES } from "@/lib/documentTypes";
import { json, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

const pages = import.meta.glob<{ default: ComponentType }>("./*/page.tsx", { eager: true });

/** La página que Next sirve en la dirección de un submódulo. */
function pageAt(href: string): ComponentType {
  const page = pages[`.${href.replace(/^\/documents/, "")}/page.tsx`];
  if (!page) {
    throw new Error(`Sin página para ${href}`);
  }
  return page.default;
}

describe("Submódulos de comprobantes", () => {
  it.each(DOCUMENT_SUBMODULES.map((entry) => [entry.href, entry.code, entry.title] as const))(
    "%s lists only type %s",
    async (href, code, title) => {
      const api = stubApi({ "GET /documents": () => json(200, { items: [], page: 0, size: 20, total: 0 }) });
      const Page = pageAt(href);
      renderWithTenant(<Page />);

      expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
      // Las facturas piden además las últimas para su resumen.
      await waitFor(() => expect(api.to("GET", "/documents")).toHaveLength(code === "01" ? 2 : 1));
      for (const call of api.to("GET", "/documents")) {
        expect(call.query.get("documentType")).toBe(code);
      }
    },
  );

});
