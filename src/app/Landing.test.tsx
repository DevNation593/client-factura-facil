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

  it("shows a sample invoice with a 49-digit access key", () => {
    render(<Landing />);

    const sample = screen.getByRole("figure", { name: "Factura de muestra autorizada por el SRI" });
    expect(within(sample).getByText(/^\d{49}$/)).toBeInTheDocument();
  });
});
