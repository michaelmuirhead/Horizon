import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  CreditCard,
  Landmark,
  LineChart,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";
import type { Account, AccountType } from "@/lib/accounts";
import { formatCurrency } from "@/lib/format";

const iconByType: Record<AccountType, LucideIcon> = {
  cash: Banknote,
  checking: Landmark,
  savings: PiggyBank,
  investment: LineChart,
  "credit-card": CreditCard,
  loan: Landmark,
};

const iconBgByType: Record<AccountType, string> = {
  cash: "bg-emerald-900/60 text-emerald-400",
  checking: "bg-accent/20 text-accent",
  savings: "bg-accent/20 text-accent",
  investment: "bg-mint/20 text-mint",
  "credit-card": "bg-rose-900/40 text-rose-300",
  loan: "bg-rose-900/40 text-rose-300",
};

export default function AccountRow({
  account,
  balance,
}: {
  account: Account;
  balance: number;
}) {
  const Icon = iconByType[account.type];
  const positive = balance >= 0;

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="flex w-full items-center gap-3 rounded-2xl bg-card-elevated px-3 py-3 ring-1 ring-accent/10"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${iconBgByType[account.type]}`}
      >
        <Icon size={18} strokeWidth={2.4} />
      </span>
      <span className="flex-1 text-left text-base font-bold">
        {account.name}
        {account.tracking && (
          <span className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-fg/60">
            Tracking
          </span>
        )}
      </span>
      <span
        className={`text-base font-bold tabular-nums ${
          positive ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {formatCurrency(balance)}
      </span>
      <ChevronRight size={16} className="text-fg/55" />
    </Link>
  );
}
