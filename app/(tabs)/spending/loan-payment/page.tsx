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
  ASSET_ACCOUNT_TYPES,
  liveAccountBalance,
} from "@/lib/accounts";
import { allCategoryNames } from "@/lib/budget";
import { monthlyPayment, splitLoanPayment } from "@/lib/loans";
import { formatCurrency } from "@/lib/format";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LoanPaymentPage() {
  return (
    <Suspense fallback={null}>
      <LoanPaymentForm />
    </Suspense>
  );
}

function LoanPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accounts, transactions, groups, addTransfer, addTransaction } =
    useHorizonStore();

  const loans = accounts.filter((a) => a.type === "loan" && !a.closed);
  const sources = accounts.filter(
    (a) => ASSET_ACCOUNT_TYPES.has(a.type) && !a.closed,
  );
  const categoryNames = allCategoryNames(groups);
  const guessedInterestCategory =
    categoryNames.find((n) => /interest/i.test(n)) ??
    categoryNames.find((n) => /loan|debt/i.test(n)) ??
    categoryNames[0] ??
    "";

  const loanIdParam = searchParams.get("loan") ?? "";
  const initialLoanId = loans.find((a) => a.id === loanIdParam)
    ? loanIdParam
    : (loans[0]?.id ?? "");

  const [loanId, setLoanId] = useState<string>(initialLoanId);
  const [sourceId, setSourceId] = useState<string>(sources[0]?.id ?? "");
  const [date, setDate] = useState<string>(todayIso());
  const [interestCategory, setInterestCategory] = useState<string>(
    guessedInterestCategory,
  );
  const [cleared, setCleared] = useState<boolean>(true);

  const loan = loans.find((a) => a.id === loanId);
  const source = sources.find((a) => a.id === sourceId);
  const outstanding = loan ? Math.abs(liveAccountBalance(loan, transactions)) : 0;
  const apr = loan?.loanApr ?? 0;
  const term = loan?.loanTermMonths ?? 0;
  const principalAtOpen = loan?.loanOriginalPrincipal ?? outstanding;
  const suggested = monthlyPayment(principalAtOpen, apr, term);

  const [amount, setAmount] = useState<string>(
    suggested > 0 ? suggested.toFixed(2) : "",
  );

  const parsed = parseFloat(amount);
  const split = useMemo(() => {
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { interest: 0, principal: 0 };
    }
    return splitLoanPayment(outstanding, apr, parsed);
  }, [parsed, outstanding, apr]);

  const valid =
    Boolean(loan) &&
    Boolean(source) &&
    parsed > 0 &&
    interestCategory !== "" &&
    split.principal >= 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || !loan || !source) return;
    // Two writes: a transfer of the principal portion (which reduces the
    // loan's outstanding balance) and a regular outflow for the interest
    // (which lands in a real budget category).
    if (split.principal > 0) {
      addTransfer({
        date,
        fromAccount: source.name,
        toAccount: loan.name,
        amount: split.principal,
        cleared,
        memo: `Loan payment principal (${loan.name})`,
      });
    }
    if (split.interest > 0) {
      addTransaction({
        date,
        payee: `${loan.name} Interest`,
        category: interestCategory,
        account: source.name,
        amount: -split.interest,
        cleared,
        memo: `Loan payment interest (${loan.name})`,
      });
    }
    router.push("/spending");
  }

  if (loans.length === 0) {
    return (
      <>
        <SubpageHeader title="Loan Payment" backHref="/spending" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">
            Add a loan account first — set its APR and term so we can split
            payments between principal and interest.
          </p>
        </div>
      </>
    );
  }

  if (sources.length === 0) {
    return (
      <>
        <SubpageHeader title="Loan Payment" backHref="/spending" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">
            You need a checking, savings, or cash account to pay from.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <SubpageHeader title="Loan Payment" backHref="/spending" />
      <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
        <FormGroup>
          <FormRow label="Loan" htmlFor="loan-account">
            <Select
              id="loan-account"
              value={loanId}
              onChange={(e) => setLoanId(e.target.value)}
            >
              {loans.map((a) => (
                <option key={a.id} value={a.id} className="bg-card">
                  {a.name}
                </option>
              ))}
            </Select>
          </FormRow>

          <FormRow label="Outstanding">
            <span className="tabular-nums text-fg/70">
              {formatCurrency(outstanding)}
            </span>
          </FormRow>

          <FormRow label="Pay from" htmlFor="loan-source">
            <Select
              id="loan-source"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              {sources.map((a) => (
                <option key={a.id} value={a.id} className="bg-card">
                  {a.name}
                </option>
              ))}
            </Select>
          </FormRow>

          <FormRow label="Date" htmlFor="loan-date">
            <TextInput
              id="loan-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </FormRow>

          <FormRow label="Amount" htmlFor="loan-amount">
            <span className="flex items-center justify-end gap-1">
              <span className="text-fg/60">$</span>
              <TextInput
                id="loan-amount"
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

          {suggested > 0 && (
            <FormRow label="Suggested">
              <button
                type="button"
                onClick={() => setAmount(suggested.toFixed(2))}
                className="text-accent text-sm font-bold tabular-nums"
              >
                {formatCurrency(suggested)}
              </button>
            </FormRow>
          )}

          <FormRow label="Interest goes to" htmlFor="loan-interest-cat">
            <Select
              id="loan-interest-cat"
              value={interestCategory}
              onChange={(e) => setInterestCategory(e.target.value)}
            >
              {categoryNames.map((name) => (
                <option key={name} value={name} className="bg-card">
                  {name}
                </option>
              ))}
            </Select>
          </FormRow>

          <FormRow label="Cleared">
            <button
              type="button"
              role="switch"
              aria-checked={cleared}
              onClick={() => setCleared((v) => !v)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                cleared ? "bg-emerald-500" : "bg-white/20"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  cleared ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </FormRow>
        </FormGroup>

        <div className="rounded-2xl bg-card p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/55">
            Auto-split preview
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-y-1.5">
            <dt className="text-fg/55">Principal → {loan?.name ?? "loan"}</dt>
            <dd className="text-right font-semibold tabular-nums">
              {formatCurrency(split.principal)}
            </dd>
            <dt className="text-fg/55">
              Interest → {interestCategory || "category"}
            </dt>
            <dd className="text-right font-semibold tabular-nums text-rose-300">
              {formatCurrency(split.interest)}
            </dd>
          </dl>
          <p className="mt-2 text-[11px] text-fg/45">
            Interest = current balance × APR ÷ 12. Principal absorbs the rest.
          </p>
        </div>

        <SaveButton label="Record Loan Payment" disabled={!valid} />
      </form>
    </>
  );
}
