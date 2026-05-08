"use client";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export default function SegmentedField<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      className="hz-capsule-track grid rounded-full p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3 py-2 text-sm font-bold transition-colors ${
              active ? "hz-capsule-active" : "text-fg/70"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
