"use client";

import {
  Target,
  PieChart,
  Inbox,
  Banknote,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import CollapsibleCard from "./CollapsibleCard";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { trackingAccountNames } from "@/lib/accounts";
import {
  ccPaymentRouting,
  monthKeyOf,
  totalAssignedInMonth,
  totalSpentInMonth,
  totalUnderfundedForMonth,
} from "@/lib/budget";

type Tile = {
  title: string;
  amount: number;
  Icon: LucideIcon;
};

export default function SummarySection({ month }: { month: string }) {
  const { transactions, accounts, assignments, groups, targets } =
    useHorizonStore();
  const trackingNames = trackingAccountNames(accounts);
  const budgetTxs = transactions.filter((t) => !trackingNames.has(t.account));
  const ccCtx = ccPaymentRouting(accounts, groups);
  const now = new Date();
  const currentMonthKey = monthKeyOf(now.getFullYear(), now.getMonth());
  const assigned = totalAssignedInMonth(assignments, currentMonthKey);
  const spent = totalSpentInMonth(
    budgetTxs,
    now.getFullYear(),
    now.getMonth(),
  );
  const totalTargets = Object.values(targets).reduce(
    (sum, t) => sum + t.amount,
    0,
  );
  const underfunded = totalUnderfundedForMonth(
    groups,
    targets,
    assignments,
    transactions,
    currentMonthKey,
    ccCtx,
  );

  const tiles: Tile[] = [
    { title: "Total Targets", amount: totalTargets, Icon: Target },
    { title: "Underfunded", amount: underfunded, Icon: PieChart },
    { title: "Assigned", amount: assigned, Icon: Inbox },
    { title: "Spent", amount: spent, Icon: Banknote },
  ];

  return (
    <CollapsibleCard title={`${month} Summary`}>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ title, amount, Icon }) => (
          <button
            key={title}
            type="button"
            className="rounded-2xl bg-card-elevated p-4 text-left flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <Icon size={22} strokeWidth={2.2} className="text-accent" />
              <ChevronRight size={16} className="text-fg/55" />
            </div>
            <div>
              <p className="text-sm text-fg/70">{title}</p>
              <p className="text-2xl font-bold">{formatCurrency(amount)}</p>
            </div>
          </button>
        ))}
      </div>
    </CollapsibleCard>
  );
}
