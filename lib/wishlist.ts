export type WishlistPriority = "low" | "medium" | "high";

export type WishlistItem = {
  id: string;
  name: string;
  // Estimated cost in the active currency. Stored as positive magnitude;
  // signs aren't meaningful for a wish.
  cost: number;
  url?: string;
  notes?: string;
  priority: WishlistPriority;
  // Categorisation tie-in: when set, the item shows alongside its
  // category's savings activity in the future. Stored loose for now.
  categoryId?: string;
  // Set once the user marks the item bought; absence = still wanting.
  purchasedAt?: string; // ISO YYYY-MM-DD
  // Sort fallback when two items share priority.
  createdAt: string; // ISO YYYY-MM-DD
};

export const sampleWishlist: WishlistItem[] = [];

const priorityRank: Record<WishlistPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Sort active items by priority (high → low) then newest first.
export function sortActive(items: WishlistItem[]): WishlistItem[] {
  return items
    .filter((i) => !i.purchasedAt)
    .slice()
    .sort((a, b) => {
      const p = priorityRank[a.priority] - priorityRank[b.priority];
      if (p !== 0) return p;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
}

// Purchased items shown most-recently-bought first.
export function sortPurchased(items: WishlistItem[]): WishlistItem[] {
  return items
    .filter((i) => i.purchasedAt)
    .slice()
    .sort((a, b) =>
      (a.purchasedAt ?? "") < (b.purchasedAt ?? "") ? 1 : -1,
    );
}

export function totalCost(items: WishlistItem[]): number {
  return items.reduce((sum, i) => sum + (Number.isFinite(i.cost) ? i.cost : 0), 0);
}
