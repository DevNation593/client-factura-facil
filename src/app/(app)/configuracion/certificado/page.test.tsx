import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import CertificadoPage from "./page";

const TAXPAYER = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ruc: "1790012345001",
  legalName: "Comercial Andina S.A.",
  headOfficeAddress: "Quito",
  defaultEnvironment: "1",
};
const CERTIFICATE = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  taxpayerId: TAXPAYER.id,
  subject: "CN=ANA PEREZ,SERIALNUMBER=1712345678,O=SECURITY DATA,C=EC",
  issuer: "CN=AC",
  serialNumber: "1",
  fingerprintSha256: "ab".repeat(32),
  validFrom: "2026-01-01T00:00:00Z",
  validTo: "2028-01-01T00:00:00Z",
  status: "ACTIVE",
};

const BYTES = new Uint8Array([0x30, 0x82, 0x00, 0xff, 0x01, 0x7f]);

function p12(): File {
  return new File([BYTES], "firma.p12", { type: "application/x-pkcs12" });
}

describe("Certificado", () => {
  it("uploads the file as Base64 and clears the password", async () => {
    let stored: unknown[] = [];
    const api = stubApi({
      "GET /taxpayers": () => json(200, [TAXPAYER]),
      "GET /certificates": () => json(200, stored),
      "POST /certificates": () => {
        stored = [CERTIFICATE];
        return json(201, CERTIFICATE);
      },
    });
    renderWithTenant(<CertificadoPage />);
    const file = await screen.findByLabelText("Archivo de la firma electrónica (.p12)");
    expect(screen.getByRole("status")).toHaveTextContent(/quedan sin firmar/);

    await userEvent.upload(file, p12());
    await userEvent.type(screen.getByLabelText("Contraseña del certificado"), "clave-de-prueba");
    await userEvent.click(screen.getByRole("button", { name: "Cargar certificado" }));

    expect(await screen.findByText("Certificado cargado. Ya se puede firmar con él.")).toBeInTheDocument();
    expect(api.to("POST", "/certificates")[0]?.body).toEqual({
      taxpayerId: TAXPAYER.id,
      p12: btoa(String.fromCharCode(...BYTES)),
      password: "clave-de-prueba",
    });
    expect(screen.getByLabelText("Contraseña del certificado")).toHaveValue("");
    expect((screen.getByLabelText("Archivo de la firma electrónica (.p12)") as HTMLInputElement).value).toBe("");
    // El titular por su nombre, y el nombre completo del certificado debajo.
    const holder = await screen.findByRole("cell", { name: /^ANA PEREZ/ });
    expect(holder).toHaveTextContent("CN=ANA PEREZ,SERIALNUMBER=1712345678,O=SECURITY DATA,C=EC");
    expect(screen.getByText("ANA PEREZ", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("En uso")).toBeInTheDocument();
    expect(api.to("GET", "/certificates")[0]?.query.get("taxpayerId")).toBe(TAXPAYER.id);
  });

  it("explains why the certificate was rejected, and still clears the password", async () => {
    stubApi({
      "GET /taxpayers": () => json(200, [TAXPAYER]),
      "GET /certificates": () => json(200, []),
      "POST /certificates": () => problem(422, "CERTIFICATE_UNREADABLE"),
    });
    renderWithTenant(<CertificadoPage />);

    await userEvent.upload(await screen.findByLabelText("Archivo de la firma electrónica (.p12)"), p12());
    await userEvent.type(screen.getByLabelText("Contraseña del certificado"), "clave-equivocada");
    await userEvent.click(screen.getByRole("button", { name: "Cargar certificado" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El archivo no es un certificado .p12 válido o la contraseña es incorrecta.");
    expect(screen.getByLabelText("Contraseña del certificado")).toHaveValue("");
  });

  it("needs a file before calling the API", async () => {
    const api = stubApi({ "GET /taxpayers": () => json(200, [TAXPAYER]), "GET /certificates": () => json(200, []) });
    renderWithTenant(<CertificadoPage />);
    await screen.findByLabelText("Archivo de la firma electrónica (.p12)");

    await userEvent.type(screen.getByLabelText("Contraseña del certificado"), "clave");
    await userEvent.click(screen.getByRole("button", { name: "Cargar certificado" }));

    expect(screen.getByLabelText("Archivo de la firma electrónica (.p12)")).toHaveAccessibleDescription(/Elija el archivo/);
    expect(api.to("POST", "/certificates")).toHaveLength(0);
  });

  it("shows the list to an auditor, without the upload form", async () => {
    stubApi({ "GET /taxpayers": () => json(200, [TAXPAYER]), "GET /certificates": () => json(200, [CERTIFICATE]) });
    renderWithTenant(<CertificadoPage />, { role: "AUDITOR" });

    expect(await screen.findByText("ANA PEREZ", { exact: true })).toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña del certificado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cargar certificado" })).not.toBeInTheDocument();
  });

  it("asks to register the issuer first", async () => {
    stubApi({ "GET /taxpayers": () => json(200, []) });
    renderWithTenant(<CertificadoPage />);

    expect(await screen.findByText(/Primero registre el emisor/)).toBeInTheDocument();
  });
});
