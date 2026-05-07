"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import TransactionDetailPanel from "@/components/spending/TransactionDetailPanel";
import { useHorizonStore } from "@/components/store/HorizonStore";

export default function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { transactions } = useHorizonStore();
  const tx = transactions.find((t) => t.id === id);
  const title = tx?.transferId ? "Transfer" : "Edit Transaction";

  return (
    <>
      <SubpageHeader title={title} backHref="/spending" />
      <TransactionDetailPanel
        transactionId={id}
        onAfterCommit={() => router.push("/spending")}
      />
    </>
  );
}
