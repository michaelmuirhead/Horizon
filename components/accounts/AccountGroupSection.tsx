"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AccountGroup } from "@/lib/accounts";
import { liveAccountBalance } from "@/lib/accounts";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import AccountRow from "./AccountRow";

export default function AccountGroupSection({ group }: { group: AccountGroup }) {
  const [expanded, setExpanded] = useState(true);
  const { transactions } = useHorizonStore();
  const liveBalances = group.accounts.map((a) =>
    liveAccountBalance(a, transactions),
  );
  const total = liveBalances.reduce((s, b) => s + b, 0);

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-1 py-2 text-left"
      >
        <ChevronDown
          size={18}
          strokeWidth={2.5}
          className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
        />
        <h2 className="flex-1 text-xl font-bold">{group.label}</h2>
        <span className="text-base font-semibold text-fg/85 tabular-nums">
          {formatCurrency(total)}
        </span>
      </button>
      {expanded && (
        <ul className="mt-2 flex flex-col gap-2">
          {group.accounts.map((account, i) => (
            <li key={account.id}>
              <AccountRow account={account} balance={liveBalances[i]} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
