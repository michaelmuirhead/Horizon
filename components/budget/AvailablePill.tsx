import { formatCurrency } from "@/lib/format";

export default function AvailablePill({ amount }: { amount: number }) {
  const overbudget = amount < 0;
  // The bevel + outer shadow live in the .hz-pill class; the danger
  // variant swaps the gradient and halo colour without changing layout.
  const tone = overbudget ? "hz-pill hz-pill-danger" : "hz-pill";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-base font-bold ${tone}`}
    >
      <span>{formatCurrency(amount)}</span>
    </span>
  );
}
