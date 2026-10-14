import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { availableArtifacts, canReissue, canRetry, describeState, KNOWN_STATES } from "./documentStates";

/** Los valores del enum DocumentState, leídos del contrato tal como está escrito. */
function contractStates(): string[] {
  const contract = readFileSync(path.resolve(__dirname, "../../contracts/openapi.yaml"), "utf8");
  const section = contract.slice(contract.indexOf("    DocumentState:"));
  const match = /enum: \[([^\]]+)\]/.exec(section);
  if (!match?.[1]) {
    throw new Error("No se encontró el enum DocumentState en el contrato");
  }
  return match[1].split(",").map((value) => value.trim());
}

describe("document states", () => {
  it("describes every state of the contract, and no other", () => {
    const states = contractStates();

    expect(states.length).toBeGreaterThanOrEqual(10);
    expect([...KNOWN_STATES].sort()).toEqual([...states].sort());
    for (const state of states) {
      const info = describeState(state);
      expect(info.label, state).not.toBe(state);
      expect(info.help.length, state).toBeGreaterThan(20);
    }
  });

  it("explains that signed is waiting for transmission and received is not authorized", () => {
    expect(describeState("SIGNED").help).toMatch(/a la espera de transmitirse al SRI/);
    expect(describeState("SIGNED").final).toBe(false);
    expect(describeState("RECEIVED").help).toMatch(/Recibida no es autorizada/);
    expect(describeState("AUTHORIZED").tone).toBe("success");
    expect(describeState("AUTHORIZED").final).toBe(true);
  });

  it("does not break on a state it does not know", () => {
    const info = describeState("ANNULLED");

    expect(info.label).toBe("ANNULLED");
    expect(info.final).toBe(true);
  });

  it("offers a retry only where the API accepts it", () => {
    for (const state of ["RESERVED", "GENERATED", "SIGNATURE_FAILED", "SIGNED", "SENDING", "RECEIVED"]) {
      expect(canRetry(state), state).toBe(true);
    }
    for (const state of ["AUTHORIZED", "RETURNED", "NOT_AUTHORIZED", "XSD_INVALID", "ANNULLED"]) {
      expect(canRetry(state), state).toBe(false);
    }
  });

  it("offers to issue again every failed document that has no other way out", () => {
    for (const state of ["RETURNED", "NOT_AUTHORIZED", "XSD_INVALID"]) {
      expect(canReissue(state), state).toBe(true);
      expect(canRetry(state), state).toBe(false);
    }
    for (const state of ["RESERVED", "SIGNATURE_FAILED", "SIGNED", "RECEIVED", "AUTHORIZED", "ANNULLED"]) {
      expect(canReissue(state), state).toBe(false);
    }
  });

  it("lists only the files a document in that state already has", () => {
    const kinds = (state: string) => availableArtifacts(state).map((artifact) => artifact.kind);

    expect(kinds("RESERVED")).toEqual([]);
    expect(kinds("XSD_INVALID")).toEqual([]);
    expect(kinds("SIGNATURE_FAILED")).toEqual(["xml-unsigned"]);
    expect(kinds("RECEIVED")).toEqual(["xml-signed", "xml-unsigned"]);
    expect(kinds("RETURNED")).toEqual(["xml-signed", "xml-unsigned"]);
    expect(kinds("AUTHORIZED")).toEqual(["ride", "xml-authorized", "xml-signed", "sri-authorization", "xml-unsigned"]);
  });
});
