import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEGACY_ROUTES, legacyRedirects } from "./legacyRoutes";

const APP = join(__dirname, "..", "app");

/** ¿Sirve Next una página en esa dirección? Las pantallas con sesión cuelgan del grupo (app). */
function hasPage(path: string): boolean {
  return [APP, join(APP, "(app)")].some((root) => existsSync(join(root, ...path.split("/"), "page.tsx")));
}

describe("legacyRoutes", () => {
  it("sends every old address to a page that exists", () => {
    for (const [from, to] of LEGACY_ROUTES) {
      expect(hasPage(from), from).toBe(false);
      expect(hasPage(to), to).toBe(true);
    }
  });

  it("keeps the links of the API's emails working", () => {
    expect(LEGACY_ROUTES).toContainEqual(["/verificar-correo", "/verify-email"]);
    expect(LEGACY_ROUTES).toContainEqual(["/restablecer-contrasena", "/reset-password"]);
  });

  it("puts a longer address before the one it starts with, since the first match wins", () => {
    LEGACY_ROUTES.forEach(([from], index) => {
      const earlier = LEGACY_ROUTES.slice(0, index).map(([path]) => path);
      expect(earlier.filter((path) => from.startsWith(`${path}/`)), from).toEqual([]);
    });
  });

  it("carries whatever hangs from the old address", () => {
    expect(legacyRedirects()).toContainEqual({ source: "/documentos/:rest*", destination: "/documents/:rest*", permanent: false });
  });
});
