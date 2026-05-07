import { formatCurrency } from "@/lib/format";

export default function AvailablePill({ amount }: { amount: number }) {
  const overbudget = amount < 0;
  const tone = overbudget
    ? "bg-rose-900/50 text-rose-300"
    : "bg-pill text-pill-text";
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-base font-bold ${tone}`}
    >
      {formatCurrency(amount)}
    </span>
  );
}
