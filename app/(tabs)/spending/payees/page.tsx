"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import EditableText from "@/components/forms/EditableText";
import { useHorizonStore } from "@/components/store/HorizonStore";

type PayeeRow = { name: string; count: number; lastDate: string };

export default function PayeesPage() {
  const { transactions, renamePayee } = useHorizonStore();
  const [search, setSearch] = useState("");

  const rows = useMemo<PayeeRow[]>(() => {
    const map = new Map<string, PayeeRow>();
    for (const t of transactions) {
      // Skip transfers — their payees are auto-generated.
      if (t.transferId) continue;
      const key = t.payee.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (t.date > existing.lastDate) existing.lastDate = t.date;
      } else {
        map.set(key, { name: t.payee, count: 1, lastDate: t.date });
      }
    }
    const list = Array.from(map.values());
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === "") return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <>
      <SubpageHeader title="Payees" backHref="/spending" />
      <div className="px-4 pt-2 pb-10 space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payees…"
          className="w-full rounded-full bg-card-elevated px-4 py-2.5 text-base outline-none placeholder:text-fg/40"
        />

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-fg/60">
            <Users size={32} strokeWidth={2} />
            <p className="text-base">No payees yet.</p>
            <p className="text-xs text-fg/45">
              Payees show up here once you record transactions.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-fg/55">
            No payees match &ldquo;{search}&rdquo;.
          </p>
        ) : (
          <ul className="divide-y divide-fg/5 rounded-2xl bg-card">
            {filtered.map((p) => (
              <li
                key={p.name}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <EditableText
                    value={p.name}
                    onCommit={(next) => {
                      const trimmed = next.trim();
                      if (trimmed === "" || trimmed === p.name) return;
                      // If the new name matches another payee (case-insensitive),
                      // confirm it as a merge.
                      const collision = rows.find(
                        (r) =>
                          r.name.toLowerCase() === trimmed.toLowerCase() &&
                          r.name !== p.name,
                      );
                      if (collision) {
                        if (
                          !window.confirm(
                            `Merge ${p.count} ${p.count === 1 ? "transaction" : "transactions"} from "${p.name}" into "${collision.name}"?`,
                          )
                        ) {
                          return;
                        }
                        renamePayee(p.name, collision.name);
                      } else {
                        renamePayee(p.name, trimmed);
                      }
                    }}
                    ariaLabel={`Rename ${p.name}`}
                    className="block text-base font-semibold truncate"
                  />
                  <p className="mt-0.5 text-xs text-fg/55">
                    {p.count}{" "}
                    {p.count === 1 ? "transaction" : "transactions"}
                    {p.lastDate ? ` · last ${p.lastDate}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="px-2 text-xs text-fg/45">
          Renaming to an existing payee&rsquo;s exact name merges them. Past
          transactions are updated in place.
        </p>
      </div>
    </>
  );
}
