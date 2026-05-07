import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export default function Select(props: Props) {
  return (
    <div className="relative inline-block w-full">
      <select
        {...props}
        className={`w-full appearance-none bg-transparent text-right text-base font-semibold text-fg outline-none pr-5 ${
          props.className ?? ""
        }`}
      >
        {props.children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-fg/55"
      >
        ▾
      </span>
    </div>
  );
}
