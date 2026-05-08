"use client";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <div
      role="tablist"
      className="hz-capsule-track grid grid-cols-2 rounded-full p-1"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-4 py-2 text-base font-bold transition-colors ${
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
