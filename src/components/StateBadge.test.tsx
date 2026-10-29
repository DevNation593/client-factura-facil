import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StateBadge } from "./StateBadge";

describe("StateBadge", () => {
  it("marks a state that changed while it was on screen, and only then", () => {
    const { rerender } = render(<StateBadge state="RECEIVED" />);
    expect(screen.getByText("Recibida por el SRI")).not.toHaveClass("state-changed");

    rerender(<StateBadge state="AUTHORIZED" />);
    expect(screen.getByText("Autorizada")).toHaveClass("state", "state-success", "state-changed");
  });

  it("does not mark a state that was already there", () => {
    render(<StateBadge state="AUTHORIZED" />);
    expect(screen.getByText("Autorizada")).not.toHaveClass("state-changed");
  });
});
