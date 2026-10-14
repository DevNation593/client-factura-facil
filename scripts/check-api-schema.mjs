// Genera src/api/schema.ts a partir del contrato OpenAPI, o comprueba que está al día.
//   node scripts/check-api-schema.mjs --write   lo regenera
//   node scripts/check-api-schema.mjs           termina con error si está desactualizado
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import openapiTS, { astToString } from "openapi-typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = path.resolve(here, "../../contracts/openapi.yaml");
const generated = path.resolve(here, "../src/api/schema.ts");

const header = "// Generado desde contracts/openapi.yaml con `npm run api:generate`. No editar a mano.\n\n";
const expected = header + astToString(await openapiTS(pathToFileURL(contract)));

if (process.argv.includes("--write")) {
  await writeFile(generated, expected, "utf8");
  console.log("src/api/schema.ts generado");
}
else {
  const normalize = (text) => text.replace(/\r\n/g, "\n").trim();
  const actual = await readFile(generated, "utf8").catch(() => "");
  if (normalize(expected) !== normalize(actual)) {
    console.error("src/api/schema.ts no corresponde a contracts/openapi.yaml. Ejecute: npm run api:generate");
    process.exit(1);
  }
}
