"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Camera,
  Check,
  GitBranch,
  Home,
  Lock,
  Scale,
} from "lucide-react";
import type { Transaction } from "@/lib/transactions";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import SwipeToDelete from "@/components/shared/SwipeToDelete";

type Props = {
  tx: Transaction;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  // When set, clicking the row calls this instead of navigating to the
  // detail route. Used by the two-pane Spending layout on iPad landscape.
  onSelect?: () => void;
  highlighted?: boolean;
};

export default function TransactionRow({
  tx,
  selectMode,
  selected,
  onToggleSelect,
  onSelect,
  highlighted,
}: Props) {
  const router = useRouter();
  const { deleteTransaction, deleteTransfer, markUndoable } = useHorizonStore();
  const isInflow = tx.amount > 0;
  const amountDisplay = isInflow
    ? formatCurrency(tx.amount)
    : `−${formatCurrency(Math.abs(tx.amount))}`;

  function jumpToFilter(category: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      router.push(`/spending?category=${encodeURIComponent(category)}`);
    };
  }

  function handleDelete() {
    if (tx.transferId) {
      markUndoable("Transfer deleted");
      deleteTransfer(tx.transferId);
    } else {
      markUndoable(`Transaction "${tx.payee}" deleted`);
      deleteTransaction(tx.id);
    }
  }

  const confirmBeforeDelete = tx.reconciled
    ? () =>
        window.confirm(
          tx.transferId
            ? "This transfer was reconciled. Delete it?"
            : "This transaction was reconciled. Delete it?",
        )
    : undefined;

  const inner = (
    <>
      {selectMode && (
        <span
          aria-hidden
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
            selected
              ? "border-accent bg-accent text-fg"
              : "border-fg/30 bg-transparent"
          }`}
        >
          {selected && <Check size={14} strokeWidth={3} />}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold truncate">{tx.payee}</p>
        <div className="mt-1.5">
          {tx.isReadyToAssign ? (
            tx.amount < 0 ? (
              <span className="hz-pill-sm hz-pill-warm inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold">
                <Scale size={12} strokeWidth={2.5} />
                Adjustment
              </span>
            ) : (
              <span className="hz-pill-sm hz-pill-mint inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold">
                <Home size={12} strokeWidth={2.5} />
                {tx.category}
              </span>
            )
          ) : tx.transferId ? (
            <span className="hz-pill-sm hz-pill-info inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold">
              <ArrowLeftRight size={12} strokeWidth={2.5} />
              Transfer
            </span>
          ) : tx.splits && tx.splits.length > 0 ? (
            <span className="hz-pill-sm hz-pill-accent inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold">
              <GitBranch size={12} strokeWidth={2.5} />
              Split · {tx.splits.length} categories
            </span>
          ) : (
            <button
              type="button"
              onClick={jumpToFilter(tx.category)}
              className="hz-pill-sm inline-block rounded-md px-2 py-1 text-xs font-semibold"
            >
              {tx.category}
            </button>
          )}
          {tx.tags && tx.tags.length > 0 && (
            <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
              {tx.tags.map((tag) => (
                <span
                  key={tag}
                  className="hz-pill-sm inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                >
                  #{tag}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center justify-end gap-1.5">
          <span
            className={`text-base font-bold tabular-nums ${
              isInflow ? "text-emerald-400" : "text-fg"
            }`}
          >
            {amountDisplay}
          </span>
          {tx.receiptDataUrl && (
            <span
              aria-label="Receipt attached"
              className="grid h-4 w-4 place-items-center rounded-full bg-fg/10 text-fg/70"
            >
              <Camera size={9} strokeWidth={2.5} />
            </span>
          )}
          {tx.reconciled ? (
            <span
              aria-label="Reconciled"
              className="grid h-4 w-4 place-items-center rounded-full bg-emerald-600 text-emerald-950"
            >
              <Lock size={9} strokeWidth={3} />
            </span>
          ) : tx.cleared ? (
            <span
              aria-label="Cleared"
              className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-emerald-950"
            >
              C
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-xs font-semibold text-fg/55">{tx.account}</p>
      </div>
    </>
  );

  let interactive;
  if (selectMode) {
    interactive = (
      <button
        type="button"
        onClick={onToggleSelect}
        aria-pressed={selected}
        className={`flex w-full items-center gap-3 px-4 py-4 text-left ${
          selected ? "bg-accent/15" : "bg-card"
        }`}
      >
        {inner}
      </button>
    );
  } else if (onSelect) {
    interactive = (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={highlighted}
        className={`flex w-full items-center gap-3 px-4 py-4 text-left ${
          highlighted ? "bg-accent/15" : "bg-card"
        }`}
      >
        {inner}
      </button>
    );
  } else {
    interactive = (
      <Link
        href={`/spending/${tx.id}`}
        className="flex w-full items-center gap-3 bg-card px-4 py-4 text-left"
      >
        {inner}
      </Link>
    );
  }

  return (
    <SwipeToDelete
      onDelete={handleDelete}
      ariaLabel={`Delete ${tx.transferId ? "transfer" : "transaction"} ${tx.payee}`}
      confirmBeforeDelete={confirmBeforeDelete}
      disabled={selectMode}
    >
      {interactive}
    </SwipeToDelete>
  );
}
