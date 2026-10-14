import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { json, problem, stubApi } from "@/test/api";
import { renderWithTenant } from "@/test/render";

import IntegracionesPage from "./page";

const ERP = {
  id: "11111111-1111-4111-8111-111111111111",
  url: "https://erp.example.com/avisos?ficha=abc",
  eventTypes: ["document.authorized", "document.rejected"],
  description: "ERP de contabilidad",
  status: "ACTIVE",
  disabledReason: null,
  consecutiveFailures: 0,
  createdAt: "2026-10-01T15:00:00Z",
  previousSecretExpiresAt: null,
};
const BROKEN = {
  ...ERP,
  id: "22222222-2222-4222-8222-222222222222",
  url: "https://tienda.example.com/hook",
  description: null,
  status: "DISABLED",
  disabledReason: "TOO_MANY_FAILURES",
  consecutiveFailures: 100,
};
const SENT = {
  id: "33333333-3333-4333-8333-333333333333",
  eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  eventType: "document.authorized",
  documentId: "55555555-5555-4555-8555-555555555555",
  status: "SENT",
  attemptCount: 1,
  lastStatus: 200,
  lastError: null,
  occurredAt: "2026-10-10T15:00:00Z",
  sentAt: "2026-10-10T15:00:02Z",
  nextAttemptAt: null,
};
const FAILED = {
  ...SENT,
  id: "44444444-4444-4444-8444-444444444444",
  eventType: "document.rejected",
  status: "FAILED",
  attemptCount: 10,
  lastStatus: 500,
  lastError: "El receptor respondió 500",
  sentAt: null,
};

const NO_CONTENT = () => new Response(null, { status: 204 });
const ACCEPTED = () => new Response(null, { status: 202 });

type Routes = Parameters<typeof stubApi>[0];

function integrations(extra: Routes = {}, subscriptions: unknown[] = [ERP, BROKEN]) {
  return stubApi({
    "GET /webhooks/subscriptions": () => json(200, subscriptions),
    ...extra,
  });
}

