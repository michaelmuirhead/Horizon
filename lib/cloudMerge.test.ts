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

  it("tombstoned ids are filtered out across every id-keyed collection", () => {
    // Stale device still has T1 + cat-x cached; the other side
    // tombstoned both. Merge should drop them rather than resurrect.
    const local = {
      transactions: [
        { id: "T1", amount: 1 },
        { id: "T2", amount: 2 },
      ],
      groups: [
        {
          id: "g1",
          categories: [
            { id: "cat-x" },
            { id: "cat-y" },
          ],
        },
      ],
      lastModifiedAt: 100,
    };
    const remote = {
      transactions: [{ id: "T2", amount: 2 }],
      groups: [
        {
          id: "g1",
          categories: [{ id: "cat-y" }],
        },
      ],
      tombstones: { T1: 50, "cat-x": 60 },
      lastModifiedAt: 80,
    };
    const merged = mergePayloads(local, remote);
    expect(merged.transactions?.map((t) => t.id)).toEqual(["T2"]);
    const g1 = merged.groups?.find((g) => g.id === "g1");
    expect(g1?.categories?.map((c) => c.id)).toEqual(["cat-y"]);
    // Tombstones themselves are kept in the merged payload so they
    // continue to suppress future re-unions.
    expect(merged.tombstones).toEqual({ T1: 50, "cat-x": 60 });
  });

  it("merged tombstones keep the newer deletedAt for shared ids", () => {
    const local = { tombstones: { x: 100 } };
    const remote = { tombstones: { x: 50 } };
    expect(mergePayloads(local, remote).tombstones).toEqual({ x: 100 });
  });

  it("union still picks up the loser side's new ids (regression: cross-device clock skew)", () => {
    // Two phones in the same household. Wife edited May 2026 on her
    // phone with a clock running a few seconds behind. Husband's phone
    // has a newer lastModifiedAt (his clock is ahead) — so it wins the
    // LWW tiebreak. The merge MUST still pull in wife's new planner
    // entries; otherwise the live-subscribe path on his phone silently
    // drops her edits and his folder balance never updates.
    const local = {
      plannerEntries: [
        { id: "his-e1", budgetId: "may", amount: 100 },
      ],
      lastModifiedAt: 1735000005000, // his clock
    };
    const remote = {
      plannerEntries: [
        { id: "her-e1", budgetId: "may", amount: -200 },
        { id: "her-e2", budgetId: "may", amount: -75 },
      ],
      lastModifiedAt: 1735000000000, // her clock — 5 seconds behind
    };
    const merged = mergePayloads(local, remote);
    expect(merged.plannerEntries?.map((e) => e.id).sort()).toEqual(
      ["her-e1", "her-e2", "his-e1"].sort(),
    );
  });

  it("paycheckEntries union by id, paycheckHourlyRate follows the winner", () => {
    const local = {
      paycheckEntries: [
        { id: "p1", date: "2026-06-01", amount: 8 },
        { id: "p2", date: "2026-06-02", amount: 7 },
      ],
      paycheckHourlyRate: 25,
      lastModifiedAt: 100,
    };
    const remote = {
      paycheckEntries: [{ id: "p3", date: "2026-06-03", amount: 6 }],
      paycheckHourlyRate: 22,
      lastModifiedAt: 50,
    };
    const merged = mergePayloads(local, remote);
    expect(merged.paycheckEntries?.map((e) => e.id).sort()).toEqual([
      "p1",
      "p2",
      "p3",
    ]);
    // Local wins on stamp → local rate wins.
    expect(merged.paycheckHourlyRate).toBe(25);
  });

  it("paycheckHourlyRate falls back to whichever side has a value", () => {
    // Common case during the transition: cloud doc was written by an
    // older client that didn't carry the rate. Merge must still
    // surface the local rate so the next push includes it again.
    const localWins = mergePayloads(
      { paycheckHourlyRate: 25, lastModifiedAt: 100 },
      { lastModifiedAt: 50 },
    );
    expect(localWins.paycheckHourlyRate).toBe(25);
    const remoteWins = mergePayloads(
      { lastModifiedAt: 50 },
      { paycheckHourlyRate: 25, lastModifiedAt: 100 },
    );
    expect(remoteWins.paycheckHourlyRate).toBe(25);
  });
});
