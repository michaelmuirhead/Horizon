"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  backHref: string;
  trailing?: ReactNode;
};

export default function SubpageHeader({ title, backHref, trailing }: Props) {
  return (
    <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
      <Link
        href={backHref}
        aria-label="Back"
        className="grid h-10 w-10 place-items-center rounded-full bg-card-elevated"
      >
        <ChevronLeft size={22} strokeWidth={2.5} />
      </Link>
      <h1 className="text-center text-lg font-bold">{title}</h1>
      <div className="justify-self-end">{trailing}</div>
    </div>
  );
}
