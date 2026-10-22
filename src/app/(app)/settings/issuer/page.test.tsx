import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import EmisorPage from "./page";

const TAXPAYER = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ruc: "1790012345001",
  legalName: "Comercial Andina S.A.",
  tradeName: "Andina",
  headOfficeAddress: "Av. Amazonas N34-12, Quito",
  defaultEnvironment: "1",
  accountingRequired: false,
  rimpeRegime: "NONE",
};
const ESTABLISHMENT = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", taxpayerId: TAXPAYER.id, code: "001", address: "Av. 10 de Agosto, Quito" };
const POINT = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", establishmentId: ESTABLISHMENT.id, code: "002", enabled: true };

const NOT_READY = { certificateValidUntil: null, authorizedTestDocuments: 0, transmissionOpen: false, activatedAt: null, missing: ["CERTIFICATE", "TEST_AUTHORIZATION"] };
const READY = { certificateValidUntil: "2027-03-01T05:00:00Z", authorizedTestDocuments: 3, transmissionOpen: true, activatedAt: null, missing: [] };

/** Emisor ya registrado, con lo que su paso a producción responda en cada momento. */
function issuerApi(readiness: () => unknown, extra: Parameters<typeof stubApi>[0] = {}) {
  return stubApi({
    "GET /taxpayers": () => json(200, [TAXPAYER]),
    "GET /taxpayers/:id/establishments": () => json(200, []),
    "GET /taxpayers/:id/production-readiness": () => json(200, readiness()),
    ...extra,
  });
}

async function fillTaxpayer(ruc: string) {
  await userEvent.type(screen.getByLabelText("RUC"), ruc);
  await userEvent.type(screen.getByLabelText("Razón social"), "Comercial Andina S.A.");
  await userEvent.type(screen.getByLabelText("Dirección de la matriz"), "Av. Amazonas N34-12, Quito");
}

