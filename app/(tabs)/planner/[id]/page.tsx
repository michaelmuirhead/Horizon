"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Repeat } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import PlannerForm from "@/components/planner/PlannerForm";
import { useHorizonStore } from "@/components/store/HorizonStore";

export default function EditPlannerEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { plannerEntries, updatePlannerEntry, deletePlannerEntry } =
    useHorizonStore();
  const entry = plannerEntries.find((e) => e.id === id);

  if (!entry) {
    return (
      <>
        <SubpageHeader title="Edit Entry" backHref="/planner" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">Entry not found.</p>
          <Link
            href="/planner"
            className="mt-4 inline-block text-accent text-base font-bold"
          >
            Back to Planner
          </Link>
        </div>
      </>
    );
  }

  // Promotes this Planner entry to a recurring Scheduled transaction by
  // prefilling the new-scheduled form with what we already know (label →
  // payee, amount, date). The user picks the missing pieces (category,
  // account, cadence) on the next screen.
  const promoteParams = new URLSearchParams({
    label: entry.label,
    amount: entry.amount.toString(),
    date: entry.date,
    from: `/planner/${entry.id}`,
  });
  const promoteHref = `/spending/scheduled/new?${promoteParams.toString()}`;

  return (
    <>
      <SubpageHeader title="Edit Entry" backHref="/planner" />
      <PlannerForm
        initial={entry}
        saveLabel="Save Changes"
        onSave={(values) => {
          updatePlannerEntry({ id: entry.id, ...values });
          router.push("/planner");
        }}
        onDelete={() => {
          if (
            window.confirm(
              `Delete "${entry.label}"? This can't be undone.`,
            )
          ) {
            deletePlannerEntry(entry.id);
            router.push("/planner");
          }
        }}
      />
      <div className="px-4 pb-10">
        <Link
          href={promoteHref}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-accent/40 px-5 py-3.5 text-base font-bold text-accent"
        >
          <Repeat size={18} strokeWidth={2.5} />
          Make Recurring
        </Link>
        <p className="mt-2 text-center text-xs text-fg/55">
          Turn this entry into a scheduled transaction that posts on a
          repeating cadence.
        </p>
      </div>
    </>
  );
}
