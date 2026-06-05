"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  formatHours,
  sortPaycheckEntries,
  summarizePaycheck,
  type PaycheckEntry,
} from "@/lib/paycheck";
import { formatCurrency } from "@/lib/format";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Accept "8", "8.5", or "8:30" and return decimal hours. Returns null
// on any non-positive or malformed input; the caller surfaces a hint.
function parseHours(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (trimmed.includes(":")) {
    const [h, m] = trimmed.split(":");
    const hours = Number(h);
    const minutes = Number(m);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (minutes < 0 || minutes >= 60) return null;
    const total = hours + minutes / 60;
    return total > 0 ? total : null;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseRate(raw: string): number | null {
  const n = Number(raw.trim().replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export default function PaycheckPage() {
  const {
    paycheckEntries,
    paycheckHourlyRate,
    addPaycheckEntry,
    updatePaycheckEntry,
    deletePaycheckEntry,
    clearPaycheckEntries,
    setPaycheckHourlyRate,
    markUndoable,
  } = useHorizonStore();

  // Rate editor mirrors the inline "Add a folder" pattern: tap to
  // enter a value, blur or Enter to commit, Esc cancels. Empty
  // (= rate not yet set) draws an emphasis prompt instead.
  const [rateDraft, setRateDraft] = useState<string>("");
  const [editingRate, setEditingRate] = useState(false);

  const [hoursDraft, setHoursDraft] = useState<string>("");
  const [dateDraft, setDateDraft] = useState<string>(todayIso());
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [hoursError, setHoursError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");

  const sortedEntries = useMemo(
    () => sortPaycheckEntries(paycheckEntries),
    [paycheckEntries],
  );

  const summary = useMemo(
    () => summarizePaycheck(paycheckEntries, paycheckHourlyRate ?? 0),
    [paycheckEntries, paycheckHourlyRate],
  );

  function startRateEdit() {
    setRateDraft(
      paycheckHourlyRate !== undefined ? String(paycheckHourlyRate) : "",
    );
    setEditingRate(true);
  }

  function commitRate() {
    const parsed = parseRate(rateDraft);
    setPaycheckHourlyRate(parsed);
    setEditingRate(false);
  }

  function submitEntry(e: FormEvent) {
    e.preventDefault();
    const hours = parseHours(hoursDraft);
    if (hours === null) {
      setHoursError("Enter hours like 8, 8.5, or 8:30.");
      return;
    }
    setHoursError(null);
    addPaycheckEntry({
      date: dateDraft || todayIso(),
      hours,
      ...(noteDraft.trim() !== "" ? { note: noteDraft.trim() } : {}),
    });
    setHoursDraft("");
    setNoteDraft("");
    // Keep the date — most people log several days in a row.
  }

  function beginEdit(entry: PaycheckEntry) {
    setEditingId(entry.id);
    setEditHours(String(entry.hours));
    setEditDate(entry.date);
    setEditNote(entry.note ?? "");
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    const hours = parseHours(editHours);
    if (hours === null) return;
    updatePaycheckEntry({
      id: editingId,
      date: editDate,
      hours,
      ...(editNote.trim() !== "" ? { note: editNote.trim() } : {}),
    });
    setEditingId(null);
  }

  function confirmClear() {
    if (paycheckEntries.length === 0) return;
    if (
      window.confirm(
        "Clear all logged hours? Use this once the check posts so the next period starts fresh.",
      )
    ) {
      markUndoable("Paycheck entries cleared");
      clearPaycheckEntries();
    }
  }

  const hasRate = paycheckHourlyRate !== undefined && paycheckHourlyRate > 0;

  return (
    <>
      <SubpageHeader title="Paycheck" backHref="/planner" />

      {/* Rate + summary card */}
      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-card-elevated p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-fg/55">
              Hourly rate
            </span>
            {editingRate ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitRate();
                }}
                className="flex items-center gap-1"
              >
                <span className="text-fg/55 text-base">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={rateDraft}
                  onChange={(e) => setRateDraft(e.target.value)}
                  onBlur={commitRate}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingRate(false);
                  }}
                  placeholder="0.00"
                  className="w-24 rounded-md bg-card px-2 py-1 text-right text-lg font-bold tabular-nums outline-none"
                />
                <span className="text-fg/55 text-sm">/hr</span>
              </form>
            ) : (
              <button
                type="button"
                onClick={startRateEdit}
                className="text-lg font-bold tabular-nums text-fg"
              >
                {hasRate ? (
                  <>
                    {formatCurrency(paycheckHourlyRate as number)}
                    <span className="text-fg/55 text-sm font-semibold">
                      /hr
                    </span>
                  </>
                ) : (
                  <span className="text-accent">Set rate</span>
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-fg/55">
                Days
              </span>
              <span className="text-lg font-bold tabular-nums">
                {summary.daysLogged}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-fg/55">
                Hours
              </span>
              <span className="text-lg font-bold tabular-nums">
                {formatHours(summary.totalHours)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[11px] uppercase tracking-wide text-fg/55">
                Next check
              </span>
              <span className="text-lg font-bold tabular-nums text-emerald-400">
                {formatCurrency(summary.totalEarnings)}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-fg/55">
            Gross only &mdash; doesn&rsquo;t account for taxes or
            withholdings. Tap a logged day to edit it.
          </p>
        </div>
      </div>

      {/* Add a day */}
      <div className="px-4 pt-4">
        <form
          onSubmit={submitEntry}
          className="rounded-2xl bg-card p-3 space-y-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fg/55">
                Date
              </span>
              <input
                type="date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                className="rounded-md bg-card-elevated px-3 py-2 text-base outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fg/55">
                Hours
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={hoursDraft}
                onChange={(e) => {
                  setHoursDraft(e.target.value);
                  if (hoursError) setHoursError(null);
                }}
                placeholder="8 or 8:30"
                className="rounded-md bg-card-elevated px-3 py-2 text-base outline-none"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-fg/55">
              Note (optional)
            </span>
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Saturday OT, second job, …"
              className="rounded-md bg-card-elevated px-3 py-2 text-base outline-none placeholder:text-fg/40"
            />
          </label>
          {hoursError && (
            <p className="text-xs text-rose-400">{hoursError}</p>
          )}
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-base font-bold text-white"
          >
            <Plus size={18} strokeWidth={2.5} />
            Log day
          </button>
        </form>
      </div>

      {/* Logged days ledger */}
      <div className="px-4 pt-5">
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-fg/55">
            Logged days
          </h2>
          {paycheckEntries.length > 0 && (
            <button
              type="button"
              onClick={confirmClear}
              className="text-xs font-bold text-rose-400"
            >
              Clear all
            </button>
          )}
        </div>

        {sortedEntries.length === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-center text-sm text-fg/55">
            No days logged yet. Add today&rsquo;s hours above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 pb-10">
            {sortedEntries.map((entry) => {
              const rate = paycheckHourlyRate ?? 0;
              const earned = entry.hours * rate;
              const isEditing = editingId === entry.id;
              return (
                <li
                  key={entry.id}
                  className="rounded-2xl bg-card-elevated px-3 py-3"
                >
                  {isEditing ? (
                    <form
                      onSubmit={saveEdit}
                      className="flex flex-col gap-2"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="rounded-md bg-card px-2 py-1.5 text-sm outline-none"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editHours}
                          onChange={(e) => setEditHours(e.target.value)}
                          placeholder="Hours"
                          className="rounded-md bg-card px-2 py-1.5 text-sm outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Note (optional)"
                        className="rounded-md bg-card px-2 py-1.5 text-sm outline-none placeholder:text-fg/40"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="grid h-8 w-8 place-items-center rounded-full text-fg/70 hover:bg-card"
                          aria-label="Cancel edit"
                        >
                          <X size={16} strokeWidth={2.4} />
                        </button>
                        <button
                          type="submit"
                          className="grid h-8 w-8 place-items-center rounded-full bg-accent text-white"
                          aria-label="Save edit"
                        >
                          <Check size={16} strokeWidth={2.4} />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold tabular-nums">
                          {formatHours(entry.hours)}
                          <span className="ml-2 text-xs font-semibold text-fg/55">
                            {entry.date}
                          </span>
                        </p>
                        {entry.note && (
                          <p className="mt-0.5 truncate text-xs text-fg/60">
                            {entry.note}
                          </p>
                        )}
                      </div>
                      <span className="text-base font-bold tabular-nums text-emerald-400">
                        {formatCurrency(earned)}
                      </span>
                      <button
                        type="button"
                        onClick={() => beginEdit(entry)}
                        aria-label={`Edit entry for ${entry.date}`}
                        className="grid h-8 w-8 place-items-center rounded-full text-fg/70 hover:bg-card"
                      >
                        <Pencil size={14} strokeWidth={2.4} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          markUndoable(`Logged ${formatHours(entry.hours)} deleted`);
                          deletePaycheckEntry(entry.id);
                        }}
                        aria-label={`Delete entry for ${entry.date}`}
                        className="grid h-8 w-8 place-items-center rounded-full text-rose-400/80 hover:bg-card"
                      >
                        <Trash2 size={14} strokeWidth={2.4} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
