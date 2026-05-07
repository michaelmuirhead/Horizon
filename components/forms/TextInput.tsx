import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export default function TextInput(props: Props) {
  return (
    <input
      {...props}
      className={`w-full bg-transparent text-right text-base font-semibold text-fg placeholder:text-fg/40 outline-none focus:outline-none ${
        props.className ?? ""
      }`}
    />
  );
}
