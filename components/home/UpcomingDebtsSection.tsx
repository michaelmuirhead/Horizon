"use client";

import Link from "next/link";
import { AlertCircle, CalendarClock } from "lucide-react";
import { isDebtAccount } from "@/lib/debts";
import { ordinalDay, upcomingDebtDues } from "@/lib/debtDueDate";
import { useHorizonStore } from "@/components/store/HorizonStore";

// Surfaces debts whose recurring due day falls within the next week
// (or is already overdue). Hidden entirely when nothing's coming up so
// the section doesn't add clutter on quiet weeks.
export default function UpcomingDebtsSection() {
  const { accounts } = useHorizonStore();
  const debts = accounts.filter((a) => isDebtAccount(a) && !a.closed);
  const upcoming = upcomingDebtDues(debts, 7);
  if (upcoming.length === 0) return null;

  return (
    <section className="rounded-3xl bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-bold">
        <CalendarClock size={16} className="text-accent" strokeWidth={2.4} />
        <span>Upcoming debt payments</span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {upcoming.map(({ account, daysAway }) => {
          const overdue = daysAway < 0;
          const todayOrTomorrow = daysAway >= 0 && daysAway <= 1;
          const tone = overdue
            ? "text-rose-300"
            : todayOrTomorrow
              ? "text-amber-300"
              : "text-fg/70";
          const phrase = overdue
            ? `Overdue ${-daysAway}d`
            : daysAway === 0
              ? "Today"
              : daysAway === 1
                ? "Tomorrow"
                : `In ${daysAway} days`;
          // The day-of-month is always shown alongside the relative
          // phrase as a steady reference point — "Today (15th)".
          const day = account.paymentDueDayOfMonth ?? 0;
          return (
            <li key={account.id}>
              <Link
                href={`/accounts/${account.id}`}
                className="flex items-center gap-3 rounded-2xl bg-card-elevated px-3 py-2.5"
              >
                {overdue && (
                  <AlertCircle
                    size={16}
                    className="text-rose-300"
                    strokeWidth={2.4}
                  />
                )}
                <span className="flex-1 truncate text-base font-semibold">
                  {account.name}
                </span>
                <span className={`text-xs font-bold ${tone}`}>
                  {phrase}
                  {day > 0 ? ` (${ordinalDay(day)})` : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
