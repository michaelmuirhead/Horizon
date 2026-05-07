export type ScheduledCadence = "weekly" | "biweekly" | "monthly" | "yearly";

type CommonSchedule = {
  id: string;
  cadence: ScheduledCadence;
  nextDate: string; // ISO YYYY-MM-DD
  memo?: string;
};

// Discriminator is optional to keep older persisted entries (no `kind`) valid;
// missing kind == "transaction".
export type ScheduledTransaction =
  | (CommonSchedule & {
      kind?: "transaction";
      payee: string;
      category: string;
      amount: number; // signed; matches Transaction.amount
      account: string;
      isReadyToAssign?: boolean;
    })
  | (CommonSchedule & {
      kind: "transfer";
      fromAccount: string;
      toAccount: string;
      amount: number; // positive
      cleared?: boolean;
    });

export function isTransferSchedule(
  s: ScheduledTransaction,
): s is Extract<ScheduledTransaction, { kind: "transfer" }> {
  return s.kind === "transfer";
}

export const samplePlannerScheduled: ScheduledTransaction[] = [];

export const cadenceLabels: Record<ScheduledCadence, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
  yearly: "Every year",
};

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function advanceDate(iso: string, cadence: ScheduledCadence): string {
  const d = parseIsoDate(iso);
  if (cadence === "weekly") d.setDate(d.getDate() + 7);
  else if (cadence === "biweekly") d.setDate(d.getDate() + 14);
  else if (cadence === "monthly") d.setMonth(d.getMonth() + 1);
  else if (cadence === "yearly") d.setFullYear(d.getFullYear() + 1);
  return toIso(d);
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatScheduledDate(iso: string): string {
  return dateFormatter.format(parseIsoDate(iso));
}

export function todayIso(): string {
  return toIso(new Date());
}

export function isoNDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export type UpcomingOccurrence = {
  date: string;
  scheduled: ScheduledTransaction;
};

// Expands every scheduled transaction across [fromIso, toIso] inclusive,
// emitting one occurrence per cadence step that lands in the window. Past-
// due items in the window are kept (they're "due now" rather than dropped).
export function upcomingOccurrences(
  scheds: ScheduledTransaction[],
  fromIso: string,
  toIso: string,
): UpcomingOccurrence[] {
  const out: UpcomingOccurrence[] = [];
  for (const s of scheds) {
    let cursor = s.nextDate;
    // Cap iterations as a safety belt — yearly cadence past 50yrs is silly.
    let guard = 0;
    while (cursor <= toIso && guard++ < 600) {
      if (cursor >= fromIso) {
        out.push({ date: cursor, scheduled: s });
      }
      cursor = advanceDate(cursor, s.cadence);
    }
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}
