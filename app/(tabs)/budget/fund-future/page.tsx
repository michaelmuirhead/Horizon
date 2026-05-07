"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import SaveButton from "@/components/forms/SaveButton";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  getAssigned,
  monthKeyOf,
  shiftMonthKey,
} from "@/lib/budget";
import { formatCurrency } from "@/lib/format";

const labelFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function labelFromMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return labelFmt.format(new Date(y, m - 1, 1));
}

export default function FundFuturePage() {
  return (
    <Suspense fallback={null}>
      <FundFutureForm />
    </Suspense>
  );
}

function FundFutureForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { groups, assignments, setAssignment } = useHorizonStore();

  const allCategories = useMemo(
    () => groups.flatMap((g) => g.categories.filter((c) => !c.hidden)),
    [groups],
  );
  const preselect = searchParams.get("category") ?? "";

  const now = new Date();
  const currentMonthKey = monthKeyOf(now.getFullYear(), now.getMonth());

  // Offer the next 12 months (skipping the current month — that's the regular
  // budget tab flow).
  const monthOptions = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    let key = currentMonthKey;
    for (let i = 0; i < 12; i++) {
      key = shiftMonthKey(key, 1);
      out.push({ key, label: labelFromMonthKey(key) });
    }
    return out;
  }, [currentMonthKey]);

  const [categoryId, setCategoryId] = useState<string>(
    allCategories.some((c) => c.id === preselect)
      ? preselect
      : (allCategories[0]?.id ?? ""),
  );
  const [monthKey, setMonthKey] = useState<string>(monthOptions[0]?.key ?? "");
  const [amount, setAmount] = useState<string>("");

  const parsed = parseFloat(amount);
  const valid = categoryId !== "" && monthKey !== "" && parsed > 0;
  const existing = categoryId
    ? getAssigned(assignments, monthKey, categoryId)
    : 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setAssignment(monthKey, categoryId, existing + parsed);
    router.push("/budget");
  }

  if (allCategories.length === 0) {
    return (
      <>
        <SubpageHeader title="Fund Future Month" backHref="/budget" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">No categories available.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <SubpageHeader title="Fund Future Month" backHref="/budget" />
      <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
        <FormGroup>
          <FormRow label="Category" htmlFor="ff-category">
            <Select
              id="ff-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {groups.map((g) => {
                const cats = g.categories.filter((c) => !c.hidden);
                if (cats.length === 0) return null;
                return (
                  <optgroup key={g.id} label={g.name} className="bg-card">
                    {cats.map((c) => (
                      <option key={c.id} value={c.id} className="bg-card">
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          </FormRow>

          <FormRow label="Month" htmlFor="ff-month">
            <Select
              id="ff-month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
            >
              {monthOptions.map((m) => (
                <option key={m.key} value={m.key} className="bg-card">
                  {m.label}
                </option>
              ))}
            </Select>
          </FormRow>

          <FormRow label="Already Assigned">
            <span className="tabular-nums text-fg/70">
              {formatCurrency(existing)}
            </span>
          </FormRow>

          <FormRow label="Add" htmlFor="ff-amount">
            <span className="flex items-center justify-end gap-1">
              <span className="text-fg/60">$</span>
              <TextInput
                id="ff-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="max-w-[160px]"
              />
            </span>
          </FormRow>
        </FormGroup>

        <SaveButton label="Fund Month" disabled={!valid} />
      </form>
    </>
  );
}
