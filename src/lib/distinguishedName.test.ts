import { describe, expect, it } from "vitest";

import { commonName } from "./distinguishedName";

describe("commonName", () => {
  it("takes the common name out of a distinguished name", () => {
    expect(commonName("CN=Emisor de Pruebas,O=Pruebas,C=EC")).toBe("Emisor de Pruebas");
    expect(commonName("SERIALNUMBER=0912345678,CN=ANA MARIA PEREZ LOPEZ,OU=ENTIDAD,C=EC")).toBe("ANA MARIA PEREZ LOPEZ");
  });

  it("keeps escaped commas inside the name", () => {
    expect(commonName("CN=PEREZ\\, JUAN,O=X")).toBe("PEREZ, JUAN");
  });

  it("falls back to the whole name when there is no common name", () => {
    expect(commonName("O=Solo Organización,C=EC")).toBe("O=Solo Organización,C=EC");
    expect(commonName("")).toBe("");
  });
});
