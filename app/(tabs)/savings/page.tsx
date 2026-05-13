import SubpageHeader from "@/components/layout/SubpageHeader";
import SavingsGoalsList from "@/components/savings/SavingsGoalsList";

export default function SavingsPage() {
  return (
    <>
      <SubpageHeader title="Savings Goals" backHref="/accounts" />
      <div className="px-4 pt-2 pb-10">
        <SavingsGoalsList />
      </div>
    </>
  );
}
