"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    </>
  );
}
