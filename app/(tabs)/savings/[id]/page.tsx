"use client";

import { use, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Minus,
  PartyPopper,
  Plus,
  Trash2,
} from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import EditableText from "@/components/forms/EditableText";
import NoteEditor from "@/components/forms/NoteEditor";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  daysUntilDue,
  isReached,
  monthlyPaceNeeded,
  progressPct,
  remainingAmount,
  savedAmount,
  type SavingsGoal,
} from "@/lib/savingsGoals";
import { formatCurrency } from "@/lib/format";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dueLabel(goal: SavingsGoal): string | null {
  if (!goal.dueDate) return null;
  const d = new Date(`${goal.dueDate}T00:00:00`);
  const formatted = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const days = daysUntilDue(goal);
  if (days === null) return formatted;
  if (days < 0) return `${formatted} · ${Math.abs(days)}d overdue`;
  if (days === 0) return `${formatted} · today`;
  return `${formatted} · ${days}d left`;
}

export default function SavingsGoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const {
    savingsGoals,
    updateSavingsGoal,
    deleteSavingsGoal,
    addSavingsContribution,
    deleteSavingsContribution,
  } = useHorizonStore();
  const goal = savingsGoals.find((g) => g.id === id);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState(
    goal ? String(goal.targetAmount) : "",
  );
  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState(goal?.dueDate ?? "");

  const summary = useMemo(() => {
    if (!goal) return null;
    return {
      saved: savedAmount(goal),
      remaining: remainingAmount(goal),
      pct: progressPct(goal),
      reached: isReached(goal),
      pace: monthlyPaceNeeded(goal),
    };
  }, [goal]);

  if (!goal || !summary) {
    return (
      <>
        <SubpageHeader title="Savings Goal" backHref="/savings" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">Goal not found.</p>
          <Link
            href="/savings"
            className="mt-4 inline-block text-base font-bold text-accent"
          >
            Back to Savings Goals
          </Link>
        </div>
      </>
    );
  }

  function commitContribution(sign: 1 | -1) {
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    addSavingsContribution(goal!.id, {
      date: todayIso(),
      amount: sign * parsed,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setAmount("");
    setNote("");
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    commitContribution(1);
  }

  function handleSubtract() {
    commitContribution(-1);
  }

  function handleDelete() {
    if (!window.confirm(`Delete savings goal "${goal!.name}"?`)) return;
    deleteSavingsGoal(goal!.id);
    router.push("/savings");
  }

  function commitTarget() {
    const next = parseFloat(targetDraft);
    if (Number.isFinite(next) && next > 0 && next !== goal!.targetAmount) {
      updateSavingsGoal(goal!.id, { targetAmount: next });
    } else {
      setTargetDraft(String(goal!.targetAmount));
    }
    setEditingTarget(false);
  }

  function commitDue() {
    const next = dueDraft.trim();
    if (next === "") {
      if (goal!.dueDate) updateSavingsGoal(goal!.id, { dueDate: undefined });
    } else if (next !== goal!.dueDate) {
      updateSavingsGoal(goal!.id, { dueDate: next });
    }
    setEditingDue(false);
  }

  return (
    <>
      <SubpageHeader title="Savings Goal" backHref="/savings" />
      <div className="px-4 pt-2 pb-10 space-y-3">
        <section className="rounded-2xl bg-card p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg/60">
            {goal.emoji && <span aria-hidden>{goal.emoji}</span>}
            Savings Goal
            {summary.reached && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                <PartyPopper size={10} strokeWidth={2.5} />
                Reached
              </span>
            )}
          </p>
          <EditableText
            value={goal.name}
            onCommit={(next) => {
              const trimmed = next.trim();
              if (trimmed !== "" && trimmed !== goal.name) {
                updateSavingsGoal(goal.id, { name: trimmed });
              }
            }}
            ariaLabel={`Rename ${goal.name}`}
            className="mt-1 block w-full text-lg font-bold"
          />
          <p
            className={`mt-2 text-3xl font-extrabold tabular-nums ${
              summary.reached ? "text-emerald-400" : "text-fg"
            }`}
          >
            {formatCurrency(summary.saved)}
          </p>
          <p className="mt-1 text-sm text-fg/60 tabular-nums">
            of{" "}
            {editingTarget ? (
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                autoFocus
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
                onBlur={commitTarget}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitTarget();
                  if (e.key === "Escape") {
                    setTargetDraft(String(goal.targetAmount));
                    setEditingTarget(false);
                  }
                }}
                className="w-24 rounded-md bg-card-elevated px-2 py-0.5 text-sm font-semibold text-fg outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTargetDraft(String(goal.targetAmount));
                  setEditingTarget(true);
                }}
                className="font-semibold text-fg/85 underline decoration-dotted underline-offset-2"
              >
                {formatCurrency(goal.targetAmount)}
              </button>
            )}{" "}
            target
          </p>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-card-elevated">
            <div
              className={`h-full ${
                summary.reached ? "bg-emerald-400" : "bg-accent"
              }`}
              style={{ width: `${summary.pct}%` }}
            />
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-fg/55">Progress</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {Math.round(summary.pct)}%
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg/55">
                {summary.reached ? "Over" : "Remaining"}
              </dt>
              <dd
                className={`mt-0.5 font-semibold tabular-nums ${
                  summary.reached ? "text-emerald-400" : ""
                }`}
              >
                {summary.reached
                  ? formatCurrency(Math.max(0, summary.saved - goal.targetAmount))
                  : formatCurrency(summary.remaining)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg/55">Per Month</dt>
              <dd
                className={`mt-0.5 font-semibold tabular-nums ${
                  summary.pace === null ? "text-fg/40" : ""
                }`}
              >
                {summary.pace === null ? "—" : formatCurrency(summary.pace)}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex items-center gap-2 text-xs text-fg/60">
            <CalendarDays size={12} strokeWidth={2.4} />
            {editingDue ? (
              <input
                type="date"
                autoFocus
                value={dueDraft}
                onChange={(e) => setDueDraft(e.target.value)}
                onBlur={commitDue}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitDue();
                  if (e.key === "Escape") {
                    setDueDraft(goal.dueDate ?? "");
                    setEditingDue(false);
                  }
                }}
                className="rounded-md bg-card-elevated px-2 py-0.5 text-xs text-fg outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDueDraft(goal.dueDate ?? "");
                  setEditingDue(true);
                }}
                className="underline decoration-dotted underline-offset-2"
              >
                {dueLabel(goal) ?? "Set a due date"}
              </button>
            )}
          </div>

          <NoteEditor
            value={goal.notes ?? ""}
            onCommit={(next) => {
              const trimmed = next.trim();
              updateSavingsGoal(goal.id, {
                notes: trimmed === "" ? undefined : trimmed,
              });
            }}
            ariaLabel={`Note for ${goal.name}`}
            placeholder="Add a note about this goal"
          />
        </section>

        <section className="rounded-2xl bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
            Log a deposit or withdrawal
          </p>
          <form onSubmit={handleAdd} className="mt-2 space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-card-elevated px-3 py-2">
              <span className="text-fg/60">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-transparent text-base font-semibold text-fg outline-none placeholder:text-fg/40 tabular-nums"
                aria-label="Amount"
              />
            </div>
            <input
              type="text"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl bg-card-elevated px-3 py-2 text-sm text-fg outline-none placeholder:text-fg/40"
              aria-label="Note"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-emerald-950 disabled:opacity-40"
                disabled={!Number.isFinite(parseFloat(amount)) || parseFloat(amount) <= 0}
              >
                <Plus size={16} strokeWidth={2.5} />
                Deposit
              </button>
              <button
                type="button"
                onClick={handleSubtract}
                className="flex items-center justify-center gap-1.5 rounded-full bg-rose-500/90 px-4 py-2.5 text-sm font-bold text-rose-50 disabled:opacity-40"
                disabled={!Number.isFinite(parseFloat(amount)) || parseFloat(amount) <= 0}
              >
                <Minus size={16} strokeWidth={2.5} />
                Withdraw
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
            Activity
          </p>
          {goal.contributions.length === 0 ? (
            <p className="mt-3 text-sm text-fg/55">
              No deposits or withdrawals yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-fg/5">
              {goal.contributions.map((c) => {
                const isDeposit = c.amount >= 0;
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 py-2"
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                        isDeposit
                          ? "bg-emerald-900/40 text-emerald-300"
                          : "bg-rose-900/40 text-rose-300"
                      }`}
                    >
                      {isDeposit ? (
                        <Plus size={13} strokeWidth={2.6} />
                      ) : (
                        <Minus size={13} strokeWidth={2.6} />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {c.date}
                        {c.note && (
                          <span className="ml-2 text-xs font-normal text-fg/55">
                            {c.note}
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        isDeposit ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isDeposit ? "+" : "−"}
                      {formatCurrency(Math.abs(c.amount))}
                    </span>
                    <button
                      type="button"
                      aria-label="Delete entry"
                      onClick={() => deleteSavingsContribution(goal.id, c.id)}
                      className="grid h-7 w-7 place-items-center rounded-full text-fg/45 hover:bg-card-elevated hover:text-fg/85"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <button
          type="button"
          onClick={handleDelete}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-900/30 px-4 py-2.5 text-sm font-bold text-rose-300"
        >
          <Trash2 size={16} />
          Delete Goal
        </button>
      </div>
    </>
  );
}
