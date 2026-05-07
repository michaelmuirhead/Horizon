"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import SaveButton from "@/components/forms/SaveButton";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  categoryAvailable,
  ccPaymentRouting,
  getAssigned,
  monthKeyOf,
  readyToAssignAmount,
} from "@/lib/budget";
import { formatCurrency } from "@/lib/format";

const RTA_ID = "__rta__";
const RTA_LABEL = "Ready to Assign";

export default function MoveMoneyPage() {
  return (
    <Suspense fallback={null}>
      <MoveMoneyForm />
    </Suspense>
  );
}

function MoveMoneyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { groups, accounts, assignments, transactions, setAssignment } =
    useHorizonStore();
  const allCategories = groups.flatMap((g) =>
    g.categories.filter((c) => !c.hidden),
  );
  const ccCtx = ccPaymentRouting(accounts, groups);

  const now = new Date();
  const defaultMonthKey = monthKeyOf(now.getFullYear(), now.getMonth());
  const monthKey = searchParams.get("month") ?? defaultMonthKey;

  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";
  const amountParam = searchParams.get("amount") ?? "";
  const fromMatched =
    fromParam === RTA_ID || allCategories.some((c) => c.id === fromParam);
  const toMatched =
    toParam === RTA_ID || allCategories.some((c) => c.id === toParam);
  const initialToId = toMatched
    ? toParam
    : (allCategories.find((c) => c.id !== fromParam)?.id ?? "");
  const initialFromId = fromMatched
    ? fromParam
    : (allCategories.find((c) => c.id !== initialToId)?.id ?? "");

  const [fromId, setFromId] = useState<string>(initialFromId);
  const [toId, setToId] = useState<string>(initialToId);
  const [amount, setAmount] = useState<string>(
    amountParam !== "" && Number.isFinite(parseFloat(amountParam))
      ? amountParam
      : "",
  );

  const fromIsRta = fromId === RTA_ID;
  const toIsRta = toId === RTA_ID;
  const fromCategory = !fromIsRta
    ? allCategories.find((c) => c.id === fromId)
    : undefined;
  const rta = readyToAssignAmount(transactions, assignments, groups, ccCtx);
  const fromAvailable = fromIsRta
    ? rta
    : fromCategory
      ? categoryAvailable(
          fromCategory,
          assignments,
          transactions,
          monthKey,
          ccCtx,
        )
      : 0;
  const maxMoveable = Math.max(0, fromAvailable);
  const parsed = parseFloat(amount);
  const valid =
    fromId !== "" &&
    toId !== "" &&
    fromId !== toId &&
    parsed > 0 &&
    parsed <= maxMoveable;
  const overMax =
    Number.isFinite(parsed) && parsed > 0 && parsed > maxMoveable;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    if (fromIsRta && !toIsRta) {
      // Pulling from RTA into a category just adds to the destination's
      // assignment for the month — RTA is the residual, no separate write.
      const to = getAssigned(assignments, monthKey, toId);
      setAssignment(monthKey, toId, to + parsed);
    } else if (!fromIsRta && toIsRta) {
      // Returning money to RTA decreases the source's assignment for the
      // month; the residual flows back into RTA automatically.
      const from = getAssigned(assignments, monthKey, fromId);
      setAssignment(monthKey, fromId, from - parsed);
    } else {
      // Two real categories: existing two-way swap.
      const from = getAssigned(assignments, monthKey, fromId);
      const to = getAssigned(assignments, monthKey, toId);
      setAssignment(monthKey, fromId, from - parsed);
      setAssignment(monthKey, toId, to + parsed);
    }
    router.push("/budget");
  }

  return (
    <>
      <SubpageHeader title="Move Money" backHref="/budget" />
      <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
        <FormGroup>
          <FormRow label="From" htmlFor="move-from">
            <Select
              id="move-from"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              <option value={RTA_ID} className="bg-card">
                {RTA_LABEL}
              </option>
              {groups.map((g) => {
                const cats = g.categories.filter(
                  (c) => !c.hidden && c.id !== toId,
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
          </FormRow>

          <FormRow label="Available">
            <span
              className={`tabular-nums ${
                fromAvailable < 0 ? "text-rose-400" : "text-fg/70"
              }`}
            >
              {formatCurrency(fromAvailable)}
            </span>
          </FormRow>

          <FormRow label="To" htmlFor="move-to">
            <Select
              id="move-to"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              {fromId !== RTA_ID && (
                <option value={RTA_ID} className="bg-card">
                  {RTA_LABEL}
                </option>
              )}
              {groups.map((g) => {
                const cats = g.categories.filter(
                  (c) => !c.hidden && c.id !== fromId,
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
          </FormRow>

          <FormRow label="Amount" htmlFor="move-amount">
            <span className="flex items-center justify-end gap-1">
              <span className="text-fg/60">$</span>
              <TextInput
                id="move-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max={maxMoveable}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="max-w-[160px]"
              />
            </span>
          </FormRow>
        </FormGroup>

        <p
          className={`px-2 text-xs ${
            overMax ? "text-amber-400" : "text-fg/55"
          }`}
        >
          {overMax
            ? `Source only has ${formatCurrency(maxMoveable)} available.`
            : fromIsRta
              ? `Up to ${formatCurrency(maxMoveable)} can move from Ready to Assign.`
              : `Up to ${formatCurrency(maxMoveable)} can move from this category.`}
        </p>

        <SaveButton label="Move Money" disabled={!valid} />
      </form>
    </>
  );
}
