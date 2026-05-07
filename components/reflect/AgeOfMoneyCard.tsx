"use client";

import { Clock } from "lucide-react";
import ReportCard from "./ReportCard";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { AGE_OF_MONEY_MIN_OUTFLOWS, ageOfMoneyDays } from "@/lib/reflect";

export default function AgeOfMoneyCard() {
  const { transactions } = useHorizonStore();
  const days = ageOfMoneyDays(transactions);

  if (days === null) {
    return (
      <ReportCard title="Age of Money" Icon={Clock} href="/reflect/age-of-money">
        <div className="rounded-2xl bg-accent/30 p-5 text-center">
          <h3 className="text-xl font-extrabold">Spend more money!</h3>
          <p className="mt-2 text-base text-fg/85">
            Strange advice, we know. Horizon needs a minimum of{" "}
            {AGE_OF_MONEY_MIN_OUTFLOWS} transactions to calculate your Age of
            Money.
          </p>
        </div>
      </ReportCard>
    );
  }

  return (
    <ReportCard title="Age of Money" Icon={Clock} href="/reflect/age-of-money">
      <p className="text-5xl font-extrabold tabular-nums">{days}</p>
      <p className="mt-1 text-base text-fg/70">
        {days === 1 ? "day old" : "days old"}
      </p>
      <p className="mt-3 text-sm text-fg/60">
        Average age of dollars spent in your last{" "}
        {AGE_OF_MONEY_MIN_OUTFLOWS} transactions.
      </p>
    </ReportCard>
  );
}
