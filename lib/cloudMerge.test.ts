import { describe, expect, it } from "vitest";
import { mergePayloads } from "./cloudMerge";

describe("mergePayloads", () => {
  it("unions transactions by id, both sides' additions survive", () => {
    const local = {
      transactions: [
        { id: "a", amount: 1 },
        { id: "b", amount: 2 },
      ],
      lastModifiedAt: 100,
    };
    const remote = {
      transactions: [
        { id: "a", amount: 1 },
        { id: "c", amount: 3 },
      ],
      lastModifiedAt: 50,
    };
    const ids = mergePayloads(local, remote).transactions?.map((t) => t.id);
    expect(new Set(ids)).toEqual(new Set(["a", "b", "c"]));
  });

  it("prefers the newer side's row for shared ids", () => {
    const local = {
      transactions: [{ id: "a", amount: 1 }],
      lastModifiedAt: 50,
    };
    const remote = {
      transactions: [{ id: "a", amount: 2 }],
      lastModifiedAt: 100,
    };
    const merged = mergePayloads(local, remote).transactions;
    expect(merged).toEqual([{ id: "a", amount: 2 }]);
  });

  it("merges assignments per month and per category", () => {
    const local = {
      assignments: { "2026-05": { food: 100 } },
      lastModifiedAt: 100,
    };
    const remote = {
      assignments: { "2026-05": { gas: 50 }, "2026-06": { food: 80 } },
      lastModifiedAt: 50,
    };
    const out = mergePayloads(local, remote).assignments ?? {};
    expect(out["2026-05"]).toEqual({ food: 100, gas: 50 });
    expect(out["2026-06"]).toEqual({ food: 80 });
  });

  it("unions pinnedCategoryIds without duplicates", () => {
    const local = { pinnedCategoryIds: ["a", "b"], lastModifiedAt: 100 };
    const remote = { pinnedCategoryIds: ["b", "c"], lastModifiedAt: 100 };
    const out = mergePayloads(local, remote).pinnedCategoryIds ?? [];
    expect(new Set(out)).toEqual(new Set(["a", "b", "c"]));
  });

  it("settings are LWW by stamp", () => {
    const local = { settings: { currency: "USD" }, lastModifiedAt: 50 };
    const remote = { settings: { currency: "EUR" }, lastModifiedAt: 100 };
    expect(mergePayloads(local, remote).settings).toEqual({ currency: "EUR" });
  });

  it("merged stamp is the max of both sides", () => {
    expect(
      mergePayloads({ lastModifiedAt: 30 }, { lastModifiedAt: 70 })
        .lastModifiedAt,
    ).toBe(70);
  });

  it("groups: shared groups merge their inner categories", () => {
    const local = {
      groups: [
        {
          id: "g1",
          name: "Local Name",
          categories: [{ id: "c1", name: "Food" }],
        },
      ],
      lastModifiedAt: 100,
    };
    const remote = {
      groups: [
        {
          id: "g1",
          name: "Remote Name",
          categories: [{ id: "c2", name: "Gas" }],
        },
        {
          id: "g2",
          name: "Remote Only",
          categories: [],
        },
      ],
      lastModifiedAt: 50,
    };
    const merged = mergePayloads(local, remote).groups ?? [];
    const g1 = merged.find((g) => g.id === "g1");
    expect(g1?.name).toBe("Local Name"); // local is newer
    expect(new Set(g1?.categories?.map((c) => c.id))).toEqual(
      new Set(["c1", "c2"]),
    );
    expect(merged.find((g) => g.id === "g2")).toBeTruthy();
  });
});
