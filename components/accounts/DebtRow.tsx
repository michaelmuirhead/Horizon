import Link from "next/link";
import { ChevronRight, CreditCard, Landmark, type LucideIcon } from "lucide-react";
import type { AccountType } from "@/lib/accounts";
import type { DebtRow as DebtRowData } from "@/lib/debts";
import { formatCurrency } from "@/lib/format";

const iconByType: Record<AccountType, LucideIcon> = {
  cash: Landmark,
  checking: Landmark,
  savings: Landmark,
  investment: Landmark,
  "credit-card": CreditCard,
  loan: Landmark,
};

const typeLabel: Record<AccountType, string> = {
  cash: "Cash",
  checking: "Checking",
  savings: "Savings",
  investment: "Investment",
  "credit-card": "Credit Card",
  loan: "Loan",
};

export default function DebtRow({ row }: { row: DebtRowData }) {
  const Icon = iconByType[row.account.type];
  const aprText = row.apr === null ? "—" : `${row.apr.toFixed(2)}%`;
  const minText =
    row.minimumPayment === null ? "—" : formatCurrency(row.minimumPayment);

  return (
    <Link
      href={`/accounts/${row.account.id}`}
      className="block rounded-2xl bg-card-elevated px-3 py-3 ring-1 ring-accent/10"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-900/40 text-rose-300">
          <Icon size={18} strokeWidth={2.4} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-bold">
              {row.account.name}
            </span>
          </div>
          <div className="text-xs text-fg/55">{typeLabel[row.account.type]}</div>
        </div>
        <span className="text-base font-bold tabular-nums text-rose-400">
          {formatCurrency(row.balance)}
        </span>
        <ChevronRight size={16} className="text-fg/55" />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
        <div className="flex items-baseline justify-between border-t border-fg/5 pt-2">
          <dt className="text-fg/55">APR</dt>
          <dd
            className={`font-semibold tabular-nums ${
              row.apr === null ? "text-fg/40" : "text-fg/85"
            }`}
          >
            {aprText}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-fg/5 pt-2">
          <dt className="text-fg/55">
            Min{" "}
            {row.minimumIsEstimated && row.minimumPayment !== null && (
              <span className="text-[10px] uppercase text-fg/40">est</span>
            )}
          </dt>
          <dd
            className={`font-semibold tabular-nums ${
              row.minimumPayment === null ? "text-fg/40" : "text-fg/85"
            }`}
          >
            {minText}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
