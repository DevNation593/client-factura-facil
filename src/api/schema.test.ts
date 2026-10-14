// @vitest-environment node
import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("src/api/schema.ts", () => {
  it("matches contracts/openapi.yaml", () => {
    const script = path.resolve(__dirname, "../../scripts/check-api-schema.mjs");

    // El script termina con error, y explica cómo regenerar, si el archivo está desactualizado.
    expect(() => execFileSync(process.execPath, [script], { stdio: "pipe" })).not.toThrow();
  }, 60_000);
});
