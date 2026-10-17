import { describe, expect, it } from "vitest";

import { commonName, holderName } from "./distinguishedName";

describe("holderName", () => {
  it("keeps only the holder's name, without the ID number some entities put first", () => {
    expect(holderName("L=SHUSHUFINDI,CN=2101137889 STIWAR ALEXANDER SALTOS AGUIRRE,O=SALTOS,C=EC")).toBe(
      "STIWAR ALEXANDER SALTOS AGUIRRE",
    );
    expect(holderName("CN=1790012345001 COMERCIAL ANDINA S.A.,C=EC")).toBe("COMERCIAL ANDINA S.A.");
    expect(holderName("CN=ANA PEREZ,SERIALNUMBER=1712345678,C=EC")).toBe("ANA PEREZ");
  });

  it("leaves numbers that are not an ID, or a name that is only a number", () => {
    expect(holderName("CN=123 SERVICIOS,C=EC")).toBe("123 SERVICIOS");
    expect(holderName("CN=2101137889,C=EC")).toBe("2101137889");
  });
});

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
