import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("tells a screen reader that the content is loading", () => {
    render(<Skeleton lines={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(screen.getByText("Cargando…").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
  });
});

describe("EmptyState", () => {
  it("says what is missing and offers how to start", () => {
    render(
      <EmptyState icon="users" action={<a href="/catalogs/customers#nuevo">Registrar cliente</a>}>
        Aún no hay clientes.
      </EmptyState>,
    );
    expect(screen.getByText("Aún no hay clientes.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Registrar cliente" })).toHaveAttribute("href", "/catalogs/customers#nuevo");
  });

  it("offers nothing when there is nothing to do", () => {
    render(<EmptyState icon="send">Este comprobante no se ha enviado por correo.</EmptyState>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
