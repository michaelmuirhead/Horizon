"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import ScheduledForm from "@/components/spending/ScheduledForm";
import { useHorizonStore } from "@/components/store/HorizonStore";
import type { ScheduledTransaction } from "@/lib/scheduled";

export default function EditScheduledPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { scheduledTransactions, updateScheduled, deleteScheduled } =
    useHorizonStore();
  const sched = scheduledTransactions.find((s) => s.id === id);

  if (!sched) {
    return (
      <>
        <SubpageHeader title="Edit Scheduled" backHref="/spending/scheduled" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">Scheduled transaction not found.</p>
          <Link
            href="/spending/scheduled"
            className="mt-4 inline-block text-accent text-base font-bold"
          >
            Back to Scheduled
          </Link>
        </div>
      </>
    );
  }

  const label = sched.kind === "transfer" ? "transfer" : `"${sched.payee}"`;

  return (
    <>
      <SubpageHeader title="Edit Scheduled" backHref="/spending/scheduled" />
      <ScheduledForm
        initial={sched}
        saveLabel="Save Changes"
        onSave={(values) => {
          // Cast back to the union — values + id reconstitutes a valid arm.
          updateScheduled({ id: sched.id, ...values } as ScheduledTransaction);
          router.push("/spending/scheduled");
        }}
        onDelete={() => {
          if (
            window.confirm(
              `Delete scheduled ${label}? This can't be undone.`,
            )
          ) {
            deleteScheduled(sched.id);
            router.push("/spending/scheduled");
          }
        }}
      />
    </>
  );
}