describe("Emisor", () => {
  it("checks that the RUC ends in 001 before sending anything", async () => {
    const api = stubApi({ "GET /taxpayers": () => json(200, []) });
    renderWithTenant(<EmisorPage />);
    await screen.findByLabelText("RUC");

    await fillTaxpayer("1790012345002");
    await userEvent.click(screen.getByRole("button", { name: "Registrar emisor" }));

    expect(screen.getByLabelText("RUC")).toHaveAccessibleDescription(/termina en 001/);
    expect(screen.getByLabelText("RUC")).toBeInvalid();
    expect(api.to("POST", "/taxpayers")).toHaveLength(0);
  });

  it("registers the taxpayer, an establishment and an emission point", async () => {
    const state = { taxpayers: [] as unknown[], establishments: [] as unknown[], points: [] as unknown[] };
    const api = stubApi({
      "GET /taxpayers": () => json(200, state.taxpayers),
      "POST /taxpayers": () => {
        state.taxpayers = [TAXPAYER];
        return json(201, TAXPAYER);
      },
      "GET /taxpayers/:id/establishments": () => json(200, state.establishments),
      "GET /taxpayers/:id/production-readiness": () => json(200, NOT_READY),
      "POST /taxpayers/:id/establishments": () => {
        state.establishments = [ESTABLISHMENT];
        return json(201, ESTABLISHMENT);
      },
      "GET /emission-points": () => json(200, state.points),
      "POST /emission-points": () => {
        state.points = [POINT];
        return json(201, POINT);
      },
      "PUT /emission-points/:id/sequence": () => json(200, { emissionPointId: POINT.id, environment: "1", documentType: "01", nextValue: 124 }),
    });
    renderWithTenant(<EmisorPage />);
    await screen.findByLabelText("RUC");

    await fillTaxpayer("1790012345001");
    await userEvent.type(screen.getByLabelText("Nombre comercial"), "Andina");
    await userEvent.click(screen.getByRole("button", { name: "Registrar emisor" }));

    expect(await screen.findByText("Comercial Andina S.A.")).toBeInTheDocument();
    expect(api.to("POST", "/taxpayers")[0]?.body).toEqual({
      ruc: "1790012345001",
      legalName: "Comercial Andina S.A.",
      tradeName: "Andina",
      headOfficeAddress: "Av. Amazonas N34-12, Quito",
      phone: null,
      defaultEnvironment: "1",
      accountingRequired: false,
      specialTaxpayerCode: null,
      withholdingAgentCode: null,
      rimpeRegime: "NONE",
    });

    await userEvent.type(await screen.findByLabelText("Código del establecimiento"), "001");
    await userEvent.type(screen.getByLabelText("Dirección del establecimiento"), "Av. 10 de Agosto, Quito");
    await userEvent.click(screen.getByRole("button", { name: "Añadir establecimiento" }));

    const block = await screen.findByRole("region", { name: "Establecimiento 001" });
    expect(api.to("POST", `/taxpayers/${TAXPAYER.id}/establishments`)[0]?.body).toEqual({ code: "001", address: "Av. 10 de Agosto, Quito" });

    await userEvent.type(within(block).getByLabelText(/Código del nuevo punto de emisión/), "002");
    await userEvent.click(within(block).getByRole("button", { name: "Añadir punto de emisión" }));

    expect(await within(block).findByText("001-002")).toBeInTheDocument();
    expect(api.to("POST", "/emission-points")[0]?.body).toEqual({ establishmentId: ESTABLISHMENT.id, code: "002" });
    expect(api.to("GET", "/emission-points")[0]?.query.get("establishmentId")).toBe(ESTABLISHMENT.id);

    await userEvent.type(within(block).getByLabelText("Próximo secuencial de 001-002"), "124");
    await userEvent.click(within(block).getByRole("button", { name: "Fijar" }));

    expect(await within(block).findByText(/La próxima factura será la 124/)).toBeInTheDocument();
    expect(api.to("PUT", `/emission-points/${POINT.id}/sequence`)[0]?.body).toEqual({ environment: "1", documentType: "01", nextValue: 124 });
  });

  it("sends the phone typed at registration", async () => {
    const api = stubApi({
      "GET /taxpayers": () => json(200, []),
      "POST /taxpayers": () => json(201, TAXPAYER),
    });
    renderWithTenant(<EmisorPage />);
    await screen.findByLabelText("RUC");

    await fillTaxpayer("1790012345001");
    await userEvent.type(screen.getByLabelText("Teléfono"), " 02 256 9442 ");
    await userEvent.click(screen.getByRole("button", { name: "Registrar emisor" }));

    await waitFor(() => expect(api.to("POST", "/taxpayers")).toHaveLength(1));
    expect(api.to("POST", "/taxpayers")[0]?.body).toMatchObject({ phone: "02 256 9442" });
  });

  it("changes the phone of a registered taxpayer", async () => {
    let current: unknown = { ...TAXPAYER, phone: "022569442" };
    const api = issuerApi(() => NOT_READY, {
      "GET /taxpayers": () => json(200, [current]),
      "PATCH /taxpayers/:id": () => {
        current = { ...TAXPAYER, phone: "+593 2 256 9442" };
        return json(200, current);
      },
    });
    renderWithTenant(<EmisorPage />);

    const phone = await screen.findByLabelText("Teléfono del emisor");
    expect(phone).toHaveValue("022569442");
    await userEvent.clear(phone);
    await userEvent.type(phone, "+593 2 256 9442");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText(/Sale en los comprobantes que emita desde ahora/)).toBeInTheDocument();
    expect(api.to("PATCH", `/taxpayers/${TAXPAYER.id}`)[0]?.body).toEqual({ phone: "+593 2 256 9442" });
  });

  it("shows the server's rejection next to the form and keeps what was typed", async () => {
    stubApi({
      "GET /taxpayers": () => json(200, []),
      "POST /taxpayers": () => problem(409, "RUC_ALREADY_REGISTERED"),
    });
    renderWithTenant(<EmisorPage />);
    await screen.findByLabelText("RUC");

    await fillTaxpayer("1790012345001");
    await userEvent.click(screen.getByRole("button", { name: "Registrar emisor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese RUC ya está registrado en la plataforma.");
    expect(screen.getByLabelText("RUC")).toHaveValue("1790012345001");
    expect(screen.getByLabelText("Razón social")).toHaveValue("Comercial Andina S.A.");
  });

  it("puts the server's field errors on their fields", async () => {
    stubApi({
      "GET /taxpayers": () => json(200, []),
      "POST /taxpayers": () => problem(400, "VALIDATION_FAILED", undefined, [{ field: "legalName", message: "no puede tener más de 300 caracteres" }]),
    });
    renderWithTenant(<EmisorPage />);
    await screen.findByLabelText("RUC");

    await fillTaxpayer("1790012345001");
    await userEvent.click(screen.getByRole("button", { name: "Registrar emisor" }));

    await waitFor(() => expect(screen.getByLabelText("Razón social")).toHaveAccessibleDescription(/más de 300 caracteres/));
  });

  it("lets an auditor see the issuer but change nothing", async () => {
    stubApi({
      "GET /taxpayers": () => json(200, [TAXPAYER]),
      "GET /taxpayers/:id/establishments": () => json(200, [ESTABLISHMENT]),
      "GET /taxpayers/:id/production-readiness": () => json(200, NOT_READY),
      "GET /emission-points": () => json(200, [POINT]),
    });
    renderWithTenant(<EmisorPage />, { role: "AUDITOR" });

    expect(await screen.findByText("001-002")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Añadir establecimiento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Añadir punto de emisión" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fijar" })).not.toBeInTheDocument();
  });

  it("registers a new issuer in the test environment, without offering production", async () => {
    stubApi({ "GET /taxpayers": () => json(200, []) });
    renderWithTenant(<EmisorPage />);
    await screen.findByLabelText("RUC");

    expect(screen.queryByLabelText("Ambiente")).not.toBeInTheDocument();
    expect(screen.getByText(/empieza en el ambiente de pruebas/)).toBeInTheDocument();
  });

  it("tells the owner what is still missing to move to production", async () => {
    issuerApi(() => NOT_READY);
    renderWithTenant(<EmisorPage />);

    const step = await screen.findByRole("region", { name: "Paso a producción" });
    expect(await within(step).findByText(/Certificado de firma vigente/)).toHaveTextContent("Pendiente");
    expect(within(step).getByText(/autorizado por el SRI en pruebas/)).toHaveTextContent("Pendiente");
    // El botón está, pero no se puede usar, y se dice por qué.
    expect(within(step).getByRole("button", { name: "Activar producción" })).toBeDisabled();
    expect(within(step).getByText(/Complete los requisitos pendientes/)).toBeInTheDocument();
  });

  it("activates production once the requirements are met and the owner declares it", async () => {
    let readiness: unknown = READY;
    let taxpayer: unknown = TAXPAYER;
    const api = stubApi({
      "GET /taxpayers": () => json(200, [taxpayer]),
      "GET /taxpayers/:id/establishments": () => json(200, []),
      "GET /taxpayers/:id/production-readiness": () => json(200, readiness),
      "POST /taxpayers/:id/production-activation": () => {
        readiness = { ...READY, activatedAt: "2026-10-14T15:00:00Z" };
        taxpayer = { ...TAXPAYER, defaultEnvironment: "2", productionEnabledAt: "2026-10-14T15:00:00Z" };
        return json(200, readiness);
      },
    });
    renderWithTenant(<EmisorPage />);
    const step = await screen.findByRole("region", { name: "Paso a producción" });
    expect(await within(step).findByText(/Certificado de firma vigente/)).toHaveTextContent("Cumplido");
    expect(within(step).getByText(/autorizado por el SRI en pruebas/)).toHaveTextContent("Cumplido");
    const button = within(step).getByRole("button", { name: "Activar producción" });
    expect(button).toBeDisabled();

    await userEvent.click(within(step).getByLabelText(/Declaro que el SRI habilitó este RUC/));
    await userEvent.click(button);

    expect(await screen.findByText(/En producción desde/)).toBeInTheDocument();
    expect(api.to("POST", `/taxpayers/${TAXPAYER.id}/production-activation`)[0]?.body).toEqual({ sriProductionAuthorized: true });
    // El ambiente del emisor se vuelve a leer.
    await waitFor(() => expect(screen.getByText("Producción")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Activar producción" })).not.toBeInTheDocument();
  });

  it("shows the server's refusal to activate", async () => {
    issuerApi(() => READY, {
      "POST /taxpayers/:id/production-activation": () =>
        problem(422, "PRODUCTION_REQUIREMENTS_NOT_MET", undefined, [{ field: "certificate", message: "El emisor no tiene un certificado de firma vigente" }]),
    });
    renderWithTenant(<EmisorPage />);
    const step = await screen.findByRole("region", { name: "Paso a producción" });
    await userEvent.click(await within(step).findByLabelText(/Declaro que el SRI habilitó este RUC/));
    await userEvent.click(within(step).getByRole("button", { name: "Activar producción" }));

    expect(await within(step).findByRole("alert")).toHaveTextContent("El emisor todavía no cumple los requisitos para pasar a producción.");
  });

  it("warns when the issuer is in production but the platform is not transmitting yet", async () => {
    issuerApi(() => ({ ...READY, transmissionOpen: false, activatedAt: "2026-10-14T15:00:00Z" }));
    renderWithTenant(<EmisorPage />);

    const step = await screen.findByRole("region", { name: "Paso a producción" });
    expect(await within(step).findByText(/aún no transmite al SRI de producción/)).toBeInTheDocument();
  });

  it("lets only the owner activate production", async () => {
    issuerApi(() => READY);
    renderWithTenant(<EmisorPage />, { role: "ADMIN" });

    const step = await screen.findByRole("region", { name: "Paso a producción" });
    expect(await within(step).findByText(/Solo el propietario de la empresa puede activar/)).toBeInTheDocument();
    expect(within(step).queryByRole("button", { name: "Activar producción" })).not.toBeInTheDocument();
  });

  it("asks for a tenant when none is active", () => {
    stubApi({ "GET /taxpayers": () => json(200, []) });
    renderWithTenant(<EmisorPage />, { active: false });

    expect(screen.getByRole("link", { name: "elija o cree una empresa" })).toHaveAttribute("href", "/settings/companies");
  });
});
