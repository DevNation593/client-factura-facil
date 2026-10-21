import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEGACY_NOTE_ROUTES, LEGACY_ROUTES, legacyRedirects, NOTE_ROUTES } from "./legacyRoutes";

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

  it("sends the old note screen to the note of its type", () => {
    for (const from of LEGACY_NOTE_ROUTES) {
      expect(hasPage(from), from).toBe(false);
    }
    expect(hasPage(NOTE_ROUTES.credit)).toBe(true);
    expect(hasPage(NOTE_ROUTES.debit)).toBe(true);
    const rules = legacyRedirects().filter((rule) => rule.source === "/notes/new");
    // La de débito, que mira la consulta, tiene que ir antes que la que no mira nada.
    expect(rules).toEqual([
      { source: "/notes/new", destination: "/documents/debit-notes/new", permanent: false, has: [{ type: "query", key: "tipo", value: "debito" }] },
      { source: "/notes/new", destination: "/documents/credit-notes/new", permanent: false },
    ]);
  });

  it("goes straight to the final address, with no redirect in between", () => {
    const sources = LEGACY_ROUTES.map(([from]) => from);
    for (const [, to] of LEGACY_ROUTES) {
      expect(sources.filter((from) => to === from || to.startsWith(`${from}/`)), to).toEqual([]);
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
