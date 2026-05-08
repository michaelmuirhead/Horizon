import Link from "next/link";
import { Plus } from "lucide-react";

type Props = {
  // Forwarded so the new-entry page knows which month to drop the entry
  // into (and which back-href to land on after save).
  monthKey: string;
};

export default function PlannerFAB({ monthKey }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 md:pl-20">
      <div className="mx-auto max-w-md md:max-w-3xl lg:max-w-5xl px-4 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-6">
        <div className="flex justify-end">
          <Link
            href={`/planner/new?month=${monthKey}`}
            aria-label="Add Planner Entry"
            className="hz-pill hz-pill-accent pointer-events-auto inline-flex items-center gap-2 rounded-full px-5 py-3 text-base font-bold"
          >
            <Plus size={20} strokeWidth={2.5} />
            <span>Entry</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
