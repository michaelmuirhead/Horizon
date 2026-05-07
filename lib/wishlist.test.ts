import { describe, expect, it } from "vitest";
import { sortActive, sortPurchased, totalCost, type WishlistItem } from "./wishlist";

const items: WishlistItem[] = [
  { id: "a", name: "Headphones", cost: 250, priority: "low", createdAt: "2026-04-01" },
  { id: "b", name: "Standing desk", cost: 600, priority: "high", createdAt: "2026-05-01" },
  { id: "c", name: "Coffee grinder", cost: 120, priority: "medium", createdAt: "2026-05-03" },
  {
    id: "d",
    name: "Already-bought lamp",
    cost: 80,
    priority: "high",
    createdAt: "2026-04-15",
    purchasedAt: "2026-04-20",
  },
];

describe("wishlist sorts", () => {
  it("sortActive ranks high → medium → low and ties break by newest first", () => {
    const out = sortActive(items).map((i) => i.id);
    expect(out).toEqual(["b", "c", "a"]);
  });

  it("sortActive omits purchased items", () => {
    const out = sortActive(items);
    expect(out.find((i) => i.id === "d")).toBeUndefined();
  });

  it("sortPurchased only returns purchased items, newest first", () => {
    const purchased = sortPurchased([
      ...items,
      {
        id: "e",
        name: "Older buy",
        cost: 30,
        priority: "low",
        createdAt: "2026-03-01",
        purchasedAt: "2026-03-10",
      },
    ]);
    expect(purchased.map((i) => i.id)).toEqual(["d", "e"]);
  });
});

describe("totalCost", () => {
  it("sums the cost of every supplied item", () => {
    expect(totalCost(items)).toBe(250 + 600 + 120 + 80);
  });

  it("ignores non-finite costs", () => {
    expect(
      totalCost([
        ...items,
        {
          id: "x",
          name: "Bad",
          cost: NaN,
          priority: "low",
          createdAt: "2026-05-04",
        },
      ]),
    ).toBe(250 + 600 + 120 + 80);
  });
});
