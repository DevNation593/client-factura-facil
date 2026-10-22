import { describe, expect, it } from "vitest";

import { signInPath } from "./sessionNavigation";

describe("signInPath", () => {
  it("remembers where the user was going, with its query", () => {
    expect(signInPath("/invitacion?codigo=abc")).toBe("/sign-in?volver=%2Finvitacion%3Fcodigo%3Dabc");
  });

  it("is the plain sign-in page when there is nowhere in particular to return to", () => {
    for (const value of [null, undefined, "", "/"]) {
      expect(signInPath(value)).toBe("/sign-in");
    }
  });
});
