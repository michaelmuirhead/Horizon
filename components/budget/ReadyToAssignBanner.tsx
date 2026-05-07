import { formatCurrency } from "@/lib/format";

export default function ReadyToAssignBanner({ amount }: { amount: number }) {
  const isOver = amount < 0;
  const isZero = amount === 0;
  const label = isOver ? "Over-Assigned" : "Ready to Assign";
  const tone = isOver
    ? "text-red-400"
    : isZero
      ? "text-fg/70"
      : "text-mint";

  return (
    <div className="mx-4 mb-3 flex items-center justify-between rounded-2xl bg-card-elevated px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>
        {formatCurrency(amount)}
      </p>
    </div>
  );
}