describe("Integraciones", () => {
  it("lists the registered addresses with what they are told and how they are doing", async () => {
    integrations();
    renderWithTenant(<IntegracionesPage />);

    const table = await screen.findByRole("table", { name: "Direcciones registradas" });
    const erp = within(table).getByText("https://erp.example.com/avisos?ficha=abc", { selector: "span.break" }).closest("tr") as HTMLElement;
    expect(within(erp).getByText("ERP de contabilidad")).toBeInTheDocument();
    expect(within(erp).getByText("El SRI lo autorizó")).toBeInTheDocument();
    expect(within(erp).getByText("El SRI lo devolvió o no lo autorizó")).toBeInTheDocument();
    expect(within(erp).getByText("Activa")).toBeInTheDocument();
    const broken = within(table).getByText("https://tienda.example.com/hook", { selector: "span.break" }).closest("tr") as HTMLElement;
    // Una que se apagó sola lo dice, y por qué.
    expect(within(broken).getByText(/Se apagó sola/)).toBeInTheDocument();
    expect(within(broken).getByText(/100 intentos/)).toBeInTheDocument();
  });

  it("says so when nothing is registered yet", async () => {
    integrations({}, []);
    renderWithTenant(<IntegracionesPage />);

    expect(await screen.findByText(/Todavía no hay direcciones registradas/)).toBeInTheDocument();
  });

  it("registers an address and shows its secret once", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const api = integrations(
      {
        "POST /webhooks/subscriptions": () =>
          json(201, { ...ERP, id: "66666666-6666-4666-8666-666666666666", url: "https://nuevo.example.com/x", secret: "whsec_c2VjcmV0by1kZS1wcnVlYmE=" }),
      },
      [],
    );
    renderWithTenant(<IntegracionesPage />);
    await screen.findByText(/Todavía no hay direcciones registradas/);

    await userEvent.type(screen.getByLabelText("Dirección de su sistema"), " https://nuevo.example.com/x ");
    await userEvent.click(screen.getByLabelText(/El SRI lo autorizó/));
    await userEvent.click(screen.getByLabelText(/Se envió por correo/));
    await userEvent.type(screen.getByLabelText(/Descripción/), "Tienda");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    const secret = await screen.findByLabelText("Secreto de firma");
    expect(secret).toHaveValue("whsec_c2VjcmV0by1kZS1wcnVlYmE=");
    expect(screen.getByText(/no se volverá a mostrar/)).toBeInTheDocument();
    expect(api.to("POST", "/webhooks/subscriptions")[0]?.body).toEqual({
      url: "https://nuevo.example.com/x",
      eventTypes: ["document.authorized", "document.delivered"],
      description: "Tienda",
    });
    await userEvent.click(screen.getByRole("button", { name: "Copiar secreto" }));
    expect(writeText).toHaveBeenCalledWith("whsec_c2VjcmV0by1kZS1wcnVlYmE=");
    // La lista se vuelve a leer, y el formulario queda limpio para otra.
    expect(api.to("GET", "/webhooks/subscriptions")).toHaveLength(2);
    expect(screen.getByLabelText("Dirección de su sistema")).toHaveValue("");
  });

  it("does not register an address without any event chosen", async () => {
    const api = integrations({}, []);
    renderWithTenant(<IntegracionesPage />);
    await screen.findByText(/Todavía no hay direcciones registradas/);

    await userEvent.type(screen.getByLabelText("Dirección de su sistema"), "https://nuevo.example.com/x");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(await screen.findByText(/Elija al menos un aviso/)).toBeInTheDocument();
    expect(api.to("POST", "/webhooks/subscriptions")).toHaveLength(0);
  });

  it("shows in plain words why the API refused an address", async () => {
    integrations(
      {
        "POST /webhooks/subscriptions": () =>
          problem(422, "WEBHOOK_URL_NOT_ALLOWED", "La dirección debe ser de un servidor público de internet, no de una red local o privada"),
      },
      [],
    );
    renderWithTenant(<IntegracionesPage />);
    await screen.findByText(/Todavía no hay direcciones registradas/);

    await userEvent.type(screen.getByLabelText("Dirección de su sistema"), "https://10.0.0.1/x");
    await userEvent.click(screen.getByLabelText(/El SRI lo autorizó/));
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(await screen.findByText(/servidor público de internet/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Secreto de firma")).not.toBeInTheDocument();
  });

  it("explains when the installation has notifications switched off or the limit is reached", async () => {
    const replies = [problem(409, "WEBHOOKS_DISABLED"), problem(409, "WEBHOOK_LIMIT_REACHED")];
    integrations({ "POST /webhooks/subscriptions": () => replies.shift() as Response }, []);
    renderWithTenant(<IntegracionesPage />);
    await screen.findByText(/Todavía no hay direcciones registradas/);
    await userEvent.type(screen.getByLabelText("Dirección de su sistema"), "https://nuevo.example.com/x");
    await userEvent.click(screen.getByLabelText(/El SRI lo autorizó/));

    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(await screen.findByText(/no están habilitados en esta instalación/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(await screen.findByText(/máximo de direcciones/)).toBeInTheDocument();
  });

  it("switches an address off, after warning what is lost, and on again", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const api = integrations({ "PUT /webhooks/subscriptions/:id": (call) => json(200, { ...ERP, ...(call.body as object) }) });
    renderWithTenant(<IntegracionesPage />);
    await screen.findByRole("table", { name: "Direcciones registradas" });

    await userEvent.click(screen.getByRole("button", { name: "Apagar https://erp.example.com/avisos?ficha=abc" }));
    // Apagar no es una pausa: lo pendiente no sale y lo que pase mientras tanto no se avisa después.
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/pendientes.*no se avisará/s));
    expect(api.to("PUT", `/webhooks/subscriptions/${ERP.id}`)).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Apagar https://erp.example.com/avisos?ficha=abc" }));
    await waitFor(() => expect(api.to("PUT", `/webhooks/subscriptions/${ERP.id}`)).toHaveLength(1));
    expect(api.to("PUT", `/webhooks/subscriptions/${ERP.id}`)[0]?.body).toEqual({
      url: ERP.url,
      eventTypes: ERP.eventTypes,
      description: ERP.description,
      enabled: false,
    });

    confirm.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Encender https://tienda.example.com/hook" }));
    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(api.to("PUT", `/webhooks/subscriptions/${BROKEN.id}`)).toHaveLength(1));
    expect(api.to("PUT", `/webhooks/subscriptions/${BROKEN.id}`)[0]?.body).toMatchObject({ enabled: true });
  });

  it("changes the secret only after confirming, and shows the new one once", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const api = integrations({
      "POST /webhooks/subscriptions/:id/secret": () => json(200, { secret: "whsec_bnVldm8=", previousSecretExpiresAt: "2026-10-13T15:00:00Z" }),
    });
    renderWithTenant(<IntegracionesPage />);
    await screen.findByRole("table", { name: "Direcciones registradas" });
    const rotate = screen.getByRole("button", { name: "Cambiar el secreto de https://erp.example.com/avisos?ficha=abc" });

    await userEvent.click(rotate);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("24 horas"));
    expect(api.to("POST", `/webhooks/subscriptions/${ERP.id}/secret`)).toHaveLength(0);

    await userEvent.click(rotate);
    expect(await screen.findByLabelText("Secreto de firma")).toHaveValue("whsec_bnVldm8=");
    expect(screen.getByText(/El secreto anterior sigue valiendo hasta/)).toBeInTheDocument();
  });

  it("deletes an address only after confirming", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const api = integrations({ "DELETE /webhooks/subscriptions/:id": NO_CONTENT });
    renderWithTenant(<IntegracionesPage />);
    await screen.findByRole("table", { name: "Direcciones registradas" });
    const remove = screen.getByRole("button", { name: "Borrar https://tienda.example.com/hook" });

    await userEvent.click(remove);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("historial"));
    expect(api.to("DELETE", `/webhooks/subscriptions/${BROKEN.id}`)).toHaveLength(0);

    await userEvent.click(remove);
    await waitFor(() => expect(api.to("DELETE", `/webhooks/subscriptions/${BROKEN.id}`)).toHaveLength(1));
    await waitFor(() => expect(api.to("GET", "/webhooks/subscriptions")).toHaveLength(2));
  });

  it("shows what was sent to an address and lets a failed notification be sent again", async () => {
    const api = integrations({
      "GET /webhooks/subscriptions/:id/deliveries": () => json(200, { items: [FAILED, SENT], page: 0, size: 20, total: 37 }),
      "POST /webhooks/deliveries/:id/retry": ACCEPTED,
    });
    renderWithTenant(<IntegracionesPage />);
    await screen.findByRole("table", { name: "Direcciones registradas" });

    await userEvent.click(screen.getByRole("button", { name: "Ver avisos de https://erp.example.com/avisos?ficha=abc" }));

    const history = await screen.findByRole("table", { name: /Avisos enviados a/ });
    const failed = within(history).getByText("Falló").closest("tr") as HTMLElement;
    expect(within(failed).getByText(/El receptor respondió 500/)).toBeInTheDocument();
    expect(within(failed).getByText("10")).toBeInTheDocument();
    expect(within(failed).getByRole("link", { name: /Ver comprobante/ })).toHaveAttribute("href", `/documentos/${FAILED.documentId}`);
    const sent = within(history).getByText("Entregado").closest("tr") as HTMLElement;
    expect(within(sent).queryByRole("button", { name: /Reintentar/ })).not.toBeInTheDocument();
    expect(screen.getByText(/20 más recientes de 37/)).toBeInTheDocument();
    expect(api.to("GET", `/webhooks/subscriptions/${ERP.id}/deliveries`)).toHaveLength(1);

    await userEvent.click(within(failed).getByRole("button", { name: /Reintentar/ }));

    await waitFor(() => expect(api.to("POST", `/webhooks/deliveries/${FAILED.id}/retry`)).toHaveLength(1));
    // El historial se vuelve a leer para mostrar que quedó pendiente.
    await waitFor(() => expect(api.to("GET", `/webhooks/subscriptions/${ERP.id}/deliveries`)).toHaveLength(2));
  });

  it("sends a test notification to an active address and opens its history", async () => {
    const TEST = { ...SENT, id: "66666666-6666-4666-8666-666666666666", eventType: "webhook.test", documentId: null, status: "PENDING", attemptCount: 0, sentAt: null };
    const api = integrations({
      "POST /webhooks/subscriptions/:id/test": () => json(202, TEST),
      "GET /webhooks/subscriptions/:id/deliveries": () => json(200, { items: [TEST], page: 0, size: 20, total: 1 }),
    });
    renderWithTenant(<IntegracionesPage />);
    await screen.findByRole("table", { name: "Direcciones registradas" });
    // Una dirección apagada no se prueba.
    expect(screen.queryByRole("button", { name: `Enviar aviso de prueba a ${BROKEN.url}` })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: `Enviar aviso de prueba a ${ERP.url}` }));

    await waitFor(() => expect(api.to("POST", `/webhooks/subscriptions/${ERP.id}/test`)).toHaveLength(1));
    expect(await screen.findByText(/Aviso de prueba en camino/)).toBeInTheDocument();
    const history = await screen.findByRole("table", { name: /Avisos enviados a/ });
    const row = within(history).getByText("Aviso de prueba").closest("tr") as HTMLElement;
    expect(within(row).getByText("Pendiente")).toBeInTheDocument();
    // No hay comprobante al que ir, ni se reintenta: se envía otro.
    expect(within(row).queryByRole("link", { name: /Ver comprobante/ })).not.toBeInTheDocument();
  });

  it("does not offer to retry a failed test notification, and explains when one is already on its way", async () => {
    const TEST = { ...FAILED, id: "77777777-7777-4777-8777-777777777777", eventType: "webhook.test", documentId: null, attemptCount: 1 };
    integrations({
      "POST /webhooks/subscriptions/:id/test": () => problem(409, "WEBHOOK_TEST_PENDING"),
      "GET /webhooks/subscriptions/:id/deliveries": () => json(200, { items: [TEST], page: 0, size: 20, total: 1 }),
    });
    renderWithTenant(<IntegracionesPage />);
    await screen.findByRole("table", { name: "Direcciones registradas" });

    await userEvent.click(screen.getByRole("button", { name: `Ver avisos de ${ERP.url}` }));
    const history = await screen.findByRole("table", { name: /Avisos enviados a/ });
    const row = within(history).getByText("Aviso de prueba").closest("tr") as HTMLElement;
    expect(within(row).getByText("Falló")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /Reintentar/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: `Enviar aviso de prueba a ${ERP.url}` }));

    expect(await screen.findByText(/Ya hay un aviso de prueba en camino/)).toBeInTheDocument();
  });

  it("reads the history again when it is asked for while open", async () => {
    const api = integrations({
      "GET /webhooks/subscriptions/:id/deliveries": () => json(200, { items: [SENT], page: 0, size: 20, total: 1 }),
    });
    renderWithTenant(<IntegracionesPage />);
    await screen.findByRole("table", { name: "Direcciones registradas" });
    const show = screen.getByRole("button", { name: `Ver avisos de ${ERP.url}` });

    await userEvent.click(show);
    await screen.findByRole("table", { name: /Avisos enviados a/ });
    await userEvent.click(show);

    await waitFor(() => expect(api.to("GET", `/webhooks/subscriptions/${ERP.id}/deliveries`)).toHaveLength(2));
  });

  it("explains how to check that a notification is genuine", async () => {
    integrations();
    renderWithTenant(<IntegracionesPage />);
    await screen.findByRole("table", { name: "Direcciones registradas" });

    expect(screen.getAllByText(/webhook-signature/).length).toBeGreaterThan(0);
    expect(screen.getByText(/HMAC-SHA256/)).toBeInTheDocument();
  });

  it("is not for roles that do not manage the company", () => {
    const api = integrations();
    renderWithTenant(<IntegracionesPage />, { role: "BILLER" });

    expect(screen.getByText(/Su rol en esta empresa no permite gestionar las integraciones/)).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });
});
