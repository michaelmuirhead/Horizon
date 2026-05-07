import Link from "next/link";
import { Plus } from "lucide-react";

export default function AddTransactionFAB() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 md:pl-20">
      <div className="mx-auto max-w-md md:max-w-3xl lg:max-w-5xl px-4 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-6">
        <div className="flex justify-end">
          <Link
            href="/spending/new"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-card-elevated px-5 py-3 text-base font-bold shadow-2xl ring-1 ring-fg/5"
          >
            <Plus size={20} strokeWidth={2.5} />
            Transaction
          </Link>
        </div>
      </div>
    </div>
  );
}
