import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { pinTenant } from "./src/lib/tenant";
import { route, router } from "./src/test/navigation";

// Las pantallas navegan con el enrutador de Next, que fuera de Next no existe.
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => route.pathname,
  useParams: () => route.params,
  useSearchParams: () => new URLSearchParams(route.search),
  redirect: vi.fn(),
}));

afterEach(() => {
  cleanup();
  router.push.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
  route.params = {};
  route.pathname = "/";
  route.search = "";
  // Cada prueba empieza sin empresa activa ni borradores guardados.
  pinTenant(null);
  if (typeof document !== "undefined") {
    document.cookie = "einvoice_tenant=; Path=/; Max-Age=0";
    window.localStorage.clear();
  }
});
