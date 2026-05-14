"use client";

import Link from "next/link";
import { use, useMemo, useState, type FormEvent } from "react";
import { ChevronRight, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import RowMenu from "@/components/planner/RowMenu";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { budgetBalance, folderBalance } from "@/lib/planner";
import { formatCurrency } from "@/lib/format";

export default function PlannerFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = use(params);
  const {
    plannerFolders,
    plannerBudgets,
    plannerEntries,
    addPlannerBudget,
    renamePlannerBudget,
    deletePlannerBudget,
    duplicatePlannerBudget,
  } = useHorizonStore();

  const folder = plannerFolders.find((f) => f.id === folderId);
  const budgetsInFolder = useMemo(
    () => plannerBudgets.filter((b) => b.folderId === folderId),
    [plannerBudgets, folderId],
  );

  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const total = useMemo(
    () => folderBalance(folderId, plannerBudgets, plannerEntries),
    [folderId, plannerBudgets, plannerEntries],
  );

  if (!folder) {
    return (
      <>
        <SubpageHeader title="Folder" backHref="/planner" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">Folder not found.</p>
          <Link
            href="/planner"
            className="mt-4 inline-block text-accent text-base font-bold"
          >
            Back to Fudget
          </Link>
        </div>
      </>
    );
  }

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    const name = draftName.trim();
    if (name === "") return;
    addPlannerBudget(folderId, name);
    setDraftName("");
    setCreating(false);
  }

  function submitRename(e: FormEvent) {
    e.preventDefault();
    if (!renamingId) return;
    const name = renameDraft.trim();
    if (name !== "") renamePlannerBudget(renamingId, name);
    setRenamingId(null);
  }

  return (
    <>
      <SubpageHeader title={folder.name} backHref="/planner" />

      {budgetsInFolder.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-fg/55">
          No budgets in this folder yet. Tap{" "}
          <span className="font-bold text-fg/85">+ Add Budget</span> to start.
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-fg/5 border-y border-fg/5">
          {budgetsInFolder.map((budget) => {
            const entries = plannerEntries.filter(
              (e) => e.budgetId === budget.id,
            );
            const balance = budgetBalance(entries);
            const tone =
              balance > 0
                ? "text-emerald-400"
                : balance < 0
                  ? "text-rose-400"
                  : "text-fg/60";
            const isRenaming = renamingId === budget.id;
            return (
              <li
                key={budget.id}
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
                    href={`/planner/${folderId}/${budget.id}`}
                    className="flex flex-1 items-center gap-3 py-3.5 min-w-0"
                  >
                    <span className="flex-1 min-w-0 truncate text-base font-bold">
                      {budget.name}
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
                  ariaLabel={`Actions for ${budget.name}`}
                  items={[
                    {
                      label: "Rename",
                      icon: <Pencil size={14} />,
                      onClick: () => {
                        setRenamingId(budget.id);
                        setRenameDraft(budget.name);
                      },
                    },
                    {
                      label: "Duplicate",
                      icon: <Copy size={14} />,
                      onClick: () => duplicatePlannerBudget(budget.id),
                    },
                    {
                      label: "Delete",
                      icon: <Trash2 size={14} />,
                      destructive: true,
                      onClick: () => {
                        if (
                          window.confirm(
                            `Delete "${budget.name}"? This removes every entry inside.`,
                          )
                        ) {
                          deletePlannerBudget(budget.id);
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

      <div className="px-4 pt-4 pb-2">
        {creating ? (
          <form
            onSubmit={submitCreate}
            className="flex items-center gap-2 rounded-2xl bg-card px-3 py-2"
          >
            <input
              type="text"
              autoFocus
              placeholder="Budget name"
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
            Add Budget
          </button>
        )}
      </div>

      {budgetsInFolder.length > 0 && (
        <div className="mt-2 px-4 py-3 flex items-baseline justify-between border-t border-fg/5">
          <span className="text-sm font-semibold text-fg/70">
            Folder Balance
          </span>
          <span
            className={`text-xl font-extrabold tabular-nums ${
              total > 0
                ? "text-emerald-400"
                : total < 0
                  ? "text-rose-400"
                  : "text-fg"
            }`}
          >
            {total >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(total))}
          </span>
        </div>
      )}

      <div aria-hidden className="h-12" />
    </>
  );
}
