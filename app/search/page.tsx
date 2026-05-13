"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Banknote, Folder, Receipt, Search as SearchIcon, Tag, X } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { formatCurrency } from "@/lib/format";

const MAX_PER_GROUP = 12;

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export default function SearchPage() {
  const {
    transactions,
    accounts,
    groups,
    plannerEntries,
    savingsGoals,
  } = useHorizonStore();
  const [q, setQ] = useState("");

  const needle = normalize(q);
  // Empty query → empty results. We deliberately don't show "everything"
  // by default: the visible-card cost is high on mobile and the user
  // hasn't expressed intent yet.
  const results = useMemo(() => {
    if (needle === "") {
      return {
        transactions: [],
        accounts: [],
        categories: [] as { groupName: string; categoryName: string }[],
        payees: [] as string[],
        plannerEntries: [],
        savingsGoals: [],
      };
    }

    const matchedTransactions = transactions
      .filter((t) => {
        const hay =
          `${t.payee} ${t.category} ${t.memo ?? ""} ${t.account} ${(t.tags ?? []).join(" ")}`.toLowerCase();
        if (hay.includes(needle)) return true;
        // Allow numeric searches like "12.50" — strip the dollar sign /
        // commas in the haystack on the fly.
        const amountStr = String(Math.abs(t.amount));
        return amountStr.startsWith(needle);
      })
      .slice(0, MAX_PER_GROUP);

    const matchedAccounts = accounts
      .filter((a) => a.name.toLowerCase().includes(needle))
      .slice(0, MAX_PER_GROUP);

    const matchedCategories: { groupName: string; categoryName: string }[] = [];
    for (const g of groups) {
      for (const c of g.categories) {
        if (c.hidden) continue;
        if (c.name.toLowerCase().includes(needle)) {
          matchedCategories.push({ groupName: g.name, categoryName: c.name });
          if (matchedCategories.length >= MAX_PER_GROUP) break;
        }
      }
      if (matchedCategories.length >= MAX_PER_GROUP) break;
    }

    // Distinct payees from the matched-transactions plus any other
    // payees that contain the needle but didn't surface as transactions
    // because they're beyond MAX_PER_GROUP. Capped to MAX_PER_GROUP too.
    const payeeSet = new Set<string>();
    for (const t of transactions) {
      if (t.payee.toLowerCase().includes(needle)) {
        payeeSet.add(t.payee);
        if (payeeSet.size >= MAX_PER_GROUP) break;
      }
    }
    const matchedPayees = Array.from(payeeSet);

    const matchedPlanner = plannerEntries
      .filter((e) =>
        `${e.label}`.toLowerCase().includes(needle),
      )
      .slice(0, MAX_PER_GROUP);

    const matchedGoals = savingsGoals
      .filter((g) => g.name.toLowerCase().includes(needle))
      .slice(0, MAX_PER_GROUP);

    return {
      transactions: matchedTransactions,
      accounts: matchedAccounts,
      categories: matchedCategories,
      payees: matchedPayees,
      plannerEntries: matchedPlanner,
      savingsGoals: matchedGoals,
    };
  }, [needle, transactions, accounts, groups, plannerEntries, savingsGoals]);

  const totalHits =
    results.transactions.length +
    results.accounts.length +
    results.categories.length +
    results.payees.length +
    results.plannerEntries.length +
    results.savingsGoals.length;

  return (
    <>
      <SubpageHeader title="Search" backHref="/" />
      <div className="px-4 pt-2 pb-10 space-y-4">
        <div className="flex items-center gap-2 rounded-2xl bg-card-elevated px-3 py-2">
          <SearchIcon size={18} className="text-fg/55" strokeWidth={2.4} />
          <input
            autoFocus
            type="search"
            placeholder="Payee, category, account, memo, amount…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-fg/40"
          />
          {q !== "" && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="grid h-8 w-8 place-items-center rounded-full text-fg/55"
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          )}
        </div>

        {needle !== "" && totalHits === 0 && (
          <p className="rounded-2xl bg-card p-5 text-center text-sm text-fg/65">
            No matches for &ldquo;{q.trim()}&rdquo;.
          </p>
        )}

        {results.transactions.length > 0 && (
          <ResultGroup
            title="Transactions"
            icon={<Receipt size={14} strokeWidth={2.4} />}
          >
            <ul className="flex flex-col gap-2">
              {results.transactions.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/spending?focus=${encodeURIComponent(t.id)}`}
                    className="flex items-center gap-3 rounded-2xl bg-card-elevated px-3 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-base font-bold">{t.payee}</p>
                      <p className="mt-0.5 truncate text-xs text-fg/55">
                        {t.date} · {t.category} · {t.account}
                      </p>
                    </div>
                    <span
                      className={`text-base font-bold tabular-nums shrink-0 ${
                        t.amount >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(t.amount))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </ResultGroup>
        )}

        {results.accounts.length > 0 && (
          <ResultGroup
            title="Accounts"
            icon={<Banknote size={14} strokeWidth={2.4} />}
          >
            <ul className="flex flex-col gap-2">
              {results.accounts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/accounts/${a.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-card-elevated px-3 py-3"
                  >
                    <span className="flex-1 truncate text-base font-bold">
                      {a.name}
                    </span>
                    <span className="shrink-0 text-xs text-fg/55">{a.type}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </ResultGroup>
        )}

        {results.categories.length > 0 && (
          <ResultGroup
            title="Categories"
            icon={<Tag size={14} strokeWidth={2.4} />}
          >
            <ul className="flex flex-col gap-2">
              {results.categories.map((c) => (
                <li
                  key={`${c.groupName}|${c.categoryName}`}
                  className="rounded-2xl bg-card-elevated px-3 py-3"
                >
                  <p className="text-base font-bold">{c.categoryName}</p>
                  <p className="mt-0.5 text-xs text-fg/55">{c.groupName}</p>
                </li>
              ))}
            </ul>
          </ResultGroup>
        )}

        {results.payees.length > 0 && (
          <ResultGroup
            title="Payees"
            icon={<Receipt size={14} strokeWidth={2.4} />}
          >
            <ul className="flex flex-wrap gap-2">
              {results.payees.map((p) => (
                <li
                  key={p}
                  className="rounded-full bg-card-elevated px-3 py-1.5 text-sm font-semibold"
                >
                  {p}
                </li>
              ))}
            </ul>
          </ResultGroup>
        )}

        {results.plannerEntries.length > 0 && (
          <ResultGroup
            title="Planner entries"
            icon={<Folder size={14} strokeWidth={2.4} />}
          >
            <ul className="flex flex-col gap-2">
              {results.plannerEntries.map((e) => (
                <li
                  key={e.id}
                  className="rounded-2xl bg-card-elevated px-3 py-3"
                >
                  <p className="text-base font-bold">{e.label}</p>
                  <p className="mt-0.5 text-xs text-fg/55">
                    {e.date ?? "no date"} · {formatCurrency(Math.abs(e.amount))}
                  </p>
                </li>
              ))}
            </ul>
          </ResultGroup>
        )}

        {results.savingsGoals.length > 0 && (
          <ResultGroup
            title="Savings goals"
            icon={<Folder size={14} strokeWidth={2.4} />}
          >
            <ul className="flex flex-col gap-2">
              {results.savingsGoals.map((g) => (
                <li
                  key={g.id}
                  className="rounded-2xl bg-card-elevated px-3 py-3"
                >
                  <p className="text-base font-bold">{g.name}</p>
                </li>
              ))}
            </ul>
          </ResultGroup>
        )}
      </div>
    </>
  );
}

function ResultGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide text-fg/55">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
