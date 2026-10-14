import { describe, expect, it } from "vitest";

import { deleteDraft, findDraft, listDrafts, newDraft, saveDraft } from "./drafts";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

describe("drafts", () => {
  it("saves, lists and deletes drafts of a tenant", () => {
    const first = { ...newDraft(), customerName: "María Pérez" };
    const second = { ...newDraft(), customerName: "Juan Mora" };

    expect(saveDraft(TENANT_A, first)).toBe(true);
    expect(saveDraft(TENANT_A, second)).toBe(true);

    expect(listDrafts(TENANT_A).map((draft) => draft.customerName).sort()).toEqual(["Juan Mora", "María Pérez"]);
    expect(findDraft(TENANT_A, first.id)?.customerName).toBe("María Pérez");

    deleteDraft(TENANT_A, first.id);
    expect(listDrafts(TENANT_A).map((draft) => draft.id)).toEqual([second.id]);
  });

  it("replaces a draft when it is saved again", () => {
    const draft = newDraft();
    saveDraft(TENANT_A, draft);
    saveDraft(TENANT_A, { ...draft, customerName: "Cambiado" });

    expect(listDrafts(TENANT_A)).toHaveLength(1);
    expect(listDrafts(TENANT_A)[0]?.customerName).toBe("Cambiado");
  });

  it("keeps the drafts of one tenant invisible to another", () => {
    saveDraft(TENANT_A, newDraft());

    expect(listDrafts(TENANT_B)).toEqual([]);
    expect(listDrafts(TENANT_A)).toHaveLength(1);
  });

  it("ignores corrupt storage", () => {
    window.localStorage.setItem(`einvoice.borradores.${TENANT_A}`, "{esto no es json");
    expect(listDrafts(TENANT_A)).toEqual([]);

    window.localStorage.setItem(`einvoice.borradores.${TENANT_A}`, JSON.stringify([{ id: 1 }, "x", null, newDraft()]));
    expect(listDrafts(TENANT_A)).toHaveLength(1);

    window.localStorage.setItem(`einvoice.borradores.${TENANT_A}`, JSON.stringify({ not: "an array" }));
    expect(listDrafts(TENANT_A)).toEqual([]);
  });

  it("drops a stored draft whose lines, payments or date would break the screens", () => {
    const good = newDraft();
    saveDraft(TENANT_A, good);
    const stored = JSON.parse(window.localStorage.getItem(`einvoice.borradores.${TENANT_A}`) ?? "[]") as Record<string, unknown>[];
    const base = stored[0] as Record<string, unknown>;
    window.localStorage.setItem(
      `einvoice.borradores.${TENANT_A}`,
      JSON.stringify([
        base,
        { ...base, id: "a", lines: [null] },
        { ...base, id: "b", lines: [{ productId: 1, quantity: "1", unitPrice: "1", discount: "0" }] },
        { ...base, id: "c", payments: ["efectivo"] },
        { ...base, id: "d", updatedAt: "ayer" },
        { ...base, id: "e", customerId: 7 },
        { ...base, id: "f", replacesDocumentId: 9 },
      ]),
    );

    expect(listDrafts(TENANT_A).map((draft) => draft.id)).toEqual([good.id]);
  });

  it("refuses a new draft when there is no room, instead of silently dropping the oldest", () => {
    const first = newDraft();
    saveDraft(TENANT_A, first);
    for (let i = 1; i < 50; i++) {
      expect(saveDraft(TENANT_A, newDraft())).toBe(true);
    }

    expect(saveDraft(TENANT_A, newDraft())).toBe(false);

    const kept = listDrafts(TENANT_A);
    expect(kept).toHaveLength(50);
    expect(kept.some((draft) => draft.id === first.id)).toBe(true);
    // Los que ya existen se pueden seguir guardando, y al descartar uno vuelve a haber sitio.
    expect(saveDraft(TENANT_A, { ...first, customerName: "María Pérez" })).toBe(true);
    deleteDraft(TENANT_A, kept[0]!.id);
    expect(saveDraft(TENANT_A, newDraft())).toBe(true);
  });

  it("keeps its idempotency key for life", () => {
    const draft = newDraft();
    expect(draft.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft.idempotencyKey).not.toBe(draft.id);
    expect(newDraft().idempotencyKey).not.toBe(draft.idempotencyKey);

    saveDraft(TENANT_A, draft);
    saveDraft(TENANT_A, { ...findDraft(TENANT_A, draft.id)!, customerName: "Otro" });

    expect(findDraft(TENANT_A, draft.id)?.idempotencyKey).toBe(draft.idempotencyKey);
  });
});
