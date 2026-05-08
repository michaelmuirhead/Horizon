import {
  Plus,
  MoreHorizontal,
  PlusCircle,
  Landmark,
  PiggyBank,
  Scale,
} from "lucide-react";
import IconCapsule, { CapsuleButton } from "@/components/layout/IconCapsule";
import PageTitle from "@/components/layout/PageTitle";
import AccountsList from "@/components/accounts/AccountsList";
import AccentActionButton from "@/components/accounts/AccentActionButton";

export default function AccountsPage() {
  return (
    <div className="px-4 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="flex justify-end">
        <IconCapsule>
          <CapsuleButton ariaLabel="Add Account" href="/accounts/new">
            <Plus size={20} strokeWidth={2.5} />
          </CapsuleButton>
          <CapsuleButton ariaLabel="More">
            <MoreHorizontal size={20} strokeWidth={2.5} />
          </CapsuleButton>
        </IconCapsule>
      </div>

      <div className="mt-4">
        <PageTitle>Accounts</PageTitle>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <AccountsList />

        <div className="flex flex-col gap-3">
          <AccentActionButton
            Icon={PlusCircle}
            label="Add Account"
            href="/accounts/new"
          />
          <AccentActionButton
            Icon={Scale}
            label="Track Debts"
            href="/accounts/debts"
          />
          <AccentActionButton
            Icon={PiggyBank}
            label="Savings Goals"
            href="/savings"
          />
          <AccentActionButton Icon={Landmark} label="Manage Bank Connections" />
        </div>
      </div>
    </div>
  );
}
