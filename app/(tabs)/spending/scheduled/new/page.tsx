"use client";

import { useRouter } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import ScheduledForm from "@/components/spending/ScheduledForm";
import { useHorizonStore } from "@/components/store/HorizonStore";

export default function NewScheduledPage() {
  const router = useRouter();
  const { addScheduled } = useHorizonStore();

  return (
    <>
      <SubpageHeader title="New Scheduled" backHref="/spending/scheduled" />
      <ScheduledForm
        saveLabel="Save Scheduled"
        onSave={(values) => {
          addScheduled(values);
          router.push("/spending/scheduled");
        }}
      />
    </>
  );
}
