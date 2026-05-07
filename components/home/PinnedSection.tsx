"use client";

import Link from "next/link";
import { Pin, PlusCircle } from "lucide-react";
import CollapsibleCard from "./CollapsibleCard";
import PinnedIllustration from "./PinnedIllustration";
import AvailablePill from "@/components/budget/AvailablePill";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { categoryAvailable, ccPaymentRouting, monthKeyOf } from "@/lib/budget";

export default function PinnedSection() {
  const { groups, transactions, assignments, accounts, pinnedCategoryIds } =
    useHorizonStore();
  const now = new Date();
  const currentMonthKey = monthKeyOf(now.getFullYear(), now.getMonth());
  const ccCtx = ccPaymentRouting(accounts, groups);

  const pinned = groups
    .flatMap((g) => g.categories)
    .filter((c) => pinnedCategoryIds.includes(c.id));

  if (pinned.length === 0) {
    return (
      <CollapsibleCard title="Pinned">
        <div className="flex flex-col items-center gap-3 text-center">
          <PinnedIllustration />
          <h3 className="text-lg font-bold">Pin your go-to categories</h3>
          <p className="text-sm text-fg/70">
            See frequently used category balances at a glance.
          </p>
          <Link
            href="/budget"
            className="mt-2 flex items-center gap-2 text-accent text-base font-bold"
          >
            <PlusCircle size={22} />
            Add Pinned Categories
          </Link>
        </div>
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard title="Pinned">
      <ul className="flex flex-col gap-2">
        {pinned.map((cat) => (
          <li
            key={cat.id}
            className="flex items-center gap-3 rounded-2xl bg-card-elevated px-4 py-3"
          >
            <Pin
              size={16}
              strokeWidth={2}
              fill="currentColor"
              className="text-mint shrink-0"
            />
            <span className="flex-1 text-base font-semibold">
              {cat.emoji && (
                <span aria-hidden className="mr-1.5">
                  {cat.emoji}
                </span>
              )}
              {cat.name}
            </span>
            <AvailablePill
              amount={categoryAvailable(
                cat,
                assignments,
                transactions,
                currentMonthKey,
                ccCtx,
              )}
            />
          </li>
        ))}
      </ul>
    </CollapsibleCard>
  );
}
