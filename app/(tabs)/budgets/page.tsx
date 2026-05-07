"use client";

import { useState, type FormEvent } from "react";
import { Archive, Check, Plus, Trash2 } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import EditableText from "@/components/forms/EditableText";
import { useHorizonStore } from "@/components/store/HorizonStore";

export default function BudgetsPage() {
  const {
    budgets,
    currentBudgetId,
    switchBudget,
    createBudget,
    renameBudget,
    deleteBudget,
    archiveAndReset,
  } = useHorizonStore();
  const [newName, setNewName] = useState("");
  const currentBudget = budgets.find((b) => b.id === currentBudgetId);
  const defaultArchiveName = currentBudget
    ? `${currentBudget.name} — ${new Date().getFullYear() - 1}`
    : "";

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (trimmed === "") return;
    createBudget(trimmed);
    setNewName("");
  }

  return (
    <>
      <SubpageHeader title="Budgets" backHref="/settings" />
      <div className="px-4 pt-2 pb-10 space-y-4">
        <p className="px-2 text-xs text-fg/55">
          Each budget is independent — its own accounts, transactions,
          categories, and targets. Switching reloads the app onto the new
          budget; current changes are saved first.
        </p>

        <ul className="flex flex-col gap-2">
          {budgets.map((b) => {
            const active = b.id === currentBudgetId;
            return (
              <li
                key={b.id}
                className={`rounded-2xl px-4 py-3 ring-1 ring-fg/5 ${
                  active ? "bg-accent/15" : "bg-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  <EditableText
                    value={b.name}
                    onCommit={(next) => {
                      const trimmed = next.trim();
                      if (trimmed !== "" && trimmed !== b.name)
                        renameBudget(b.id, trimmed);
                    }}
                    ariaLabel={`Rename budget ${b.name}`}
                    className="flex-1 text-base font-bold"
                  />
                  {b.householdId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mint/20 px-2 py-0.5 text-[10px] font-bold uppercase text-mint">
                      Household
                    </span>
                  )}
                  {active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2.5 py-1 text-[11px] font-bold uppercase text-accent">
                      <Check size={11} strokeWidth={3} />
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => switchBudget(b.id)}
                      className="rounded-full bg-card-elevated px-3 py-1 text-xs font-bold"
                    >
                      Switch
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (budgets.length <= 1) return;
                      if (
                        window.confirm(
                          `Delete budget "${b.name}"? Its data is removed permanently.`,
                        )
                      ) {
                        deleteBudget(b.id);
                      }
                    }}
                    disabled={budgets.length <= 1}
                    aria-label={`Delete budget ${b.name}`}
                    className="grid h-8 w-8 place-items-center text-rose-400/70 hover:text-rose-400 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <form
          onSubmit={handleCreate}
          className="flex items-center gap-2 rounded-2xl bg-card p-4"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New budget name"
            className="flex-1 rounded-md bg-card-elevated px-3 py-2 text-base outline-none placeholder:text-fg/40"
          />
          <button
            type="submit"
            aria-label="Create budget"
            className="grid h-10 w-10 place-items-center rounded-full bg-accent text-fg"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </form>
        <p className="px-2 text-xs text-fg/45">
          Creating a new budget seeds it with a fresh sample setup and
          switches to it.
        </p>

        <section className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-2 text-amber-300">
            <Archive size={18} strokeWidth={2.4} />
            <h2 className="text-base font-bold">Fresh start</h2>
          </div>
          <p className="mt-2 text-sm text-fg/70">
            Snapshot the active budget into a new archive, then wipe the
            live budget&rsquo;s transactions, assignments, planner entries,
            and scheduled items. Categories, accounts, targets, and pins
            stay put.
          </p>
          <button
            type="button"
            onClick={() => {
              const proposed = window.prompt(
                "Name the archived snapshot:",
                defaultArchiveName,
              );
              const trimmed = proposed?.trim();
              if (!trimmed) return;
              if (
                !window.confirm(
                  `Archive "${currentBudget?.name ?? "current"}" as "${trimmed}" and start fresh?`,
                )
              ) {
                return;
              }
              archiveAndReset(trimmed);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-5 py-2.5 text-sm font-bold text-amber-300"
          >
            <Archive size={16} strokeWidth={2.4} />
            Archive & start fresh
          </button>
        </section>
      </div>
    </>
  );
}
