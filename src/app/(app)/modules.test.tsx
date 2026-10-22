import { existsSync } from "node:fs";
import { join } from "node:path";

import { redirect } from "next/navigation";
import { describe, expect, it } from "vitest";

import { MODULES, moduleHome } from "@/lib/modules";

import CatalogsPage from "./catalogs/page";
import DocumentsPage from "./documents/page";
import SettingsPage from "./settings/page";

/** La carpeta de una dirección dentro de src/app/(app). */
function folder(href: string): string {
  return join(__dirname, ...href.split("/"));
}

describe("Módulos y submódulos", () => {
  it("keeps every submodule in a folder inside its module's folder", () => {
    for (const entry of MODULES) {
      expect(existsSync(join(folder(entry.href), "page.tsx")), entry.href).toBe(true);
      for (const submodule of entry.submodules) {
        expect(submodule.href.startsWith(`${entry.href}/`), submodule.href).toBe(true);
        expect(existsSync(join(folder(submodule.href), "page.tsx")), submodule.href).toBe(true);
      }
    }
  });

  it("names the modules and their submodules in the order of the menu", () => {
    expect(MODULES.map((entry) => [entry.title, entry.submodules.map((submodule) => submodule.title)])).toEqual([
      ["Comprobantes", ["Facturas", "Notas de crédito", "Notas de débito", "Guías de remisión", "Liquidaciones de compra", "Retenciones"]],
      ["Catálogos", ["Clientes", "Productos"]],
      ["Configuración", ["Empresas", "Emisor", "Certificado", "Integraciones"]],
    ]);
  });

  it.each([
    [DocumentsPage, "/documents/invoices"],
    [CatalogsPage, "/catalogs/customers"],
    [SettingsPage, "/settings/companies"],
  ])("opens the first submodule when only the module is given", (Page, first) => {
    Page();

    expect(redirect).toHaveBeenCalledWith(first);
  });

  it("refuses an address that is not a module", () => {
    expect(() => moduleHome("/documents/invoices")).toThrow();
  });
});
