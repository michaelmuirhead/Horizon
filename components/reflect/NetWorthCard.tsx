"use client";

import { Landmark } from "lucide-react";
import ReportCard from "./ReportCard";
import NetWorthChart from "@/components/charts/NetWorthChart";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { currentNetWorth, netWorthHistory } from "@/lib/reflect";

export default function NetWorthCard({
  monthsBack = 6,
}: {
  monthsBack?: number;
} = {}) {
  const { accounts, transactions } = useHorizonStore();
  const now = new Date();
  const current = currentNetWorth(accounts, transactions);
  const history = netWorthHistory(
    accounts,
    transactions,
    now.getFullYear(),
    now.getMonth(),
    monthsBack,
  );
  const net = current.assets - current.debts;

  return (
    <ReportCard
      title="Net Worth"
      Icon={Landmark}
      href={`/reflect/net-worth?range=${monthsBack}`}
    >
      <p className="text-4xl font-extrabold tabular-nums">
        {formatCurrency(net)}
      </p>

      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between text-base font-semibold">
          <span className="text-accent">Assets</span>
          <span className="tabular-nums">{formatCurrency(current.assets)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span className="text-rose-400">Debts</span>
          <span className="tabular-nums">{formatCurrency(current.debts)}</span>
        </div>
      </div>

      <div className="mt-4">
        <NetWorthChart data={history} currentIndex={history.length - 1} />
      </div>
    </ReportCard>
  );
}
