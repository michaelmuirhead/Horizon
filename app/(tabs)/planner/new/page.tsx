"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import PlannerForm from "@/components/planner/PlannerForm";
import { useHorizonStore } from "@/components/store/HorizonStore";

export default function NewPlannerEntryPage() {
  return (
    <Suspense fallback={null}>
      <NewPlannerEntry />
    </Suspense>
  );
}

function NewPlannerEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addPlannerEntry } = useHorizonStore();
  const monthParam = searchParams.get("month") ?? "";
  // When the picker on Planner walked us into a non-current month, start
  // the form on a date inside that month (today if it's the current month,
  // otherwise the 1st) so a fresh entry lands where the user expected.
  const defaultDate = (() => {
    if (!/^\d{4}-\d{2}$/.test(monthParam)) return undefined;
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (monthParam === currentKey) return undefined;
    return `${monthParam}-01`;
  })();
  const backHref = monthParam
    ? `/planner?month=${monthParam}`
    : "/planner";

  return (
    <>
      <SubpageHeader title="New Entry" backHref={backHref} />
      <PlannerForm
        saveLabel="Save Entry"
        defaultDate={defaultDate}
        onSave={(values) => {
          addPlannerEntry(values);
          router.push(backHref);
        }}
      />
    </>
  );
}
