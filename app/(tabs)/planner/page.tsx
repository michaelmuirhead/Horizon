"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  ChevronRight,
  Copy,
  Folder,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import PageTitle from "@/components/layout/PageTitle";
import RowMenu from "@/components/planner/RowMenu";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { folderBalance, formatPlannerDate } from "@/lib/planner";
import { formatCurrency } from "@/lib/format";

// Search normaliser: lowercase, fold diacritics, drop everything that
// isn't alphanumeric. Matches the global /search behaviour so "kroger's"
// finds "krogers", "Café" finds "cafe", etc.
function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// Cap each results group so an over-broad query doesn't render hundreds
// of rows at once. 25 is comfortably scrollable on mobile.
const MAX_PER_GROUP = 25;

export default function PlannerPage() {
  const {
    plannerFolders,
    plannerBudgets,
    plannerEntries,
    addPlannerFolder,
    renamePlannerFolder,
    deletePlannerFolder,
    duplicatePlannerFolder,
  } = useHorizonStore();

  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [query, setQuery] = useState("");

  const sortedFolders = useMemo(
    () =>
      plannerFolders
        .slice()
        .sort(
          (a, b) =>
            (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER),
        ),
    [plannerFolders],
  );

  // Lookup tables so each search result can render a breadcrumb
  // (Folder · Budget) without an inner find() per row.
  const folderById = useMemo(
    () => new Map(plannerFolders.map((f) => [f.id, f])),
    [plannerFolders],
  );
  const budgetById = useMemo(
    () => new Map(plannerBudgets.map((b) => [b.id, b])),
    [plannerBudgets],
  );

  const needle = normalize(query);
  const searching = needle !== "";
  const results = useMemo(() => {
    if (!searching) {
      return {
        folders: [] as typeof plannerFolders,
        budgets: [] as typeof plannerBudgets,
        entries: [] as typeof plannerEntries,
      };
    }
    return {
      folders: plannerFolders
        .filter((f) => normalize(f.name).includes(needle))
        .slice(0, MAX_PER_GROUP),
      budgets: plannerBudgets
        .filter((b) => normalize(b.name).includes(needle))
        .slice(0, MAX_PER_GROUP),
      entries: plannerEntries
        .filter((e) => normalize(e.label).includes(needle))
        .slice(0, MAX_PER_GROUP),
    };
  }, [needle, searching, plannerFolders, plannerBudgets, plannerEntries]);
  const totalHits =
    results.folders.length + results.budgets.length + results.entries.length;

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    const name = draftName.trim();
    if (name === "") return;
    addPlannerFolder(name);
    setDraftName("");
    setCreating(false);
  }

  function submitRename(e: FormEvent) {
    e.preventDefault();
    if (!renamingId) return;
    const name = renameDraft.trim();
    if (name !== "") renamePlannerFolder(renamingId, name);
    setRenamingId(null);
  }

  return (
    <>
      <div className="px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <PageTitle>Fudget</PageTitle>
        <p className="mt-1 text-sm text-fg/55">
          Group budgets into folders for trips, months, or projects.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-card-elevated px-3 py-2">
          <Search size={16} className="text-fg/55" strokeWidth={2.4} />
          <input
            type="search"
            placeholder="Search folders, budgets, entries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-fg/40"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="grid h-7 w-7 place-items-center rounded-full text-fg/55"
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>

      {searching ? (
        <div className="px-4 pt-3 pb-6 space-y-4">
          {totalHits === 0 ? (
            <p className="rounded-2xl bg-card p-5 text-center text-sm text-fg/65">
              No matches for &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : null}

          {results.folders.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 px-1 pb-2 text-xs font-bold uppercase tracking-wide text-fg/55">
                <Folder size={12} strokeWidth={2.4} />
                Folders
              </h2>
              <ul className="flex flex-col gap-2">
                {results.folders.map((folder) => {
                  const balance = folderBalance(
                    folder.id,
                    plannerBudgets,
                    plannerEntries,
                  );
                  const tone =
                    balance > 0
                      ? "text-emerald-400"
                      : balance < 0
                        ? "text-rose-400"
                        : "text-fg/60";
                  return (
                    <li key={folder.id}>
                      <Link
                        href={`/planner/${folder.id}`}
                        className="flex items-center gap-3 rounded-2xl bg-card-elevated px-3 py-3"
                      >
                        <span className="flex-1 truncate text-base font-bold">
                          {folder.name}
                        </span>
                        <span
                          className={`text-base font-bold tabular-nums shrink-0 ${tone}`}
                        >
                          {balance >= 0 ? "+" : "−"}
                          {formatCurrency(Math.abs(balance))}
                        </span>
                        <ChevronRight size={14} className="text-fg/40 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {results.budgets.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 px-1 pb-2 text-xs font-bold uppercase tracking-wide text-fg/55">
                <Wallet size={12} strokeWidth={2.4} />
                Budgets
              </h2>
              <ul className="flex flex-col gap-2">
                {results.budgets.map((budget) => {
                  const folder = folderById.get(budget.folderId);
                  return (
                    <li key={budget.id}>
                      <Link
                        href={`/planner/${budget.folderId}/${budget.id}`}
                        className="flex items-center gap-3 rounded-2xl bg-card-elevated px-3 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-base font-bold">
                            {budget.name}
                          </p>
                          {folder && (
                            <p className="mt-0.5 truncate text-xs text-fg/55">
                              {folder.name}
                            </p>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-fg/40 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {results.entries.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 px-1 pb-2 text-xs font-bold uppercase tracking-wide text-fg/55">
                <Receipt size={12} strokeWidth={2.4} />
                Entries
              </h2>
              <ul className="flex flex-col gap-2">
                {results.entries.map((entry) => {
                  const budget = budgetById.get(entry.budgetId);
                  const folder = budget
                    ? folderById.get(budget.folderId)
                    : undefined;
                  const isIncome = entry.amount > 0;
                  const display = `${isIncome ? "+" : "−"}${formatCurrency(
                    Math.abs(entry.amount),
                  )}`;
                  const tone = isIncome ? "text-emerald-400" : "text-rose-400";
                  // Only build the link when we can find both the
                  // owning budget + folder — orphan entries (data
                  // pre-v2 migration) skip the link to avoid 404s.
                  const href =
                    budget && folder
                      ? `/planner/${folder.id}/${budget.id}/${entry.id}`
                      : null;
                  const row = (
                    <div className="flex items-center gap-3 rounded-2xl bg-card-elevated px-3 py-3">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`truncate text-base font-bold ${entry.paid ? "line-through text-fg/55" : ""}`}
                        >
                          {entry.label}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-fg/55">
                          {[folder?.name, budget?.name]
                            .filter(Boolean)
                            .join(" · ")}
                          {entry.date
                            ? ` · ${formatPlannerDate(entry.date)}`
                            : ""}
                        </p>
                      </div>
                      <span
                        className={`text-base font-bold tabular-nums shrink-0 ${tone}`}
                      >
                        {display}
                      </span>
                      {href && (
                        <ChevronRight
                          size={14}
                          className="text-fg/40 shrink-0"
                        />
                      )}
                    </div>
                  );
                  return (
                    <li key={entry.id}>
                      {href ? <Link href={href}>{row}</Link> : row}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      ) : sortedFolders.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-fg/55">
          No folders yet. Tap{" "}
          <span className="font-bold text-fg/85">+ Add Folder</span> below.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-fg/5 border-y border-fg/5">
          {sortedFolders.map((folder) => {
            const balance = folderBalance(
              folder.id,
              plannerBudgets,
              plannerEntries,
            );
            const tone =
              balance > 0
                ? "text-emerald-400"
                : balance < 0
                  ? "text-rose-400"
                  : "text-fg/60";
            const isRenaming = renamingId === folder.id;
            return (
              <li
                key={folder.id}
                className="flex items-center gap-2 bg-card pl-4 pr-2"
              >
                {isRenaming ? (
                  <form
                    onSubmit={submitRename}
                    className="flex flex-1 items-center gap-2 py-3"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={submitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="flex-1 bg-transparent text-base font-bold outline-none"
                    />
                  </form>
                ) : (
                  <Link
                    href={`/planner/${folder.id}`}
                    className="flex flex-1 items-center gap-3 py-3.5 min-w-0"
                  >
                    <span className="flex-1 min-w-0 truncate text-base font-bold">
                      {folder.name}
                    </span>
                    <span
                      className={`text-base font-bold tabular-nums shrink-0 ${tone}`}
                    >
                      {balance >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(balance))}
                    </span>
                    <ChevronRight size={16} className="text-fg/40 shrink-0" />
                  </Link>
                )}
                <RowMenu
                  ariaLabel={`Actions for ${folder.name}`}
                  items={[
                    {
                      label: "Rename",
                      icon: <Pencil size={14} />,
                      onClick: () => {
                        setRenamingId(folder.id);
                        setRenameDraft(folder.name);
                      },
                    },
                    {
                      label: "Duplicate",
                      icon: <Copy size={14} />,
                      onClick: () => duplicatePlannerFolder(folder.id),
                    },
                    {
                      label: "Delete",
                      icon: <Trash2 size={14} />,
                      destructive: true,
                      onClick: () => {
                        if (
                          window.confirm(
                            `Delete folder "${folder.name}"? This removes every budget and entry inside.`,
                          )
                        ) {
                          deletePlannerFolder(folder.id);
                        }
                      },
                    },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}

      {!searching && (
      <div className="px-4 pt-4 pb-2">
        {creating ? (
          <form
            onSubmit={submitCreate}
            className="flex items-center gap-2 rounded-2xl bg-card px-3 py-2"
          >
            <input
              type="text"
              autoFocus
              placeholder="Folder name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraftName("");
                  setCreating(false);
                }
              }}
              className="flex-1 bg-transparent text-base font-bold outline-none placeholder:text-fg/40"
            />
            <button
              type="submit"
              className="rounded-full bg-accent/15 px-3 py-1.5 text-sm font-bold text-accent"
            >
              Add
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-accent/40 px-5 py-3.5 text-base font-bold text-accent"
          >
            <Plus size={18} strokeWidth={2.5} />
            Add Folder
          </button>
        )}
      </div>
      )}
    </>
  );
}
