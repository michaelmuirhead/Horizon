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
  const { groups, targets, setTarget, addCategory } = useHorizonStore();

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
  const initialCategoryName =
    allCategories.find((c) => c.id === initialCategoryId)?.name ?? "";

  // Free-text category field. When the typed name matches an existing
  // category we keep `categoryId` pointing at it and the target attaches
  // there; when it doesn't match, `categoryId` is "" and we'll mint a
  // new category on submit (placed in `newCategoryGroupId`).
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [categoryName, setCategoryName] = useState<string>(initialCategoryName);
  const firstVisibleGroupId =
    groups.find((g) => g.categories.length > 0)?.id ??
    groups[0]?.id ??
    "";
  const [newCategoryGroupId, setNewCategoryGroupId] =
    useState<string>(firstVisibleGroupId);
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

  // When the typed name exactly matches an existing category (case-
  // insensitive), lock onto that id and preload its target. Anything
  // else is treated as a new category to be created on submit.
  function handleCategoryNameChange(next: string) {
    setCategoryName(next);
    const trimmedLower = next.trim().toLowerCase();
    const match = allCategories.find(
      (c) => c.name.toLowerCase() === trimmedLower,
    );
    if (match) {
      setCategoryId(match.id);
      const t = targets[match.id];
      if (t) {
        setKind(t.kind);
        setAmount(t.amount.toString());
        setPaused(t.paused === true);
        setAutoFund(t.autoFund === true);
        if (t.kind === "set-aside") setCadence(t.cadence);
        if (t.kind === "by-date") setDueDate(t.dueDate);
      }
    } else {
      setCategoryId("");
    }
  }

  const parsed = parseFloat(amount);
  const trimmedName = categoryName.trim();
  const isNewCategory = trimmedName !== "" && categoryId === "";
  const valid =
    trimmedName !== "" &&
    Number.isFinite(parsed) &&
    parsed > 0 &&
    (categoryId !== "" || newCategoryGroupId !== "");

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
    // Mint a fresh category on the fly if the user typed a name that
    // doesn't yet exist. addCategory returns the new id so the target
    // can be wired up in the same submit handler.
    const resolvedId =
      categoryId !== ""
        ? categoryId
        : addCategory(newCategoryGroupId, trimmedName);
    setTarget(resolvedId, target);
    router.push("/budget");
  }

  return (
    <>
      <SubpageHeader
        title={existing ? "Edit Target" : "Add Target"}
        backHref="/budget"
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
            <TextInput
              id="target-category"
              type="text"
              value={categoryName}
              onChange={(e) => handleCategoryNameChange(e.target.value)}
              placeholder="Type or pick a category"
              list="target-category-options"
              autoComplete="off"
              required
            />
            {/* Native datalist gives free typing + autocomplete from
                existing categories without forcing a value-must-match
                constraint. New names fall through to the create-on-
                submit path below. */}
            <datalist id="target-category-options">
              {allCategories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </FormRow>

          {isNewCategory && groups.length > 0 && (
            <FormRow label="Add to group" htmlFor="target-new-group">
              <Select
                id="target-new-group"
                value={newCategoryGroupId}
                onChange={(e) => setNewCategoryGroupId(e.target.value)}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id} className="bg-card">
                    {g.name}
                  </option>
                ))}
              </Select>
            </FormRow>
          )}

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
              router.push("/budget");
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
