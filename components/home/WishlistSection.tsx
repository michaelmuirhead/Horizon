"use client";

import Link from "next/link";
import { Heart, PlusCircle } from "lucide-react";
import CollapsibleCard from "./CollapsibleCard";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { sortActive, totalCost } from "@/lib/wishlist";
import { formatCurrency } from "@/lib/format";

const priorityDot: Record<string, string> = {
  high: "bg-rose-400",
  medium: "bg-amber-400",
  low: "bg-fg/30",
};

export default function WishlistSection() {
  const { wishlist } = useHorizonStore();
  const active = sortActive(wishlist);

  if (active.length === 0) {
    return (
      <CollapsibleCard title="Wishlist">
        <div className="flex flex-col items-center gap-2 text-center">
          <Heart size={28} className="text-fg/40" strokeWidth={1.6} />
          <p className="text-sm text-fg/70 px-2">
            Track things you&rsquo;re saving up for here.
          </p>
          <Link
            href="/wishlist"
            className="mt-1 inline-flex items-center gap-2 text-accent text-base font-bold"
          >
            <PlusCircle size={20} />
            Add a wish
          </Link>
        </div>
      </CollapsibleCard>
    );
  }

  const top = active.slice(0, 3);
  const remaining = totalCost(active);

  return (
    <CollapsibleCard
      title="Wishlist"
      headerRight={
        <span className="text-xs font-semibold text-fg/55 tabular-nums">
          {formatCurrency(remaining)}
        </span>
      }
    >
      <ul className="space-y-2">
        {top.map((item) => (
          <li key={item.id}>
            <Link
              href={`/wishlist/${item.id}`}
              className="flex items-center gap-3"
            >
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-full ${priorityDot[item.priority]}`}
              />
              <span className="flex-1 min-w-0 truncate text-sm font-semibold">
                {item.name}
              </span>
              <span className="text-sm font-bold tabular-nums text-fg/70 shrink-0">
                {formatCurrency(item.cost)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/wishlist"
        className="mt-3 block text-center text-xs font-bold text-accent"
      >
        See all{" "}
        {active.length > top.length
          ? `(${active.length})`
          : ""}
      </Link>
    </CollapsibleCard>
  );
}
