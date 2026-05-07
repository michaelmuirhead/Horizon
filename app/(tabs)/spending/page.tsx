"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Database,
  ListFilter,
  Repeat,
  Search,
  Tag,
  Tags,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import IconCapsule, { CapsuleButton } from "@/components/layout/IconCapsule";
import PageTitle from "@/components/layout/PageTitle";
import TransactionList from "@/components/spending/TransactionList";
import TransactionDetailPanel from "@/components/spending/TransactionDetailPanel";
import AddTransactionFAB from "@/components/spending/AddTransactionFAB";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { useMediaQuery } from "@/components/hooks/useMediaQuery";
import { allCategoryNames } from "@/lib/budget";
import type { Transaction } from "@/lib/transactions";
import type { TransactionSort } from "@/components/spending/TransactionList";

function matchesQuery(tx: Transaction, q: string): boolean {
  const needle = q.toLowerCase();
  if (tx.payee.toLowerCase().includes(needle)) return true;
  if (tx.category.toLowerCase().includes(needle)) return true;
  if (tx.account.toLowerCase().includes(needle)) return true;
  if (tx.memo && tx.memo.toLowerCase().includes(needle)) return true;
  if (tx.splits) {
    for (const s of tx.splits) {
      if (s.category.toLowerCase().includes(needle)) return true;
    }
  }
  if (tx.tags) {
    // Lets users type "#vacation" or just "vacation" in the search box.
    const tagNeedle = needle.startsWith("#") ? needle.slice(1) : needle;
    for (const tag of tx.tags) {
      if (tag.includes(tagNeedle)) return true;
    }
  }
  return false;
}

export default function SpendingPage() {
  return (
    <Suspense fallback={null}>
      <Spending />
    </Suspense>
  );
}

