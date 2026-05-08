import SubpageHeader from "@/components/layout/SubpageHeader";
import DebtsList from "@/components/accounts/DebtsList";

export default function DebtsPage() {
  return (
    <>
      <SubpageHeader title="Debts" backHref="/accounts" />
      <div className="px-4 pt-2 pb-10">
        <DebtsList />
      </div>
    </>
  );
}
