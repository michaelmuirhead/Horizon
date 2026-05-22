"use client";

import Link from "next/link";
import { use, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { ordinalDay } from "@/lib/debtDueDate";
import { formatCurrency } from "@/lib/format";

// Today's ISO date — used as the fallback when a template doesn't
// carry a dayOfMonth.
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Resolve a template's dayOfMonth against the current month, clamping
// to the month's last valid date (so a "31st" template lands on Feb
// 28/29 in February instead of overflowing).
function dateForDayInCurrentMonth(day: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastOfMonth = new Date(y, m + 1, 0).getDate();
  const clamped = Math.min(Math.max(1, Math.floor(day)), lastOfMonth);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

function parseAmountInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// 1..31; empty / out-of-range → null, meaning "no fixed day".
function parseDayInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 31) return null;
  return parsed;
}

export default function FudgetRecurringPickerPage({
  params,
}: {
  params: Promise<{ folderId: string; budgetId: string }>;
}) {
  const { folderId, budgetId } = use(params);
  const router = useRouter();
  const {
    plannerFolders,
    plannerBudgets,
    fudgetRecurring,
    addFudgetRecurring,
    deleteFudgetRecurring,
    addPlannerEntries,
  } = useHorizonStore();

  const folder = plannerFolders.find((f) => f.id === folderId);
  const budget = plannerBudgets.find((b) => b.id === budgetId);
  const backHref = `/planner/${folderId}/${budgetId}`;

  // Set of currently-checked template ids. Each tap toggles. The
  // primary "Add to budget" button reads from this on submit.
  const [checked, setChecked] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Inline "new template" form. Direction defaults to expense since
  // bills are the most common recurring case; the user can flip to
  // income (e.g. a paycheck) with the toggle.
  const [draftLabel, setDraftLabel] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftDay, setDraftDay] = useState("");
  const [draftDirection, setDraftDirection] = useState<"expense" | "income">(
    "expense",
  );
  const draftAmountValue = parseAmountInput(draftAmount);
  const draftDayValue = parseDayInput(draftDay);
  const newValid = draftLabel.trim() !== "" && draftAmountValue !== null;

  function submitNewTemplate(e: FormEvent) {
    e.preventDefault();
    if (!newValid || draftAmountValue === null) return;
    const signed =
      draftDirection === "income" ? draftAmountValue : -draftAmountValue;
    addFudgetRecurring({
      label: draftLabel.trim(),
      amount: signed,
      // Only persist the field when the user actually picked a day.
      // An undefined dayOfMonth means "use today" on bulk-add.
      ...(draftDayValue !== null ? { dayOfMonth: draftDayValue } : {}),
    });
    setDraftLabel("");
    setDraftAmount("");
    setDraftDay("");
  }

  // Bulk-add the checked templates to the current budget, then
  // navigate back so the user sees their new rows. Each entry's date
  // resolves from its template's dayOfMonth against the current
  // calendar month; templates without a fixed day fall back to today.
  function addCheckedToBudget() {
    if (checked.size === 0) return;
    const today = todayIso();
    const newEntries = fudgetRecurring
      .filter((r) => checked.has(r.id))
      .map((r) => ({
        budgetId,
        label: r.label,
        amount: r.amount,
        date:
          typeof r.dayOfMonth === "number"
            ? dateForDayInCurrentMonth(r.dayOfMonth)
            : today,
      }));
    if (newEntries.length === 0) return;
    addPlannerEntries(newEntries);
    router.push(backHref);
  }

  const sorted = useMemo(
    () => fudgetRecurring.slice().sort((a, b) => a.label.localeCompare(b.label)),
    [fudgetRecurring],
  );

  if (!folder || !budget) {
    return (
      <>
        <SubpageHeader title="Recurring" backHref="/planner" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">Budget not found.</p>
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

  return (
    <>
      <SubpageHeader title="Recurring" backHref={backHref} />
      <div className="px-4 pt-2 pb-32 space-y-4">
        <p className="text-sm text-fg/65">
          Saved templates drop into any budget with a tap. Tick the ones
          you want and hit{" "}
          <span className="font-bold text-fg/85">Add to budget</span>.
        </p>

        {sorted.length === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-center text-sm text-fg/65">
            No recurring templates yet. Add your first one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((r) => {
              const isChecked = checked.has(r.id);
              const isIncome = r.amount > 0;
              const tone = isIncome ? "text-emerald-400" : "text-rose-400";
              const sign = isIncome ? "+" : "−";
              return (
                <li
                  key={r.id}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 ring-1 ${
                    isChecked
                      ? "bg-accent/15 ring-accent/50"
                      : "bg-card-elevated ring-transparent"
                  }`}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => toggle(r.id)}
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${
                      isChecked
                        ? "border-accent bg-accent text-page"
                        : "border-fg/30"
                    }`}
                  >
                    {isChecked && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M3 7l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(r.id)}
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-base font-bold">{r.label}</p>
                      {typeof r.dayOfMonth === "number" && (
                        <p className="mt-0.5 text-xs text-fg/55">
                          Due {ordinalDay(r.dayOfMonth)}
                        </p>
                      )}
                    </div>
                    <span className={`text-base font-bold tabular-nums shrink-0 ${tone}`}>
                      {sign}
                      {formatCurrency(Math.abs(r.amount))}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete recurring template "${r.label}"?`,
                        )
                      ) {
                        deleteFudgetRecurring(r.id);
                        setChecked((prev) => {
                          const next = new Set(prev);
                          next.delete(r.id);
                          return next;
                        });
                      }
                    }}
                    aria-label={`Delete ${r.label}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-rose-400/70 hover:text-rose-400"
                  >
                    <Trash2 size={14} strokeWidth={2.4} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <section className="rounded-2xl bg-card p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
            Add a new template
          </p>
          <form onSubmit={submitNewTemplate} className="space-y-2">
            <input
              type="text"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="Label (e.g. Rent, Electric)"
              className="w-full rounded-xl bg-card-elevated px-3 py-2 text-base font-semibold text-fg outline-none placeholder:text-fg/40"
            />
            <div className="flex items-center gap-2">
              <div className="hz-capsule flex shrink-0 overflow-hidden rounded-full">
                {(["expense", "income"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDraftDirection(d)}
                    aria-pressed={draftDirection === d}
                    className={`px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                      draftDirection === d
                        ? d === "income"
                          ? "bg-emerald-500/30 text-emerald-300"
                          : "bg-rose-500/30 text-rose-300"
                        : "text-fg/55"
                    }`}
                  >
                    {d === "expense" ? "Out" : "In"}
                  </button>
                ))}
              </div>
              <div className="flex flex-1 items-center gap-1 rounded-xl bg-card-elevated px-3 py-2">
                <span className="text-fg/60">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={draftAmount}
                  onChange={(e) => setDraftAmount(e.target.value)}
                  className="w-full bg-transparent text-base font-semibold text-fg outline-none placeholder:text-fg/40 tabular-nums"
                />
              </div>
              <button
                type="submit"
                disabled={!newValid}
                aria-label="Save template"
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                  newValid
                    ? "bg-accent text-page"
                    : "bg-card-elevated text-fg/40"
                }`}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
            <label className="flex items-center justify-between gap-2 text-xs text-fg/55">
              <span>
                Due day{" "}
                <span className="text-fg/40">
                  (1&ndash;31, optional)
                </span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                max="31"
                placeholder="e.g. 15"
                value={draftDay}
                onChange={(e) => setDraftDay(e.target.value)}
                className="w-20 rounded-md bg-card-elevated px-2 py-1.5 text-right text-base font-semibold text-fg outline-none placeholder:text-fg/40 tabular-nums"
              />
            </label>
            <p className="text-[11px] text-fg/45">
              When set, bulk-add lands the entry on this day of the current
              month. Leave blank to use today.
            </p>
          </form>
        </section>
      </div>

      {/* Fixed bottom strip — the primary action lives here so users
          can tap "Add to budget" without scrolling past a long list. */}
      <div className="fixed inset-x-0 bottom-0 z-30 md:pl-20">
        <div className="mx-auto max-w-md md:max-w-3xl lg:max-w-5xl bg-page/95 backdrop-blur border-t border-fg/10 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-6">
          <button
            type="button"
            onClick={addCheckedToBudget}
            disabled={checked.size === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-base font-bold ${
              checked.size === 0
                ? "border border-fg/15 text-fg/40 cursor-not-allowed"
                : "border border-accent/40 text-accent"
            }`}
          >
            Add {checked.size} to budget
          </button>
        </div>
      </div>
    </>
  );
}
