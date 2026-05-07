"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarRange,
  GitMerge,
  History,
  LineChart,
  TrendingUp,
  Users,
  Waves,
} from "lucide-react";
import PageTitle from "@/components/layout/PageTitle";
import Segmented from "@/components/reflect/Segmented";
import SpendingBreakdownCard from "@/components/reflect/SpendingBreakdownCard";
import IncomeVsSpendingCard from "@/components/reflect/IncomeVsSpendingCard";
import NetWorthCard from "@/components/reflect/NetWorthCard";
import AgeOfMoneyCard from "@/components/reflect/AgeOfMoneyCard";

type Range = "3" | "6" | "12";

export default function ReflectPage() {
  const [range, setRange] = useState<Range>("6");
  const monthsBack = parseInt(range, 10);

  return (
    <div className="px-4 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="flex justify-end">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "3", label: "3M" },
            { value: "6", label: "6M" },
            { value: "12", label: "12M" },
          ]}
        />
      </div>

      <div className="mt-4">
        <PageTitle>Reflect</PageTitle>
      </div>

      <div className="mt-6 flex flex-col gap-4 pb-4">
        <SpendingBreakdownCard />
        <div className="grid grid-cols-3 gap-3">
          <Link
            href={`/reflect/trends?range=${range}`}
            className="flex items-center justify-between rounded-2xl bg-card-elevated px-3 py-3 text-accent"
          >
            <span className="flex items-center gap-1.5 text-xs font-bold">
              <LineChart size={14} strokeWidth={2.4} />
              Trends
            </span>
          </Link>
          <Link
            href={`/reflect/payees?range=${range}`}
            className="flex items-center justify-between rounded-2xl bg-card-elevated px-3 py-3 text-accent"
          >
            <span className="flex items-center gap-1.5 text-xs font-bold">
              <Users size={14} strokeWidth={2.4} />
              Payees
            </span>
          </Link>
          <Link
            href={`/reflect/income?range=${range}`}
            className="flex items-center justify-between rounded-2xl bg-card-elevated px-3 py-3 text-emerald-400"
          >
            <span className="flex items-center gap-1.5 text-xs font-bold">
              <TrendingUp size={14} strokeWidth={2.4} />
              Income
            </span>
          </Link>
        </div>
        <IncomeVsSpendingCard monthsBack={monthsBack} />
        <NetWorthCard monthsBack={monthsBack} />
        <AgeOfMoneyCard />
        <Link
          href="/reflect/cash-flow"
          className="flex items-center justify-between rounded-2xl bg-card px-4 py-4 text-accent"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <Waves size={16} strokeWidth={2.4} />
            Cash flow projection
          </span>
          <span className="text-xs text-fg/50">Next 30 days &rsaquo;</span>
        </Link>
        <Link
          href="/reflect/year"
          className="flex items-center justify-between rounded-2xl bg-card px-4 py-4 text-accent"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <CalendarRange size={16} strokeWidth={2.4} />
            Year summary
          </span>
          <span className="text-xs text-fg/50">
            Income, spending, top categories &rsaquo;
          </span>
        </Link>
        <Link
          href="/reflect/time-machine"
          className="flex items-center justify-between rounded-2xl bg-card px-4 py-4 text-accent"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <History size={16} strokeWidth={2.4} />
            Budget time machine
          </span>
          <span className="text-xs text-fg/50">
            What did the budget look like on… &rsaquo;
          </span>
        </Link>
        <Link
          href="/reflect/sankey"
          className="flex items-center justify-between rounded-2xl bg-card px-4 py-4 text-accent"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <GitMerge size={16} strokeWidth={2.4} />
            Money flow
          </span>
          <span className="text-xs text-fg/50">
            Income → categories → payees &rsaquo;
          </span>
        </Link>
      </div>
    </div>
  );
}
