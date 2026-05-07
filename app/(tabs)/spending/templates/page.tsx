"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import SegmentedField from "@/components/forms/SegmentedField";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { allCategoryNames, READY_TO_ASSIGN_CATEGORY } from "@/lib/budget";
import { formatCurrency } from "@/lib/format";
import type { TransactionTemplateDirection } from "@/lib/templates";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TransactionTemplatesPage() {
  const router = useRouter();
  const {
    templates,
    accounts,
    groups,
    addTemplate,
    deleteTemplate,
    addTransaction,
  } = useHorizonStore();
  const openAccounts = accounts.filter((a) => !a.closed);
  const categoryNames = allCategoryNames(groups);

  const [name, setName] = useState("");
  const [payee, setPayee] = useState("");
  const [direction, setDirection] = useState<TransactionTemplateDirection>("outflow");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(categoryNames[0] ?? "");
  const [accountName, setAccountName] = useState<string>(
    openAccounts[0]?.name ?? "",
  );

  const valid =
    name.trim() !== "" &&
    payee.trim() !== "" &&
    parseFloat(amount) > 0 &&
    accountName !== "";

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    addTemplate({
      name: name.trim(),
      payee: payee.trim(),
      direction,
      amount: parseFloat(amount),
      category: direction === "inflow" ? READY_TO_ASSIGN_CATEGORY : category,
      account: accountName,
    });
    setName("");
    setPayee("");
    setAmount("");
  }

  function logFromTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const signed = t.direction === "inflow" ? t.amount : -t.amount;
    addTransaction({
      date: todayIso(),
      payee: t.payee,
      category: t.category,
      account: t.account ?? openAccounts[0]?.name ?? "",
      amount: signed,
      cleared: true,
      memo: t.memo,
      tags: t.tags,
      isReadyToAssign: t.direction === "inflow",
    });
    router.push("/spending");
  }

  return (
    <>
      <SubpageHeader title="Templates" backHref="/spending" />
      <div className="px-4 pt-2 pb-10 space-y-4">
        <p className="px-2 text-xs text-fg/55">
          Save common transactions once and tap to log them in a single
          motion. Each tap creates a fresh transaction dated today, marked
          cleared.
        </p>

        {templates.length > 0 && (
          <ul className="divide-y divide-fg/5 border-y border-fg/5">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 bg-card px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => logFromTemplate(t.id)}
                  aria-label={`Log ${t.name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-fg"
                >
                  <Zap size={16} strokeWidth={2.4} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold truncate">{t.name}</p>
                  <p className="mt-0.5 text-xs text-fg/55 truncate">
                    {t.payee} · {t.category}
                  </p>
                </div>
                <span
                  className={`text-base font-bold tabular-nums shrink-0 ${
                    t.direction === "inflow" ? "text-emerald-400" : "text-fg"
                  }`}
                >
                  {t.direction === "inflow" ? "+" : "−"}
                  {formatCurrency(t.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => deleteTemplate(t.id)}
                  aria-label={`Delete template ${t.name}`}
                  className="grid h-8 w-8 place-items-center rounded-full text-rose-400/80"
                >
                  <Trash2 size={14} strokeWidth={2.4} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="space-y-2">
          <SegmentedField<TransactionTemplateDirection>
            value={direction}
            onChange={setDirection}
            options={[
              { value: "outflow", label: "Outflow" },
              { value: "inflow", label: "Inflow" },
            ]}
          />
          <FormGroup>
            <FormRow label="Template name" htmlFor="tpl-name">
              <TextInput
                id="tpl-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Coffee at Joe's"
                required
                autoComplete="off"
              />
            </FormRow>
            <FormRow label="Payee" htmlFor="tpl-payee">
              <TextInput
                id="tpl-payee"
                type="text"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                required
                autoComplete="off"
              />
            </FormRow>
            <FormRow label="Amount" htmlFor="tpl-amount">
              <span className="flex items-center justify-end gap-1">
                <span className="text-fg/60">$</span>
                <TextInput
                  id="tpl-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="max-w-[140px]"
                />
              </span>
            </FormRow>
            {direction === "outflow" && (
              <FormRow label="Category" htmlFor="tpl-cat">
                <Select
                  id="tpl-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categoryNames.map((n) => (
                    <option key={n} value={n} className="bg-card">
                      {n}
                    </option>
                  ))}
                </Select>
              </FormRow>
            )}
            <FormRow label="Account" htmlFor="tpl-account">
              <Select
                id="tpl-account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              >
                {openAccounts.map((a) => (
                  <option key={a.id} value={a.name} className="bg-card">
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormRow>
          </FormGroup>
          <button
            type="submit"
            disabled={!valid}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-fg disabled:opacity-40"
          >
            <Plus size={16} strokeWidth={2.5} />
            Save template
          </button>
        </form>

        {templates.length === 0 && (
          <Link
            href="/spending"
            className="block text-center text-xs font-bold text-accent"
          >
            Back to Spending
          </Link>
        )}
      </div>
    </>
  );
}