function Spending() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategoryFilter = searchParams.get("category") ?? "";
  const initialQuery = searchParams.get("q") ?? "";
  const selectedTxId = searchParams.get("tx") ?? "";
  const isWide = useMediaQuery("(min-width: 1024px)");
  const {
    transactions,
    groups,
    updateTransaction,
    deleteTransaction,
    deleteTransfer,
    markUndoable,
  } = useHorizonStore();

  const setSelectedTx = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === null) params.delete("tx");
      else params.set("tx", id);
      const qs = params.toString();
      router.replace(qs ? `/spending?${qs}` : "/spending", { scroll: false });
    },
    [router, searchParams],
  );

  const [searchOpen, setSearchOpen] = useState(initialQuery !== "");
  const [query, setQuery] = useState(initialQuery);
  const [filtersOpen, setFiltersOpen] = useState(initialCategoryFilter !== "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryFilter);
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sort, setSort] = useState<TransactionSort>("date-desc");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryDraft, setCategoryDraft] = useState<string>("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const categoryNames = allCategoryNames(groups);

  const min = parseFloat(amountMin);
  const max = parseFloat(amountMax);
  const filtersActive =
    dateFrom !== "" ||
    dateTo !== "" ||
    categoryFilter !== "" ||
    Number.isFinite(min) ||
    Number.isFinite(max);

  const visibleTxs = useMemo(() => {
    let out = transactions;
    if (query.trim() !== "") {
      out = out.filter((t) => matchesQuery(t, query.trim()));
    }
    if (dateFrom !== "") out = out.filter((t) => t.date >= dateFrom);
    if (dateTo !== "") out = out.filter((t) => t.date <= dateTo);
    if (categoryFilter !== "") {
      out = out.filter((t) => {
        if (t.category === categoryFilter) return true;
        if (t.splits) {
          for (const s of t.splits) {
            if (s.category === categoryFilter) return true;
          }
        }
        return false;
      });
    }
    if (Number.isFinite(min)) {
      out = out.filter((t) => Math.abs(t.amount) >= min);
    }
    if (Number.isFinite(max)) {
      out = out.filter((t) => Math.abs(t.amount) <= max);
    }
    return out;
  }, [transactions, query, dateFrom, dateTo, categoryFilter, min, max]);

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setCategoryFilter("");
    setAmountMin("");
    setAmountMax("");
  }

  function toggleSelect(id: string) {
    const tx = transactions.find((t) => t.id === id);
    const siblingId =
      tx?.transferId
        ? transactions.find(
            (t) => t.transferId === tx.transferId && t.id !== id,
          )?.id
        : undefined;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (siblingId) next.delete(siblingId);
      } else {
        next.add(id);
        if (siblingId) next.add(siblingId);
      }
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
    setCategoryPickerOpen(false);
    setCategoryDraft("");
  }

  function bulkSetCategory() {
    if (selected.size === 0 || categoryDraft === "") return;
    for (const t of transactions) {
      if (!selected.has(t.id)) continue;
      // Don't rewrite categories on transfers, RTA inflows, or split parents —
      // their category fields are structural rather than user-pickable.
      if (t.transferId || t.isReadyToAssign) continue;
      if (t.splits && t.splits.length > 0) continue;
      if (t.category === categoryDraft) continue;
      updateTransaction({ ...t, category: categoryDraft });
    }
    exitSelect();
  }

  function bulkToggleCleared() {
    if (selected.size === 0) return;
    const allCleared = transactions
      .filter((t) => selected.has(t.id))
      .every((t) => t.cleared);
    const newCleared = !allCleared;
    for (const t of transactions) {
      if (!selected.has(t.id)) continue;
      if (t.cleared === newCleared) continue;
      updateTransaction({ ...t, cleared: newCleared });
    }
    exitSelect();
  }

  function bulkDelete() {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Delete ${selected.size} ${selected.size === 1 ? "transaction" : "transactions"}?`,
      )
    ) {
      return;
    }
    markUndoable(
      `${selected.size} ${selected.size === 1 ? "transaction" : "transactions"} deleted`,
    );
    const seenTransferIds = new Set<string>();
    for (const t of transactions) {
      if (!selected.has(t.id)) continue;
      if (t.transferId) {
        if (seenTransferIds.has(t.transferId)) continue;
        seenTransferIds.add(t.transferId);
        deleteTransfer(t.transferId);
      } else {
        deleteTransaction(t.id);
      }
    }
    exitSelect();
  }

  return (
    <>
      <div className="px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex justify-end gap-3">
          {selectMode ? (
            <button
              type="button"
              onClick={exitSelect}
              className="rounded-full bg-card-elevated px-5 h-10 text-base font-semibold"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="rounded-full bg-card-elevated px-5 h-10 text-base font-semibold"
            >
              Select
            </button>
          )}
          <IconCapsule>
            <button
              type="button"
              onClick={() => {
                setSearchOpen((v) => {
                  const next = !v;
                  if (!next) setQuery("");
                  return next;
                });
              }}
              aria-label={searchOpen ? "Close search" : "Search"}
              aria-pressed={searchOpen}
              className="grid h-10 w-10 place-items-center"
            >
              <Search size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-label={filtersOpen ? "Close filters" : "Filters"}
              aria-pressed={filtersOpen}
              className={`grid h-10 w-10 place-items-center ${
                filtersActive ? "text-accent" : ""
              }`}
            >
              <ListFilter size={18} strokeWidth={2.2} />
            </button>
            <Link
              href="/spending/transfer"
              aria-label="Transfer"
              className="grid h-10 w-10 place-items-center"
            >
              <ArrowLeftRight size={18} strokeWidth={2.2} />
            </Link>
            <Link
              href="/spending/upcoming"
              aria-label="Upcoming"
              className="grid h-10 w-10 place-items-center"
            >
              <CalendarDays size={18} strokeWidth={2.2} />
            </Link>
            <Link
              href="/spending/scheduled"
              aria-label="Scheduled"
              className="grid h-10 w-10 place-items-center"
            >
              <CalendarClock size={18} strokeWidth={2.2} />
            </Link>
            <Link
              href="/spending/payees"
              aria-label="Payees"
              className="grid h-10 w-10 place-items-center"
            >
              <Users size={18} strokeWidth={2.2} />
            </Link>
            <Link
              href="/spending/tags"
              aria-label="Tags"
              className="grid h-10 w-10 place-items-center"
            >
              <Tags size={18} strokeWidth={2.2} />
            </Link>
            <Link
              href="/spending/subscriptions"
              aria-label="Subscriptions"
              className="grid h-10 w-10 place-items-center"
            >
              <Repeat size={18} strokeWidth={2.2} />
            </Link>
            <Link
              href="/spending/templates"
              aria-label="Templates"
              className="grid h-10 w-10 place-items-center"
            >
              <Zap size={18} strokeWidth={2.2} />
            </Link>
            <Link
              href="/spending/csv"
              aria-label="CSV Tools"
              className="grid h-10 w-10 place-items-center"
            >
              <Database size={18} strokeWidth={2.2} />
            </Link>
          </IconCapsule>
        </div>
        <div className="mt-4">
          <PageTitle>Spending</PageTitle>
        </div>
        {searchOpen && (
          <div className="mt-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search payee, category, memo…"
              autoFocus
              className="w-full rounded-full bg-card-elevated px-4 py-2.5 text-base outline-none placeholder:text-fg/40"
            />
          </div>
        )}
        {filtersOpen && (
          <div className="mt-3 rounded-2xl bg-card p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <label className="w-16 text-fg/60">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as TransactionSort)}
                className="flex-1 rounded-md bg-card-elevated px-2 py-1.5 outline-none"
              >
                <option value="date-desc" className="bg-card">
                  Newest first
                </option>
                <option value="date-asc" className="bg-card">
                  Oldest first
                </option>
                <option value="amount-desc" className="bg-card">
                  Amount (high → low)
                </option>
                <option value="amount-asc" className="bg-card">
                  Amount (low → high)
                </option>
                <option value="payee-asc" className="bg-card">
                  Payee A → Z
                </option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-fg/60">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 rounded-md bg-card-elevated px-2 py-1.5 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-fg/60">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 rounded-md bg-card-elevated px-2 py-1.5 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-fg/60">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="flex-1 rounded-md bg-card-elevated px-2 py-1.5 outline-none"
              >
                <option value="" className="bg-card">
                  Any category
                </option>
                {categoryNames.map((name) => (
                  <option key={name} value={name} className="bg-card">
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-fg/60">$ Min</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder="0.00"
                className="flex-1 rounded-md bg-card-elevated px-2 py-1.5 outline-none"
              />
              <label className="w-12 text-right text-fg/60">Max</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="∞"
                className="flex-1 rounded-md bg-card-elevated px-2 py-1.5 outline-none"
              />
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-accent"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        {(query.trim() !== "" || filtersActive) && (
          <p className="mt-2 px-2 text-xs text-fg/55">
            {visibleTxs.length}{" "}
            {visibleTxs.length === 1 ? "match" : "matches"}
          </p>
        )}
      </div>

      <div className="mt-4 lg:flex lg:gap-4 lg:px-4 lg:items-start">
        <div className="lg:flex-1 lg:min-w-0 lg:rounded-2xl lg:overflow-hidden lg:border lg:border-fg/5">
          <TransactionList
            transactions={visibleTxs}
            selectMode={selectMode}
            selectedIds={selected}
            onToggleSelect={toggleSelect}
            sort={sort}
            onSelect={
              isWide && !selectMode
                ? (id) => setSelectedTx(id)
                : undefined
            }
            highlightedId={isWide ? selectedTxId : undefined}
          />
        </div>
        {isWide && (
          <aside
            aria-label="Transaction detail"
            className="hidden lg:block lg:w-[44%] lg:flex-shrink-0 lg:sticky lg:top-3 lg:self-start lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:rounded-2xl lg:bg-card lg:border lg:border-fg/5"
          >
            {selectedTxId ? (
              <TransactionDetailPanel
                transactionId={selectedTxId}
                onAfterCommit={() => setSelectedTx(null)}
              />
            ) : (
              <div className="px-6 py-12 text-center text-sm text-fg/55">
                Pick a transaction to edit it here.
              </div>
            )}
          </aside>
        )}
      </div>

      {selectMode && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 md:pl-20">
          <div className="mx-auto max-w-md md:max-w-3xl lg:max-w-5xl px-4 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-6 space-y-2">
            {categoryPickerOpen && (
              <div className="pointer-events-auto rounded-2xl bg-card-elevated px-4 py-3 shadow-2xl ring-1 ring-fg/5">
                <p className="text-xs font-semibold text-fg/70">
                  Set category for {selected.size}{" "}
                  {selected.size === 1 ? "transaction" : "transactions"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={categoryDraft}
                    onChange={(e) => setCategoryDraft(e.target.value)}
                    aria-label="Pick category"
                    className="flex-1 rounded-md bg-card px-2 py-2 text-sm outline-none"
                  >
                    <option value="" className="bg-card">
                      Pick a category…
                    </option>
                    {categoryNames.map((name) => (
                      <option key={name} value={name} className="bg-card">
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={bulkSetCategory}
                    disabled={categoryDraft === "" || selected.size === 0}
                    className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-fg disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-fg/45">
                  Transfers, RTA inflows, and split parents are skipped.
                </p>
              </div>
            )}
            <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-full bg-card-elevated px-4 py-2.5 shadow-2xl ring-1 ring-fg/5">
              <span className="text-sm font-semibold text-fg/85">
                {selected.size}{" "}
                {selected.size === 1 ? "selected" : "selected"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryPickerOpen((v) => !v)}
                  disabled={selected.size === 0}
                  aria-label="Set category"
                  aria-pressed={categoryPickerOpen}
                  className="grid h-9 w-9 place-items-center rounded-full text-accent disabled:opacity-30"
                >
                  <Tag size={18} />
                </button>
                <button
                  type="button"
                  onClick={bulkToggleCleared}
                  disabled={selected.size === 0}
                  aria-label="Toggle cleared"
                  className="grid h-9 w-9 place-items-center rounded-full text-emerald-400 disabled:opacity-30"
                >
                  <CheckCircle2 size={18} />
                </button>
                <button
                  type="button"
                  onClick={bulkDelete}
                  disabled={selected.size === 0}
                  aria-label="Delete selected"
                  className="grid h-9 w-9 place-items-center rounded-full text-rose-400 disabled:opacity-30"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectMode && <AddTransactionFAB />}
    </>
  );
}
