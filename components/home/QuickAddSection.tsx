import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

// Two-button row at the top of Home for the most common action — log a
// fresh expense or income without opening the FAB on Spending.
export default function QuickAddSection() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        href="/spending/new"
        className="flex items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3.5 text-sm font-bold ring-1 ring-fg/5"
      >
        <ArrowUpRight size={16} strokeWidth={2.4} className="text-rose-300" />
        Expense
      </Link>
      <Link
        href="/spending/new?dir=in"
        className="flex items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3.5 text-sm font-bold ring-1 ring-fg/5"
      >
        <ArrowDownLeft size={16} strokeWidth={2.4} className="text-emerald-400" />
        Income
      </Link>
    </div>
  );
}
