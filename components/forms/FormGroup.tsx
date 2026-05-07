import type { ReactNode } from "react";

export default function FormGroup({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card divide-y divide-fg/5">
      {children}
    </div>
  );
}

export function FormRow({
  label,
  children,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[52px]">
      <label
        htmlFor={htmlFor}
        className="w-28 shrink-0 text-base font-semibold text-fg/85"
      >
        {label}
      </label>
      <div className="flex-1 text-right text-base font-semibold text-fg">
        {children}
      </div>
    </div>
  );
}
