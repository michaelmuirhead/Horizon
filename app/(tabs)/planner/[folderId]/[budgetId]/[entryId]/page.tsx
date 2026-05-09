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
  params: Promise<{ folderId: string; budgetId: string; entryId: string }>;
}) {
  const { folderId, budgetId, entryId } = use(params);
  const router = useRouter();
  const { plannerEntries, updatePlannerEntry, deletePlannerEntry } =
    useHorizonStore();
  const entry = plannerEntries.find((e) => e.id === entryId);
  const backHref = `/planner/${folderId}/${budgetId}`;

  if (!entry) {
    return (
      <>
        <SubpageHeader title="Edit Entry" backHref={backHref} />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">Entry not found.</p>
          <Link
            href={backHref}
            className="mt-4 inline-block text-accent text-base font-bold"
          >
            Back to Budget
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SubpageHeader title="Edit Entry" backHref={backHref} />
      <PlannerForm
        initial={entry}
        budgetId={budgetId}
        saveLabel="Save Changes"
        onSave={(values) => {
          updatePlannerEntry({ ...entry, ...values });
          router.push(backHref);
        }}
        onDelete={() => {
          if (window.confirm(`Delete "${entry.label}"? This can't be undone.`)) {
            deletePlannerEntry(entry.id);
            router.push(backHref);
          }
        }}
      />
    </>
  );
}
