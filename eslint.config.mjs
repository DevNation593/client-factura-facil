import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // src/api/schema.ts es código generado desde el contrato OpenAPI.
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "src/api/schema.ts"]),
]);
