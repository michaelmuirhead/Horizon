"use client";

import { useMemo, useState } from "react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import Segmented from "@/components/reflect/Segmented";
import SankeyChart from "@/components/charts/SankeyChart";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { buildSankey } from "@/lib/sankey";

type Range = "1" | "3" | "6" | "12";

function isoNMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SankeyPage() {
  const { transactions } = useHorizonStore();
  const [range, setRange] = useState<Range>("3");
  const months = parseInt(range, 10);
  const fromIso = isoNMonthsAgo(months - 1);
  const toIso = todayIso();

  const data = useMemo(
    () => buildSankey(transactions, fromIso, toIso),
    [transactions, fromIso, toIso],
  );

  const totalIncome = data.nodes
    .filter((n) => n.column === 0)
    .reduce((s, n) => s + n.value, 0);
  const totalSpend = data.nodes
    .filter((n) => n.column === 1)
    .reduce((s, n) => s + n.value, 0);

  return (
    <>
      <SubpageHeader title="Money flow" backHref="/reflect" />
      <div className="px-4 pt-2 pb-10 space-y-3">
        <div className="flex justify-end">
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: "1", label: "1M" },
              { value: "3", label: "3M" },
              { value: "6", label: "6M" },
              { value: "12", label: "12M" },
            ]}
          />
        </div>

        {totalIncome === 0 && totalSpend === 0 ? (
          <div className="rounded-2xl bg-card px-5 py-12 text-center text-sm text-fg/55">
            Nothing to chart in this window — log some transactions and
            tagged-RTA inflows so the flow has something to show.
          </div>
        ) : (
          <div className="rounded-2xl bg-card p-3 overflow-x-auto">
            <div className="min-w-[640px]">
              <SankeyChart data={data} />
            </div>
          </div>
        )}

        <p className="px-2 text-[11px] text-fg/45">
          Income on the left, spending categories in the middle, top
          payees on the right. Categories beyond the top 6 collapse into
          &ldquo;Other&rdquo;; same for payees beyond the top 3 per
          category.
        </p>
      </div>
    </>
  );
}
