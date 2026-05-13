import type { Account } from "./accounts";

// Given a day-of-month preference (1..31) and a reference date,
// returns the next occurrence of that day at or after `today`. Days
// past the month's last day clamp down so "31st" still resolves on
// short months. Returns null if `day` is out of range.
export function nextDueDate(day: number, today: Date = new Date()): string | null {
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  const y = today.getFullYear();
  const m = today.getMonth();
  const lastOfThisMonth = new Date(y, m + 1, 0).getDate();
  const thisMonthDay = Math.min(day, lastOfThisMonth);
  const candidate = new Date(y, m, thisMonthDay);
  candidate.setHours(0, 0, 0, 0);
  const start = new Date(y, m, today.getDate());
  start.setHours(0, 0, 0, 0);
  if (candidate.getTime() >= start.getTime()) return toIso(candidate);
  // Already past this month's day — roll to next month, clamping.
  const lastOfNextMonth = new Date(y, m + 2, 0).getDate();
  const nextMonthDay = Math.min(day, lastOfNextMonth);
  return toIso(new Date(y, m + 1, nextMonthDay));
}

// Whole days from `today` to `iso` (negative if past). Useful for
// "Due in 5 days" / "Overdue by 2 days" rendering.
export function daysUntil(iso: string, today: Date = new Date()): number {
  const [y, mo, d] = iso.split("-").map(Number);
  const target = new Date(y, (mo ?? 1) - 1, d ?? 1);
  target.setHours(0, 0, 0, 0);
  const ref = new Date(today);
  ref.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - ref.getTime()) / 86_400_000);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "1st" / "2nd" / "3rd" / "4th" / ... for displaying the recurring day.
export function ordinalDay(day: number): string {
  if (!Number.isFinite(day) || day < 1) return "";
  const d = Math.floor(day);
  const lastTwo = d % 100;
  const last = d % 10;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13
      ? "th"
      : last === 1
        ? "st"
        : last === 2
          ? "nd"
          : last === 3
            ? "rd"
            : "th";
  return `${d}${suffix}`;
}

export type UpcomingDebtDue = {
  account: Account;
  nextDueIso: string;
  daysAway: number;
};

// Builds the list of debts due within `withinDays` of today (default
// 7). Sorted by closeness, overdue first. Caller supplies the debt
// accounts so this stays pure / testable.
export function upcomingDebtDues(
  debts: Account[],
  withinDays = 7,
  today: Date = new Date(),
): UpcomingDebtDue[] {
  const out: UpcomingDebtDue[] = [];
  for (const account of debts) {
    if (typeof account.paymentDueDayOfMonth !== "number") continue;
    const due = nextDueDate(account.paymentDueDayOfMonth, today);
    if (!due) continue;
    const away = daysUntil(due, today);
    if (away > withinDays) continue;
    out.push({ account, nextDueIso: due, daysAway: away });
  }
  out.sort((a, b) => a.daysAway - b.daysAway);
  return out;
}
