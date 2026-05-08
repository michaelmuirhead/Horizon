"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import ScheduledForm, {
  type ScheduledFormSeed,
} from "@/components/spending/ScheduledForm";
import { useHorizonStore } from "@/components/store/HorizonStore";

export default function NewScheduledPage() {
  return (
    <Suspense fallback={null}>
      <NewScheduled />
    </Suspense>
  );
}

function NewScheduled() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addScheduled } = useHorizonStore();

  // Optional prefill via query string — used by the Planner page when
  // promoting an entry to a recurring scheduled transaction.
  const labelParam = searchParams.get("label") ?? "";
  const amountParam = searchParams.get("amount");
  const dateParam = searchParams.get("date") ?? "";
  const fromParam = searchParams.get("from") ?? "";

  const seed: ScheduledFormSeed | undefined = (() => {
    const parsedAmount = amountParam !== null ? Number(amountParam) : NaN;
    if (
      labelParam === "" &&
      !Number.isFinite(parsedAmount) &&
      dateParam === ""
    ) {
      return undefined;
    }
    return {
      payee: labelParam || undefined,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : undefined,
      nextDate: /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined,
    };
  })();

  // Bounce back to the originating screen when known so the user lands
  // where they started after saving — defaults to the scheduled list.
  const backHref = fromParam.startsWith("/") ? fromParam : "/spending/scheduled";

  return (
    <>
      <SubpageHeader title="New Scheduled" backHref={backHref} />
      <ScheduledForm
        saveLabel="Save Scheduled"
        seed={seed}
        onSave={(values) => {
          addScheduled(values);
          router.push(backHref);
        }}
      />
    </>
  );
}
