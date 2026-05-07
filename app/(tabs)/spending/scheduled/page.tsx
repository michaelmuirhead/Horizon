"use client";

import Link from "next/link";
import { Plus, ChevronRight, PlayCircle } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  advanceDate,
  cadenceLabels,
  formatScheduledDate,
  todayIso,
} from "@/lib/scheduled";
import { formatCurrency } from "@/lib/format";

export default function ScheduledListPage() {
  const {
    scheduledTransactions,
    addTransaction,
    addTransfer,
    updateScheduled,
  } = useHorizonStore();

  function postNow(id: string) {
    const sched = scheduledTransactions.find((s) => s.id === id);
    if (!sched) return;
    if (sched.kind === "transfer") {
      addTransfer({
        date: sched.nextDate,
        fromAccount: sched.fromAccount,
        toAccount: sched.toAccount,
        amount: sched.amount,
        cleared: sched.cleared ?? false,
        memo: sched.memo,
      });
    } else {
      addTransaction({
        date: sched.nextDate,
        payee: sched.payee,
        category: sched.category,
        amount: sched.amount,
        account: sched.account,
        cleared: false,
        memo: sched.memo,
        isReadyToAssign: sched.isReadyToAssign,
      });
    }
    updateScheduled({
      ...sched,
      nextDate: advanceDate(sched.nextDate, sched.cadence),
    });
  }

  const today = todayIso();

  return (
    <>
      <SubpageHeader
        title="Scheduled"
        backHref="/spending"
        trailing={
          <Link
            href="/spending/scheduled/new"
            aria-label="Add Scheduled"
            className="grid h-10 w-10 place-items-center rounded-full bg-card-elevated"
          >
            <Plus size={20} strokeWidth={2.5} />
          </Link>
        }
      />

      {scheduledTransactions.length === 0 ? (
        <div className="px-4 py-12 text-center text-fg/60">
          No scheduled transactions yet. Tap{" "}
          <span className="font-bold text-fg/85">+</span> to add one.
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-fg/5 border-y border-fg/5">
          {scheduledTransactions.map((s) => {
            const isTransfer = s.kind === "transfer";
            const isInflow = !isTransfer && s.amount > 0;
            const display = isTransfer
              ? formatCurrency(s.amount)
              : isInflow
                ? `+${formatCurrency(s.amount)}`
                : `−${formatCurrency(Math.abs(s.amount))}`;
            const overdue = s.nextDate <= today;
            const subtitle = isTransfer
              ? `${cadenceLabels[s.cadence]} · ${s.fromAccount} → ${s.toAccount}`
              : `${cadenceLabels[s.cadence]} · ${s.category}`;
            const titleText = isTransfer ? "Transfer" : s.payee;
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 bg-card px-4 py-3"
              >
                <Link
                  href={`/spending/scheduled/${s.id}`}
                  className="flex-1 min-w-0"
                >
                  <p className="text-base font-bold truncate">{titleText}</p>
                  <p className="mt-0.5 text-xs text-fg/55 truncate">
                    {subtitle}
                  </p>
                  <p
                    className={`mt-0.5 text-xs ${
                      overdue ? "text-amber-400" : "text-fg/55"
                    }`}
                  >
                    {overdue ? "Due " : "Next "}
                    {formatScheduledDate(s.nextDate)}
                  </p>
                </Link>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`text-base font-bold tabular-nums ${
                      isTransfer
                        ? "text-sky-300"
                        : isInflow
                          ? "text-emerald-400"
                          : "text-fg"
                    }`}
                  >
                    {display}
                  </span>
                  <button
                    type="button"
                    onClick={() => postNow(s.id)}
                    aria-label={`Post ${titleText} now`}
                    className="flex items-center gap-1 text-xs font-bold text-accent"
                  >
                    <PlayCircle size={14} strokeWidth={2.4} />
                    Post
                  </button>
                </div>
                <ChevronRight size={16} className="text-fg/40 shrink-0" />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
