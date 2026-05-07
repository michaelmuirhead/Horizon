"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import TransactionForm from "@/components/spending/TransactionForm";
import { useHorizonStore } from "@/components/store/HorizonStore";

export default function NewTransactionPage() {
  return (
    <Suspense fallback={null}>
      <NewTransaction />
    </Suspense>
  );
}

function NewTransaction() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addTransaction } = useHorizonStore();
  // ?dir=in seeds the form as an inflow — used by the Quick-add card on
  // Home so a single tap drops the user into the right direction.
  const defaultDirection =
    searchParams.get("dir") === "in" ? "inflow" : "outflow";

  return (
    <>
      <SubpageHeader title="New Transaction" backHref="/spending" />
      <TransactionForm
        saveLabel="Save Transaction"
        defaultDirection={defaultDirection}
        onSave={(values) => {
          addTransaction(values);
          router.push("/spending");
        }}
      />
    </>
  );
}
