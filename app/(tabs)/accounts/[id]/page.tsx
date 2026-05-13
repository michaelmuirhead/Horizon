"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Scale, Trash2 } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import TransactionList from "@/components/spending/TransactionList";
import EditableText from "@/components/forms/EditableText";
import NoteEditor from "@/components/forms/NoteEditor";
import LoanSummaryCard from "@/components/accounts/LoanSummaryCard";
import InvestmentSummaryCard from "@/components/accounts/InvestmentSummaryCard";
import DebtTermsCard from "@/components/accounts/DebtTermsCard";
import AttachPhotoCard from "@/components/shared/AttachPhotoCard";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  LIABILITY_ACCOUNT_TYPES,
  accountTypeSingularLabels,
  clearedAccountBalance,
  liveAccountBalance,
} from "@/lib/accounts";
import { formatCurrency } from "@/lib/format";

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const {
    accounts,
    transactions,
    reconciliations,
    setAccountNote,
    setAccountPhoto,
    renameAccount,
    setAccountClosed,
    deleteAccount,
  } = useHorizonStore();
  const account = accounts.find((a) => a.id === id);

  if (!account) {
    return (
      <>
        <SubpageHeader title="Account" backHref="/accounts" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">Account not found.</p>
          <Link
            href="/accounts"
            className="mt-4 inline-block text-accent text-base font-bold"
          >
            Back to Accounts
          </Link>
        </div>
      </>
    );
  }

  const balance = liveAccountBalance(account, transactions);
  const cleared = clearedAccountBalance(account, transactions);
  const accountTxs = transactions.filter((t) => t.account === account.name);

  return (
    <>
      <SubpageHeader
        title={account.name}
        backHref="/accounts"
        trailing={
          <Link
            href={`/accounts/${account.id}/reconcile`}
            aria-label="Reconcile"
            className="grid h-10 w-10 place-items-center rounded-full bg-card-elevated"
          >
            <Scale size={18} strokeWidth={2.2} />
          </Link>
        }
      />
      <div className="px-4 pt-2 space-y-3">
        <div className="rounded-2xl bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
            {accountTypeSingularLabels[account.type]} · Balance
            {account.closed && (
              <span className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-fg/70">
                Closed
              </span>
            )}
          </p>
          <EditableText
            value={account.name}
            onCommit={(next) => {
              const trimmed = next.trim();
              if (trimmed !== "" && trimmed !== account.name)
                renameAccount(account.id, trimmed);
            }}
            ariaLabel={`Rename ${account.name}`}
            className="mt-1 block w-full text-base font-bold"
          />
          <p
            className={`mt-2 text-3xl font-extrabold tabular-nums ${
              balance < 0 ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {formatCurrency(balance)}
          </p>
          <p className="mt-1 text-xs text-fg/55">
            Cleared {formatCurrency(cleared)} ·{" "}
            {accountTxs.length}{" "}
            {accountTxs.length === 1 ? "transaction" : "transactions"}
          </p>
          <NoteEditor
            value={account.note ?? ""}
            onCommit={(next) => setAccountNote(account.id, next)}
            ariaLabel={`Note for ${account.name}`}
            placeholder="Add a note about this account"
          />
        </div>

        {LIABILITY_ACCOUNT_TYPES.has(account.type) && (
          <DebtTermsCard account={account} />
        )}
        {(account.type === "loan" || account.type === "bill") && (
          <AttachPhotoCard
            value={account.photoDataUrl}
            onChange={(next) => setAccountPhoto(account.id, next)}
            label={account.type === "loan" ? "Loan agreement" : "Bill statement"}
            scopeId={account.id}
          />
        )}
        {account.type === "loan" && <LoanSummaryCard account={account} />}
        {account.type === "investment" && <InvestmentSummaryCard account={account} />}

        {(() => {
          const history = reconciliations
            .filter((r) => r.accountId === account.id)
            .slice(0, 5);
          if (history.length === 0) return null;
          return (
            <section className="rounded-2xl bg-card p-4">
              <h2 className="text-sm font-bold text-fg/85">
                Reconciliation history
              </h2>
              <ul className="mt-2 divide-y divide-fg/5 text-xs">
                {history.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-fg/65">{r.date}</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(r.bankBalance)}
                    </span>
                    <span
                      className={`tabular-nums ${
                        r.adjustment === 0
                          ? "text-fg/40"
                          : r.adjustment > 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                      }`}
                    >
                      {r.adjustment === 0
                        ? "matched"
                        : `${r.adjustment > 0 ? "+" : ""}${formatCurrency(r.adjustment)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })()}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAccountClosed(account.id, !account.closed)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-card-elevated px-4 py-2.5 text-sm font-bold"
          >
            {account.closed ? (
              <>
                <ArchiveRestore size={16} />
                Reopen
              </>
            ) : (
              <>
                <Archive size={16} />
                Close
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Delete "${account.name}"? Its ${accountTxs.length} transactions stay tagged with this name and orphan.`,
                )
              ) {
                deleteAccount(account.id);
                router.push("/accounts");
              }
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-900/30 px-4 py-2.5 text-sm font-bold text-rose-300"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>
      <div className="mt-4">
        <TransactionList transactions={accountTxs} />
      </div>
    </>
  );
}
