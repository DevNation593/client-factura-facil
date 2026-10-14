import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "./error";

describe("pantalla de error", () => {
  it("says in Spanish that the screen failed and lets the user try again", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={Object.assign(new Error("Cannot read properties of null"), { digest: "abc123" })} reset={reset} />);

    expect(screen.getByRole("heading", { name: "No se pudo mostrar esta pantalla" })).toBeInTheDocument();
    // El detalle técnico no se enseña al usuario; el código sí, para soporte.
    expect(screen.queryByText(/Cannot read properties/)).not.toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a los comprobantes" })).toHaveAttribute("href", "/documentos");

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("offers the saved drafts, where unsent work is", () => {
    render(<ErrorPage error={new Error("x")} reset={() => {}} />);

    expect(screen.getByRole("link", { name: "Ver borradores" })).toHaveAttribute("href", "/facturas/borradores");
  });
});
