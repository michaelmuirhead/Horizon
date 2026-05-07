"use client";

import Link from "next/link";
import { Tag } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { uniqueTags } from "@/lib/transactions";

export default function TagsPage() {
  const { transactions } = useHorizonStore();
  const tags = uniqueTags(transactions);

  return (
    <>
      <SubpageHeader title="Tags" backHref="/spending" />
      <div className="px-4 pt-2 pb-10">
        {tags.length === 0 ? (
          <div className="rounded-2xl bg-card px-5 py-12 text-center text-sm text-fg/55">
            No tags yet. Add one in the Tags field on any transaction —
            comma-separated, like{" "}
            <span className="font-semibold text-fg/80">
              vacation, tax-deductible
            </span>
            .
          </div>
        ) : (
          <ul className="divide-y divide-fg/5 border-y border-fg/5">
            {tags.map((t) => (
              <li key={t.name}>
                <Link
                  href={`/spending?q=${encodeURIComponent("#" + t.name)}`}
                  className="flex items-center justify-between gap-3 bg-card px-4 py-3"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Tag size={14} className="text-accent shrink-0" strokeWidth={2.4} />
                    <span className="truncate text-base font-bold">
                      #{t.name}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-fg/55 tabular-nums shrink-0">
                    {t.count}{" "}
                    {t.count === 1 ? "transaction" : "transactions"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
