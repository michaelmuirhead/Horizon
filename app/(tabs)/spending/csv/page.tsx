"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  dedupeAgainstExisting,
  parseTransactionsCsv,
  transactionsToCsv,
  type CsvParseResult,
} from "@/lib/csv";

function todayIsoCompact(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function downloadCsv(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function CsvToolsPage() {
  const { transactions, accounts, addTransactions } = useHorizonStore();
  const openAccounts = accounts.filter((a) => !a.closed);
  const [exported, setExported] = useState(false);
  const [rawCsv, setRawCsv] = useState<string>("");
  const [parse, setParse] = useState<CsvParseResult | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [fallbackAccount, setFallbackAccount] = useState<string>(
    openAccounts[0]?.name ?? "",
  );
  const [flipSign, setFlipSign] = useState(false);
  const [includeDupes, setIncludeDupes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-parse whenever the user adjusts the bank-format inputs.
  useEffect(() => {
    if (rawCsv === "") return;
    setParse(
      parseTransactionsCsv(rawCsv, {
        fallbackAccount: fallbackAccount === "" ? undefined : fallbackAccount,
        flipAmountSign: flipSign,
      }),
    );
  }, [rawCsv, fallbackAccount, flipSign]);

  function handleExport() {
    const csv = transactionsToCsv(transactions);
    downloadCsv(`horizon-transactions-${todayIsoCompact()}.csv`, csv);
    setExported(true);
    window.setTimeout(() => setExported(false), 2500);
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    file.text().then((text) => {
      setRawCsv(text);
    });
  }

  // Diff parsed rows against the store so we can warn about duplicates
  // (same date + payee + amount + account) before commit.
  const diff = useMemo(() => {
    if (!parse) return null;
    return dedupeAgainstExisting(parse.rows, transactions);
  }, [parse, transactions]);

  const importable = diff
    ? includeDupes
      ? [...diff.unique, ...diff.duplicates]
      : diff.unique
    : [];

  function clearImport() {
    setParse(null);
    setFilename("");
    setRawCsv("");
    setIncludeDupes(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function commitImport() {
    if (importable.length === 0) return;
    addTransactions(importable);
    clearImport();
  }

  return (
    <>
      <SubpageHeader title="CSV Tools" backHref="/spending" />
      <div className="px-4 pt-2 pb-10 space-y-3">
        <section className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-2 text-accent">
            <Download size={18} strokeWidth={2.4} />
            <h2 className="text-base font-bold">Export</h2>
          </div>
          <p className="mt-2 text-sm text-fg/70">
            Download all {transactions.length}{" "}
            {transactions.length === 1 ? "transaction" : "transactions"} as a
            CSV. Splits are encoded as{" "}
            <code className="rounded bg-card-elevated px-1 text-xs">
              cat=amount|cat=amount
            </code>{" "}
            in the Splits column.
          </p>
          <button
            type="button"
            onClick={handleExport}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-fg"
          >
            <Download size={16} strokeWidth={2.4} />
            Download CSV
          </button>
          {exported && (
            <p className="mt-2 text-xs text-emerald-400">Download started.</p>
          )}
        </section>

        <section className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-2 text-accent">
            <Upload size={18} strokeWidth={2.4} />
            <h2 className="text-base font-bold">Import</h2>
          </div>
          <p className="mt-2 text-sm text-fg/70">
            Drop in our own export, or a bank/CC CSV with{" "}
            <em>Date</em>, <em>Description</em>/<em>Payee</em>, and an{" "}
            <em>Amount</em> column. We&rsquo;ll detect aliases like{" "}
            <em>Transaction Date</em> and strip <code>$</code> and{" "}
            <code>,</code> from amounts.
          </p>

          <div className="mt-4">
            <label
              htmlFor="csv-file"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-card-elevated px-5 py-2.5 text-sm font-bold"
            >
              <Upload size={16} strokeWidth={2.4} />
              Choose file
            </label>
            <input
              id="csv-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="sr-only"
            />
            {filename && (
              <span className="ml-3 text-sm text-fg/60">{filename}</span>
            )}
          </div>

          {parse && (
            <div className="mt-4 space-y-2">
              {parse.format === "bank" && (
                <div className="rounded-xl bg-card-elevated px-4 py-3 text-xs text-fg/75 space-y-2">
                  <p className="font-semibold">
                    Bank-format CSV detected. Pick the account to apply, and
                    flip signs if charges were exported as positives.
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="w-20 text-fg/55">Account</label>
                    <select
                      value={fallbackAccount}
                      onChange={(e) => setFallbackAccount(e.target.value)}
                      className="flex-1 rounded-md bg-card px-2 py-1.5 outline-none"
                    >
                      <option value="" className="bg-card">
                        Pick…
                      </option>
                      {openAccounts.map((a) => (
                        <option key={a.id} value={a.name} className="bg-card">
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={flipSign}
                      onChange={(e) => setFlipSign(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Flip amount signs (charges → outflows)
                  </label>
                </div>
              )}
              {parse.errors.length > 0 && (
                <div className="rounded-xl bg-rose-900/30 px-4 py-3 text-xs text-rose-200">
                  <p className="font-bold">
                    {parse.errors.length}{" "}
                    {parse.errors.length === 1 ? "error" : "errors"}:
                  </p>
                  <ul className="mt-1 list-disc pl-4">
                    {parse.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>
                        Line {e.line}: {e.message}
                      </li>
                    ))}
                    {parse.errors.length > 5 && (
                      <li>… and {parse.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              {parse.rows.length > 0 && diff && (
                <div className="rounded-xl bg-card-elevated px-4 py-3 text-xs text-fg/70 space-y-2">
                  <p>
                    Parsed{" "}
                    <span className="font-bold text-fg">
                      {parse.rows.length}
                    </span>{" "}
                    {parse.rows.length === 1 ? "row" : "rows"} —{" "}
                    <span className="font-bold text-fg">
                      {diff.unique.length} new
                    </span>
                    {diff.duplicates.length > 0 && (
                      <>
                        ,{" "}
                        <span className="font-bold text-amber-300">
                          {diff.duplicates.length} duplicate
                          {diff.duplicates.length === 1 ? "" : "s"}
                        </span>{" "}
                        already in your ledger
                      </>
                    )}
                    .
                  </p>
                  {diff.duplicates.length > 0 && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeDupes}
                        onChange={(e) => setIncludeDupes(e.target.checked)}
                        className="h-4 w-4"
                      />
                      Import duplicates anyway
                    </label>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={commitImport}
                  disabled={importable.length === 0}
                  className="flex-1 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-fg disabled:opacity-40"
                >
                  Import {importable.length}{" "}
                  {importable.length === 1 ? "row" : "rows"}
                </button>
                <button
                  type="button"
                  onClick={clearImport}
                  className="rounded-full border border-fg/15 px-5 py-2.5 text-sm font-bold text-fg/70"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
