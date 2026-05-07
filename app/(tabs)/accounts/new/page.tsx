"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import SaveButton from "@/components/forms/SaveButton";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  type AccountType,
  accountTypeOrder,
  accountTypeSingularLabels,
} from "@/lib/accounts";

// Liabilities are stored as negative balances; everything else as positive.
const LIABILITIES: AccountType[] = ["credit-card", "loan"];

export default function NewAccountPage() {
  const router = useRouter();
  const { addAccount } = useHorizonStore();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [balance, setBalance] = useState("");
  const [tracking, setTracking] = useState(false);
  const [loanApr, setLoanApr] = useState("");
  const [loanTerm, setLoanTerm] = useState("");

  const valid = name.trim() !== "" && balance !== "" && !isNaN(Number(balance));
  const isLiability = LIABILITIES.includes(type);
  const isLoan = type === "loan";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const magnitude = Math.abs(parseFloat(balance));
    const signed = isLiability ? -magnitude : magnitude;
    const apr = parseFloat(loanApr);
    const term = parseInt(loanTerm, 10);
    addAccount({
      name: name.trim(),
      type,
      balance: signed,
      ...(tracking ? { tracking: true } : {}),
      ...(isLoan && Number.isFinite(apr) && apr > 0 ? { loanApr: apr } : {}),
      ...(isLoan && Number.isFinite(term) && term > 0
        ? { loanTermMonths: term }
        : {}),
      ...(isLoan ? { loanOriginalPrincipal: magnitude } : {}),
    });
    router.push("/accounts");
  }

  return (
    <>
      <SubpageHeader title="New Account" backHref="/accounts" />

      <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
        <FormGroup>
          <FormRow label="Name" htmlFor="name">
            <TextInput
              id="name"
              type="text"
              placeholder="e.g. Chase Checking"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </FormRow>

          <FormRow label="Type" htmlFor="type">
            <Select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            >
              {accountTypeOrder.map((t) => (
                <option key={t} value={t} className="bg-card">
                  {accountTypeSingularLabels[t]}
                </option>
              ))}
            </Select>
          </FormRow>

          <FormRow
            label={isLiability ? "Balance Owed" : "Starting Balance"}
            htmlFor="balance"
          >
            <span className="flex items-center justify-end gap-1">
              <span className="text-fg/60">$</span>
              <TextInput
                id="balance"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                required
                className="max-w-[160px]"
              />
            </span>
          </FormRow>

          {isLoan && (
            <>
              <FormRow label="APR (%)" htmlFor="loan-apr">
                <TextInput
                  id="loan-apr"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={loanApr}
                  onChange={(e) => setLoanApr(e.target.value)}
                  className="max-w-[120px]"
                />
              </FormRow>
              <FormRow label="Term (months)" htmlFor="loan-term">
                <TextInput
                  id="loan-term"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  placeholder="360"
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(e.target.value)}
                  className="max-w-[120px]"
                />
              </FormRow>
            </>
          )}

          <FormRow label="Off-Budget">
            <button
              type="button"
              role="switch"
              aria-checked={tracking}
              onClick={() => setTracking((v) => !v)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                tracking ? "bg-accent" : "bg-white/20"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  tracking ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </FormRow>
        </FormGroup>

        {tracking && (
          <p className="px-2 text-xs text-fg/55">
            Off-budget accounts (investments, mortgages, asset values)
            count toward Net Worth but don&rsquo;t flow through Ready to
            Assign or category envelopes.
          </p>
        )}

        {isLiability && (
          <p className="px-2 text-xs text-fg/55">
            Enter the amount you currently owe. It will be tracked as a
            liability against your net worth.
          </p>
        )}

        <SaveButton label="Add Account" disabled={!valid} />
      </form>
    </>
  );
}
