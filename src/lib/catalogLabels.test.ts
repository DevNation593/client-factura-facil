import { describe, expect, it } from "vitest";

import { catalogLabel } from "./catalogLabels";

describe("catalogLabel", () => {
  it("shows the uppercase names of the SRI's catalogues in sentence case", () => {
    expect(catalogLabel("CÉDULA")).toBe("Cédula");
    expect(catalogLabel("VENTA A CONSUMIDOR FINAL")).toBe("Venta a consumidor final");
    expect(catalogLabel("IDENTIFICACIÓN DEL EXTERIOR")).toBe("Identificación del exterior");
    expect(catalogLabel("TARJETA DE CRÉDITO")).toBe("Tarjeta de crédito");
  });

  it("keeps acronyms and puts back the accent the catalogue leaves out", () => {
    expect(catalogLabel("RUC")).toBe("RUC");
    expect(catalogLabel("SIN UTILIZACION DEL SISTEMA FINANCIERO")).toBe("Sin utilización del sistema financiero");
  });

  it("leaves alone what is not all in capitals", () => {
    expect(catalogLabel("Exento de IVA")).toBe("Exento de IVA");
    expect(catalogLabel("15%")).toBe("15%");
  });
});
