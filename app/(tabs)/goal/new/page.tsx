"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import SegmentedField from "@/components/forms/SegmentedField";
import SaveButton from "@/components/forms/SaveButton";
import { useHorizonStore } from "@/components/store/HorizonStore";
import type { Cadence, CategoryTarget } from "@/lib/budget";

type Kind = "set-aside" | "refill" | "spending" | "by-date";

function todayPlusMonthsIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  d.setDate(1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const KIND_HELPER: Record<Kind, string> = {
  "set-aside": "Set aside this amount on the chosen cadence.",
  refill: "Refill the category up to this amount each month.",
  spending: "Plan to spend this much each month — we'll track actuals.",
  "by-date": "Save up to this amount by the due date.",
};

const KIND_AMOUNT_LABEL: Record<Kind, string> = {
  "set-aside": "Amount",
  refill: "Refill To",
  spending: "Per Month",
  "by-date": "Goal",
};

export default function NewTargetPage() {
  return (
    <Suspense fallback={null}>
      <NewTargetForm />
    </Suspense>
  );
}

function NewTargetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectId = searchParams.get("category") ?? "";
  const { groups, targets, setTarget } = useHorizonStore();

  // Skip hidden categories in the picker, but keep showing whichever
  // category the editor was opened against (e.g. via deep-link).
  const allCategories = groups.flatMap((g) =>
    g.categories.filter((c) => !c.hidden || c.id === preselectId),
  );
  const initialCategoryId =
    preselectId !== "" && allCategories.some((c) => c.id === preselectId)
      ? preselectId
      : (allCategories[0]?.id ?? "");
  const initialTarget = targets[initialCategoryId];

  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [kind, setKind] = useState<Kind>(initialTarget?.kind ?? "set-aside");
  const [cadence, setCadence] = useState<Cadence>(
    initialTarget && initialTarget.kind === "set-aside"
      ? initialTarget.cadence
      : "monthly",
  );
  const [amount, setAmount] = useState<string>(
    initialTarget ? initialTarget.amount.toString() : "",
  );
  const [dueDate, setDueDate] = useState<string>(
    initialTarget && initialTarget.kind === "by-date"
      ? initialTarget.dueDate
      : todayPlusMonthsIso(6),
  );
  const [paused, setPaused] = useState<boolean>(
    initialTarget?.paused === true,
  );
  const [autoFund, setAutoFund] = useState<boolean>(
    initialTarget?.autoFund === true,
  );

  const existing = categoryId ? targets[categoryId] : undefined;

  function handleCategoryChange(nextId: string) {
    setCategoryId(nextId);
    const t = targets[nextId];
    if (t) {
      setKind(t.kind);
      setAmount(t.amount.toString());
      setPaused(t.paused === true);
      setAutoFund(t.autoFund === true);
      if (t.kind === "set-aside") setCadence(t.cadence);
      if (t.kind === "by-date") setDueDate(t.dueDate);
    }
  }

  const parsed = parseFloat(amount);
  const valid =
    categoryId !== "" && Number.isFinite(parsed) && parsed > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const flags = {
      ...(paused ? { paused: true as const } : {}),
      ...(autoFund ? { autoFund: true as const } : {}),
    };
    let target: CategoryTarget;
    if (kind === "set-aside") {
      target = { kind: "set-aside", amount: parsed, cadence, ...flags };
    } else if (kind === "refill") {
      target = { kind: "refill", amount: parsed, ...flags };
    } else if (kind === "spending") {
      target = { kind: "spending", amount: parsed, ...flags };
    } else {
      target = { kind: "by-date", amount: parsed, dueDate, ...flags };
    }
    setTarget(categoryId, target);
    router.push("/");
  }

  return (
    <>
      <SubpageHeader
        title={existing ? "Edit Target" : "Add Target"}
        backHref="/"
      />
      <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
        <SegmentedField<Kind>
          value={kind}
          onChange={setKind}
          options={[
            { value: "set-aside", label: "Save" },
            { value: "spending", label: "Spend" },
            { value: "refill", label: "Refill" },
            { value: "by-date", label: "By Date" },
          ]}
        />

        <FormGroup>
          <FormRow label="Category" htmlFor="target-category">
            {allCategories.length === 0 ? (
              <span className="text-fg/55">No categories</span>
            ) : (
              <Select
                id="target-category"
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                {groups.map((g) => {
                  const cats = g.categories.filter(
                    (c) => !c.hidden || c.id === preselectId,
                  );
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
            )}
          </FormRow>

          <FormRow label={KIND_AMOUNT_LABEL[kind]} htmlFor="target-amount">
            <span className="flex items-center justify-end gap-1">
              <span className="text-fg/60">$</span>
              <TextInput
                id="target-amount"
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

          {kind === "set-aside" && (
            <FormRow label="Cadence" htmlFor="target-cadence">
              <Select
                id="target-cadence"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as Cadence)}
              >
                <option value="weekly" className="bg-card">
                  Every week
                </option>
                <option value="monthly" className="bg-card">
                  Every month
                </option>
                <option value="yearly" className="bg-card">
                  Every year
                </option>
              </Select>
            </FormRow>
          )}

          {kind === "by-date" && (
            <FormRow label="By Date" htmlFor="target-due">
              <TextInput
                id="target-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </FormRow>
          )}

          <FormRow label="Auto-Fund">
            <button
              type="button"
              role="switch"
              aria-checked={autoFund}
              onClick={() => setAutoFund((v) => !v)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                autoFund ? "bg-mint" : "bg-white/20"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  autoFund ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </FormRow>

          <FormRow label="Paused">
            <button
              type="button"
              role="switch"
              aria-checked={paused}
              onClick={() => setPaused((v) => !v)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                paused ? "bg-amber-500" : "bg-white/20"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  paused ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </FormRow>
        </FormGroup>

        {autoFund && (
          <p className="px-2 text-xs text-fg/55">
            Auto-Fund tops up this category to its monthly need each time the
            app is opened in a new month.
          </p>
        )}

        <p className="px-2 text-xs text-fg/55">{KIND_HELPER[kind]}</p>

        <SaveButton
          label={existing ? "Save Target" : "Add Target"}
          disabled={!valid}
        />

        {existing && (
          <button
            type="button"
            onClick={() => {
              setTarget(categoryId, null);
              router.push("/");
            }}
            className="block w-full rounded-full border border-rose-400/40 px-5 py-3.5 text-base font-bold text-rose-400"
          >
            Clear Target
          </button>
        )}
      </form>
    </>
  );
}
