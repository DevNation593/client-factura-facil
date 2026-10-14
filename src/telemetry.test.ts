// @vitest-environment node
import { expect, it } from "vitest";

it("turns Next's telemetry off wherever the application is built or started", async () => {
  delete process.env.NEXT_TELEMETRY_DISABLED;

  await import("../next.config");

  // Next lee esta variable después de cargar su configuración: no depende de cómo se lance.
  expect(process.env.NEXT_TELEMETRY_DISABLED).toBe("1");
});
