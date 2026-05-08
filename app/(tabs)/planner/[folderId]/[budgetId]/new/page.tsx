"use client";

import { Suspense, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import PlannerForm from "@/components/planner/PlannerForm";
import { useHorizonStore } from "@/components/store/HorizonStore";

export default function NewPlannerEntryPage({
  params,
}: {
  params: Promise<{ folderId: string; budgetId: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <NewPlannerEntry params={params} />
    </Suspense>
  );
}

function NewPlannerEntry({
  params,
}: {
  params: Promise<{ folderId: string; budgetId: string }>;
}) {
  const { folderId, budgetId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const directionParam = searchParams.get("direction");
  const direction =
    directionParam === "income" || directionParam === "expense"
      ? directionParam
      : "expense";
  const { addPlannerEntry } = useHorizonStore();

  const backHref = `/planner/${folderId}/${budgetId}`;

  return (
    <>
      <SubpageHeader title="New Entry" backHref={backHref} />
      <PlannerForm
        budgetId={budgetId}
        defaultDirection={direction}
        saveLabel="Save Entry"
        onSave={(values) => {
          addPlannerEntry(values);
          router.push(backHref);
        }}
      />
    </>
  );
}
