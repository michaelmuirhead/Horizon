"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { trackingAccountNames } from "@/lib/accounts";
import { monthKeyOf, shiftMonthKey } from "@/lib/budget";
import { spendingBreakdownForMonth } from "@/lib/reflect";

const monthLabelFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function labelFromMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return monthLabelFmt.format(new Date(y, m - 1, 1));
}

export default function SpendingBreakdownPage() {
  const { transactions, accounts, groups } = useHorizonStore();
  const trackingNames = trackingAccountNames(accounts);
  const budgetTxs = useMemo(
    () => transactions.filter((t) => !trackingNames.has(t.account)),
    [transactions, trackingNames],
  );
  const now = new Date();
  const [monthKey, setMonthKey] = useState<string>(() =>
    monthKeyOf(now.getFullYear(), now.getMonth()),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [minAmount, setMinAmount] = useState("");

  const [year, monthIndex1] = monthKey.split("-").map(Number);
  const breakdown = useMemo(
    () =>
      spendingBreakdownForMonth(budgetTxs, groups, year, monthIndex1 - 1),
    [budgetTxs, groups, year, monthIndex1],
  );
  const monthLabel = breakdown.month;

  const min = parseFloat(minAmount);
  const filtered = useMemo(() => {
    return breakdown.categories.filter((c) => {
      if (
        query.trim() !== "" &&
        !c.name.toLowerCase().includes(query.trim().toLowerCase())
      )
        return false;
      if (Number.isFinite(min) && c.spent < min) return false;
      return true;
    });
  }, [breakdown.categories, query, min]);

  const totalShown = filtered.reduce((s, c) => s + c.spent, 0);
  const filtersActive = query.trim() !== "" || Number.isFinite(min);

  return (
    <>
      <SubpageHeader
        title="Spending Breakdown"
        backHref="/reflect"
        trailing={
          <button
            type="button"
            aria-label={filtersOpen ? "Close filters" : "Filter"}
            aria-pressed={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
            className={`grid h-10 w-10 place-items-center rounded-full bg-card-elevated ${
              filtersActive ? "text-accent" : ""
            }`}
          >
            <Filter size={18} strokeWidth={2.5} />
          </button>
        }
      />

      <div className="px-4 pt-2">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
            aria-label="Previous month"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-card-elevated"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <span className="min-w-[140px] text-center text-base font-bold text-accent">
            {labelFromMonthKey(monthKey)}
          </span>
          <button
            type="button"
            onClick={() => setMonthKey((m) => shiftMonthKey(m, 1))}
            aria-label="Next month"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-card-elevated"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="px-4 pt-3">
          <div className="rounded-2xl bg-card p-4 space-y-2 text-sm">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter category names…"
              className="w-full rounded-md bg-card-elevated px-3 py-2 outline-none placeholder:text-fg/40"
            />
            <div className="flex items-center gap-2">
              <label className="w-20 text-fg/60">$ Min</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 rounded-md bg-card-elevated px-2 py-1.5 outline-none"
              />
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setMinAmount("");
                }}
                className="text-xs font-semibold text-accent"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      <div className="px-4 pt-4">
        <section className="rounded-3xl bg-card p-5">
          <p className="mt-1 text-center text-sm text-fg/70">
            Total Spending
          </p>
          <p className="mt-1 text-center text-4xl font-extrabold tabular-nums">
            {formatCurrency(filtersActive ? totalShown : breakdown.total)}
          </p>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-card-elevated">
            <div
              className="h-full bg-accent"
              style={{
                width:
                  (filtersActive ? totalShown : breakdown.total) > 0
                    ? "100%"
                    : "0%",
              }}
            />
          </div>
        </section>
      </div>

      <div className="px-4 pt-6 pb-6">
        <h2 className="text-xl font-bold">Categories</h2>
        {filtered.length === 0 ? (
          <p className="mt-3 text-base text-fg/60">
            {filtersActive
              ? `No matches in ${monthLabel}.`
              : `No spending recorded for ${monthLabel}.`}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {filtered.map((c) => {
              const pct =
                breakdown.total > 0
                  ? Math.round((c.spent / breakdown.total) * 100)
                  : 0;
              return (
                <li key={c.name}>
                  <div className="block w-full rounded-2xl bg-card-elevated p-4 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold">{c.name}</span>
                      <span className="text-base font-bold tabular-nums">
                        {formatCurrency(c.spent)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-fg/85 tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
