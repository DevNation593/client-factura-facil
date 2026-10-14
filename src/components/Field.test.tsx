import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from "./Field";

describe("Field", () => {
  it("links the label, the hint and the error to the control", () => {
    render(
      <Field label="RUC" hint="Trece dígitos." error="Debe terminar en 001.">
        <input defaultValue="123" />
      </Field>,
    );

    const input = screen.getByLabelText("RUC");
    expect(input).toHaveValue("123");
    expect(input).toHaveAccessibleDescription("Trece dígitos. Debe terminar en 001.");
    expect(input).toBeInvalid();
  });

  it("is not invalid without an error", () => {
    render(
      <Field label="Nombre">
        <input />
      </Field>,
    );

    expect(screen.getByLabelText("Nombre")).toBeValid();
    expect(screen.getByLabelText("Nombre")).not.toHaveAttribute("aria-describedby");
  });
});
