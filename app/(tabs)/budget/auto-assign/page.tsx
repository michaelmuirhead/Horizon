"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  FastForward,
  HeartHandshake,
  Target,
  RotateCcw,
  Eraser,
} from "lucide-react";
import Link from "next/link";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  categoryAvailable,
  categoryUnderfundedForMonth,
  ccPaymentRouting,
  getAssigned,
  monthKeyOf,
  readyToAssignAmount,
  shiftMonthKey,
} from "@/lib/budget";

export default function AutoAssignPage() {
  return (
    <Suspense fallback={null}>
      <AutoAssign />
    </Suspense>
  );
}

function AutoAssign() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    groups,
    targets,
    assignments,
    transactions,
    accounts,
    setAssignment,
  } = useHorizonStore();

  const now = new Date();
  const defaultMonthKey = monthKeyOf(now.getFullYear(), now.getMonth());
  const monthKey = searchParams.get("month") ?? defaultMonthKey;
  const ccCtx = ccPaymentRouting(accounts, groups);

  function fundAllTargets() {
    // Respect RTA: walk in budget order, fund each underfunded target only
    // up to what's actually available. Anything still short stays red.
    let remaining = readyToAssignAmount(transactions, assignments, groups, ccCtx);
    if (remaining <= 0) {
      router.push("/budget");
      return;
    }
    for (const g of groups) {
      for (const c of g.categories) {
        if (remaining <= 0) break;
        const target = targets[c.id];
        if (!target || target.paused) continue;
        const underfunded = categoryUnderfundedForMonth(
          c,
          target,
          assignments,
          transactions,
          monthKey,
          ccCtx,
        );
        if (underfunded <= 0) continue;
        const give = Math.min(remaining, underfunded);
        const current = getAssigned(assignments, monthKey, c.id);
        setAssignment(monthKey, c.id, current + give);
        remaining -= give;
      }
      if (remaining <= 0) break;
    }
    router.push("/budget");
  }

  function coverOverspending() {
    let remaining = readyToAssignAmount(transactions, assignments, groups, ccCtx);
    if (remaining <= 0) {
      router.push("/budget");
      return;
    }
    for (const g of groups) {
      for (const c of g.categories) {
        if (remaining <= 0) break;
        const av = categoryAvailable(
          c,
          assignments,
          transactions,
          monthKey,
          ccCtx,
        );
        if (av >= 0) continue;
        const deficit = -av;
        const give = Math.min(remaining, deficit);
        const current = getAssigned(assignments, monthKey, c.id);
        setAssignment(monthKey, c.id, current + give);
        remaining -= give;
      }
      if (remaining <= 0) break;
    }
    router.push("/budget");
  }

  function assignLastMonth() {
    const prev = shiftMonthKey(monthKey, -1);
    const prevMap = assignments[prev] ?? {};
    for (const [catId, amount] of Object.entries(prevMap)) {
      setAssignment(monthKey, catId, amount);
    }
    router.push("/budget");
  }

  function resetMonth() {
    const monthMap = assignments[monthKey] ?? {};
    const count = Object.keys(monthMap).length;
    if (count === 0) {
      router.push("/budget");
      return;
    }
    if (
      !window.confirm(
        `Clear all ${count} ${count === 1 ? "assignment" : "assignments"} in this month? This can't be undone.`,
      )
    ) {
      return;
    }
    for (const catId of Object.keys(monthMap)) {
      setAssignment(monthKey, catId, 0);
    }
    router.push("/budget");
  }

  const actions: {
    label: string;
    description: string;
    Icon: typeof Target;
    onClick: () => void;
  }[] = [
    {
      label: "Fund all targets",
      description:
        "Top up underfunded targets in budget order until Ready to Assign runs out.",
      Icon: Target,
      onClick: fundAllTargets,
    },
    {
      label: "Cover overspending",
      description:
        "Pull from Ready to Assign to zero out every red category in this month.",
      Icon: HeartHandshake,
      onClick: coverOverspending,
    },
    {
      label: "Assign last month's amount",
      description: "Copy each category's prior-month assignment into this month.",
      Icon: RotateCcw,
      onClick: assignLastMonth,
    },
    {
      label: "Reset this month",
      description: "Clear every assignment for this month.",
      Icon: Eraser,
      onClick: resetMonth,
    },
  ];

  return (
    <>
      <SubpageHeader title="Auto-Assign" backHref="/budget" />
      <div className="px-4 pt-4 pb-10">
        <ul className="flex flex-col gap-3">
          {actions.map(({ label, description, Icon, onClick }) => (
            <li key={label}>
              <button
                type="button"
                onClick={onClick}
                className="flex w-full items-center gap-4 rounded-2xl bg-card p-4 text-left"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <Icon size={20} strokeWidth={2.2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-bold">{label}</span>
                  <span className="mt-0.5 block text-xs text-fg/60">
                    {description}
                  </span>
                </span>
                <ChevronRight size={18} className="text-fg/55" />
              </button>
            </li>
          ))}
          <li>
            <Link
              href="/budget/fund-future"
              className="flex w-full items-center gap-4 rounded-2xl bg-card p-4 text-left"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                <FastForward size={20} strokeWidth={2.2} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-base font-bold">
                  Fund a future month
                </span>
                <span className="mt-0.5 block text-xs text-fg/60">
                  Add money to one category in a month ahead without leaving
                  this view.
                </span>
              </span>
              <ChevronRight size={18} className="text-fg/55" />
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
