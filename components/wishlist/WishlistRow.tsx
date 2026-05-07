"use client";

import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import type { WishlistItem, WishlistPriority } from "@/lib/wishlist";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import SwipeToDelete from "@/components/shared/SwipeToDelete";

const priorityClasses: Record<WishlistPriority, string> = {
  high: "bg-rose-900/40 text-rose-300",
  medium: "bg-amber-900/40 text-amber-300",
  low: "bg-card-elevated text-fg/60",
};

const priorityLabel: Record<WishlistPriority, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

export default function WishlistRow({ item }: { item: WishlistItem }) {
  const { deleteWishlistItem, updateWishlistItem, markUndoable } =
    useHorizonStore();
  const purchased = !!item.purchasedAt;

  function handleDelete() {
    markUndoable(`Wishlist item "${item.name}" deleted`);
    deleteWishlistItem(item.id);
  }

  function togglePurchased(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    updateWishlistItem({
      ...item,
      purchasedAt: purchased
        ? undefined
        : new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <SwipeToDelete
      onDelete={handleDelete}
      ariaLabel={`Delete wishlist item ${item.name}`}
    >
      <Link
        href={`/wishlist/${item.id}`}
        className="flex w-full items-center gap-3 bg-card px-4 py-3.5"
      >
        <button
          type="button"
          onClick={togglePurchased}
          aria-pressed={purchased}
          aria-label={purchased ? "Mark as wanted" : "Mark as purchased"}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
            purchased
              ? "border-emerald-500 bg-emerald-500 text-emerald-950"
              : "border-fg/30 bg-transparent"
          }`}
        >
          {purchased && <Check size={14} strokeWidth={3} />}
        </button>
        <div className="flex-1 min-w-0">
          <p
            className={`text-base font-semibold truncate ${
              purchased ? "line-through text-fg/45" : ""
            }`}
          >
            {item.name}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-fg/55">
            <span
              className={`inline-block rounded-md px-1.5 py-0.5 font-semibold ${priorityClasses[item.priority]}`}
            >
              {priorityLabel[item.priority]}
            </span>
            {item.url && (
              <ExternalLink size={11} className="text-fg/40 shrink-0" />
            )}
            {item.notes && <span className="truncate">{item.notes}</span>}
          </div>
        </div>
        <span
          className={`text-base font-bold tabular-nums shrink-0 ${
            purchased ? "text-fg/45" : "text-fg/85"
          }`}
        >
          {formatCurrency(item.cost)}
        </span>
      </Link>
    </SwipeToDelete>
  );
}
