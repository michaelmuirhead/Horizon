"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { ChevronRight, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import PageTitle from "@/components/layout/PageTitle";
import RowMenu from "@/components/planner/RowMenu";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { folderBalance } from "@/lib/planner";
import { formatCurrency } from "@/lib/format";

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
      </div>

      {sortedFolders.length === 0 ? (
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
    </>
  );
}
