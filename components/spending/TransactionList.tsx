"use client";

import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  groupByDate,
  formatTransactionDate,
  type Transaction,
} from "@/lib/transactions";
import TransactionRow from "./TransactionRow";

export type TransactionSort =
  | "date-desc"
  | "date-asc"
  | "amount-desc"
  | "amount-asc"
  | "payee-asc";

type Props = {
  transactions?: Transaction[];
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  sort?: TransactionSort;
  // When set, rows trigger this instead of routing to /spending/[id]. Used
  // by the two-pane Spending layout on iPad landscape.
  onSelect?: (id: string) => void;
  highlightedId?: string;
};

function sortFlat(transactions: Transaction[], sort: TransactionSort): Transaction[] {
  const copy = transactions.slice();
  switch (sort) {
    case "date-asc":
      copy.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      return copy;
    case "amount-desc":
      copy.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      return copy;
    case "amount-asc":
      copy.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
      return copy;
    case "payee-asc":
      copy.sort((a, b) =>
        a.payee.toLowerCase() < b.payee.toLowerCase()
          ? -1
          : a.payee.toLowerCase() > b.payee.toLowerCase()
            ? 1
            : 0,
      );
      return copy;
    default:
      copy.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return copy;
  }
}

export default function TransactionList({
  transactions: txProp,
  selectMode,
  selectedIds,
  onToggleSelect,
  sort = "date-desc",
  onSelect,
  highlightedId,
}: Props = {}) {
  const { transactions: store } = useHorizonStore();
  const transactions = txProp ?? store;

  if (transactions.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-fg/60">
        No transactions yet. Tap{" "}
        <span className="font-bold text-fg/85">+ Transaction</span> to add
        one.
      </div>
    );
  }

  // Date sorts keep the grouped-by-day rendering; other sorts render flat
  // because the grouping headers no longer carry meaning.
  const grouped = sort === "date-desc" || sort === "date-asc";

  if (grouped) {
    const groups = groupByDate(transactions);
    if (sort === "date-asc") groups.reverse();
    return (
      <div>
        {groups.map((group) => (
          <section key={group.date}>
            <h2 className="px-4 pb-2 text-base font-bold">
              {formatTransactionDate(group.date)}
            </h2>
            <ul className="divide-y divide-fg/5 border-y border-fg/5">
              {group.items.map((tx) => (
                <li key={tx.id}>
                  <TransactionRow
                    tx={tx}
                    selectMode={selectMode}
                    selected={selectedIds?.has(tx.id) ?? false}
                    onToggleSelect={
                      onToggleSelect ? () => onToggleSelect(tx.id) : undefined
                    }
                    onSelect={onSelect ? () => onSelect(tx.id) : undefined}
                    highlighted={highlightedId === tx.id}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  const flat = sortFlat(transactions, sort);
  return (
    <ul className="divide-y divide-fg/5 border-y border-fg/5">
      {flat.map((tx) => (
        <li key={tx.id}>
          <TransactionRow
            tx={tx}
            selectMode={selectMode}
            selected={selectedIds?.has(tx.id) ?? false}
            onToggleSelect={
              onToggleSelect ? () => onToggleSelect(tx.id) : undefined
            }
          />
        </li>
      ))}
    </ul>
  );
}
