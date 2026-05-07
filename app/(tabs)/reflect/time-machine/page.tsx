"use client";

import { useMemo, useState } from "react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  categoryAvailable,
  ccPaymentRouting,
  getAssigned,
  readyToAssignAmount,
} from "@/lib/budget";
import { snapshotAt } from "@/lib/timeMachine";
import { formatCurrency } from "@/lib/format";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const longDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function BudgetTimeMachinePage() {
  const { transactions, assignments, accounts, groups } = useHorizonStore();
  const [asOf, setAsOf] = useState<string>(todayIso());

  const snap = useMemo(
    () => snapshotAt(asOf, transactions, assignments),
    [asOf, transactions, assignments],
  );
  const ccCtx = ccPaymentRouting(accounts, groups);
  const rtaThen = readyToAssignAmount(
    snap.transactions,
    snap.assignments,
    groups,
    ccCtx,
  );

  const rows = useMemo(() => {
    const out: {
      categoryId: string;
      name: string;
      assigned: number;
      available: number;
    }[] = [];
    for (const g of groups) {
      for (const c of g.categories) {
        if (c.hidden) continue;
        const assigned = getAssigned(snap.assignments, snap.asOfMonthKey, c.id);
        const available = categoryAvailable(
          c,
          snap.assignments,
          snap.transactions,
          snap.asOfMonthKey,
          ccCtx,
        );
        if (assigned === 0 && available === 0) continue;
        out.push({ categoryId: c.id, name: c.name, assigned, available });
      }
    }
    out.sort((a, b) => Math.abs(b.available) - Math.abs(a.available));
    return out;
  }, [groups, snap, ccCtx]);

  return (
    <>
      <SubpageHeader title="Budget time machine" backHref="/reflect" />
      <div className="px-4 pt-2 pb-10 space-y-3">
        <FormGroup>
          <FormRow label="As of" htmlFor="time-asof">
            <TextInput
              id="time-asof"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              max={todayIso()}
            />
          </FormRow>
        </FormGroup>

        <div className="rounded-2xl bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/55">
            Ready to Assign on {longDateFmt.format(parseIsoDate(asOf))}
          </p>
          <p
            className={`mt-1 text-3xl font-extrabold tabular-nums ${
              rtaThen < 0 ? "text-rose-400" : ""
            }`}
          >
            {formatCurrency(rtaThen)}
          </p>
          <p className="mt-1 text-[11px] text-fg/45">
            Activity counts every transaction on or before this day.
            Assignments use the month total because we don&rsquo;t know the
            exact day each one was made.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-card px-5 py-12 text-center text-sm text-fg/55">
            No category activity by this date.
          </div>
        ) : (
          <ul className="divide-y divide-fg/5 border-y border-fg/5">
            {rows.map((r) => (
              <li
                key={r.categoryId}
                className="flex items-center justify-between gap-3 bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold truncate">{r.name}</p>
                  <p className="mt-0.5 text-xs text-fg/55">
                    Assigned {formatCurrency(r.assigned)}
                  </p>
                </div>
                <span
                  className={`text-base font-bold tabular-nums shrink-0 ${
                    r.available < 0 ? "text-rose-400" : ""
                  }`}
                >
                  {formatCurrency(r.available)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
