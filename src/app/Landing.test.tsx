import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Landing } from "./Landing";

describe("Portada", () => {
  it("leads to creating an account and to signing in", () => {
    render(<Landing />);

    for (const link of screen.getAllByRole("link", { name: "Crear cuenta" })) {
      expect(link).toHaveAttribute("href", "/sign-up");
    }
    for (const link of screen.getAllByRole("link", { name: "Ingresar" })) {
      expect(link).toHaveAttribute("href", "/sign-in");
    }
  });

  it("walks through what happens after issuing, in order", () => {
    render(<Landing />);

    const steps = within(screen.getByRole("region", { name: "Qué pasa después de emitir" })).getAllByRole("listitem");
    expect(steps.map((step) => within(step).getByRole("heading").textContent)).toEqual([
      "Se numera",
      "Se firma",
      "Se envía al SRI",
      "Llega a su cliente",
      "Queda archivada",
    ]);
  });

  it("lists the monthly plans from cheapest to largest, each leading to sign-up", () => {
    render(<Landing />);

    const plans = within(screen.getByRole("region", { name: "Planes" })).getAllByRole("listitem", { name: /^Plan / });
    expect(plans.map((plan) => within(plan).getByRole("heading").textContent)).toEqual([
      "Gratis",
      "Emprendedor",
      "Pyme",
      "Empresa",
    ]);
    for (const plan of plans) {
      expect(within(plan).getByText((_, element) => /^\$\d+ al mes$/.test(element?.textContent ?? "") && element?.tagName === "P")).toBeInTheDocument();
      expect(within(plan).getByRole("link")).toHaveAttribute("href", "/sign-up");
    }
  });

  it("answers the usual questions before signing up", () => {
    render(<Landing />);

    const faq = screen.getByRole("region", { name: "Preguntas frecuentes" });
    expect(within(faq).getByText("¿Necesito firma electrónica?")).toBeInTheDocument();
    expect(within(faq).getByText("¿Puedo probar antes de pagar?")).toBeInTheDocument();
  });

  it("shows a sample invoice with a 49-digit access key", () => {
    render(<Landing />);

    const sample = screen.getByRole("figure", { name: "Factura de muestra autorizada por el SRI" });
    expect(within(sample).getByText(/^\d{49}$/)).toBeInTheDocument();
  });
});
