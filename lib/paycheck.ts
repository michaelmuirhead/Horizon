// Paycheck tracker — log hours worked day-by-day, multiply by an
// hourly rate, see what the next check will look like. The hourly
// rate is stored at the top level; each entry stores hours only and
// multiplies against the live rate, so a raise mid-period updates
// the projection without rewriting history. If users want a clean
// break (new rate, new check), they clear the list.

export type PaycheckEntry = {
  id: string;
  // ISO YYYY-MM-DD. Multiple entries on the same date are fine — split
  // shifts, multiple jobs, etc.
  date: string;
  // Hours worked on that date. Non-negative; the UI rejects malformed
  // input before it ever reaches the store.
  hours: number;
  // Optional free-text label ("Saturday OT", "shop floor", …).
  note?: string;
};

export const samplePaycheckEntries: PaycheckEntry[] = [];

export type PaycheckSummary = {
  totalHours: number;
  totalEarnings: number;
  daysLogged: number;
};

export function summarizePaycheck(
  entries: PaycheckEntry[],
  hourlyRate: number,
): PaycheckSummary {
  let totalHours = 0;
  const days = new Set<string>();
  for (const e of entries) {
    if (!Number.isFinite(e.hours) || e.hours <= 0) continue;
    totalHours += e.hours;
    days.add(e.date);
  }
  return {
    totalHours,
    totalEarnings: totalHours * hourlyRate,
    daysLogged: days.size,
  };
}

// Entries sorted newest first for the ledger view. Same-date entries
// fall back to insertion order via id descending so the most recently
// added one lands at the top of its date group.
export function sortPaycheckEntries(entries: PaycheckEntry[]): PaycheckEntry[] {
  return entries.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

// Pretty "5h 30m" — most paycheck-style time entry is whole or half
// hours, but the formatter handles arbitrary fractions cleanly.
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return "0h";
  const sign = hours < 0 ? "-" : "";
  const abs = Math.abs(hours);
  const whole = Math.floor(abs);
  const minutes = Math.round((abs - whole) * 60);
  if (minutes === 0) return `${sign}${whole}h`;
  if (whole === 0) return `${sign}${minutes}m`;
  return `${sign}${whole}h ${minutes}m`;
}
