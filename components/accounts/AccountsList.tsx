"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  closedAccounts,
  groupAccounts,
  liveAccountBalance,
} from "@/lib/accounts";
import { formatCurrency } from "@/lib/format";
import AccountGroupSection from "./AccountGroupSection";
import AccountRow from "./AccountRow";
import SavingsGoalsGroupSection from "./SavingsGoalsGroupSection";

export default function AccountsList() {
  const { accounts, transactions, savingsGoals } = useHorizonStore();
  const groups = groupAccounts(accounts);
  const closed = closedAccounts(accounts);
  const [closedExpanded, setClosedExpanded] = useState(false);

  if (
    groups.length === 0 &&
    closed.length === 0 &&
    savingsGoals.length === 0
  ) {
    return (
      <div className="px-1 py-8 text-center text-fg/60">
        No accounts yet. Tap <span className="font-bold text-fg/85">Add Account</span>{" "}
        to set one up.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <AccountGroupSection key={group.type} group={group} />
      ))}

      <SavingsGoalsGroupSection goals={savingsGoals} />

      {closed.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setClosedExpanded((v) => !v)}
            aria-expanded={closedExpanded}
            className="flex w-full items-center gap-3 px-1 py-2 text-left"
          >
            <ChevronDown
              size={18}
              strokeWidth={2.5}
              className={`transition-transform ${
                closedExpanded ? "" : "-rotate-90"
              }`}
            />
            <h2 className="flex-1 text-xl font-bold text-fg/55">Closed</h2>
            <span className="text-base font-semibold text-fg/40">
              {closed.length}
            </span>
          </button>
          {closedExpanded && (
            <ul className="mt-2 flex flex-col gap-2 opacity-60">
              {closed.map((a) => (
                <li key={a.id}>
                  <AccountRow
                    account={a}
                    balance={liveAccountBalance(a, transactions)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
