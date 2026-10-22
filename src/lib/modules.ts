import { DOCUMENT_SUBMODULES } from "./documentTypes";

/** Una entrada del menú dentro de un módulo. Su dirección cuelga de la del módulo. */
export type Submodule = {
  title: string;
  href: string;
  /** "write": solo para quien administra la empresa (propietario y administradores). */
  access?: "write";
};

/** Un módulo de la aplicación: un grupo del menú, una carpeta de src/app/(app) y el comienzo de sus direcciones. */
export type Module = {
  title: string;
  href: string;
  submodules: readonly Submodule[];
};

/** Los módulos y sus submódulos, en el orden del menú. */
export const MODULES: readonly Module[] = [
  {
    title: "Comprobantes",
    href: "/documents",
    submodules: DOCUMENT_SUBMODULES.map(({ title, href }) => ({ title, href })),
  },
  {
    title: "Catálogos",
    href: "/catalogs",
    submodules: [
      { title: "Clientes", href: "/catalogs/customers" },
      { title: "Productos", href: "/catalogs/products" },
    ],
  },
  {
    title: "Configuración",
    href: "/settings",
    submodules: [
      { title: "Empresas", href: "/settings/companies" },
      { title: "Emisor", href: "/settings/issuer" },
      { title: "Certificado", href: "/settings/certificate" },
      { title: "Integraciones", href: "/settings/integrations", access: "write" },
    ],
  },
];

/** A dónde lleva la dirección de un módulo a secas: a su primer submódulo. */
export function moduleHome(href: string): string {
  const found = MODULES.find((entry) => entry.href === href);
  if (!found?.submodules[0]) {
    throw new Error(`Módulo desconocido: ${href}`);
  }
  return found.submodules[0].href;
}
