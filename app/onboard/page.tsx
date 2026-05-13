"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass } from "lucide-react";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  type AccountType,
  accountTypeOrder,
  accountTypeSingularLabels,
} from "@/lib/accounts";

const SUPPORTED_CURRENCIES = [
  ["USD", "United States dollar"],
  ["EUR", "Euro"],
  ["GBP", "British pound"],
  ["CAD", "Canadian dollar"],
  ["AUD", "Australian dollar"],
  ["JPY", "Japanese yen"],
] as const;

type Step = "welcome" | "currency" | "account" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const { settings, setSettings, addAccount } = useHorizonStore();

  const [step, setStep] = useState<Step>("welcome");
  const [currency, setCurrency] = useState(settings.currency);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("checking");
  const [accountBalance, setAccountBalance] = useState("");

  function complete() {
    setSettings({
      ...settings,
      currency,
      onboardingCompleted: true,
    });
    // Use the Next router instead of a hard reload — a reload races against
    // the store's persist effect (which writes onboardingCompleted to
    // localStorage), and the gate would redirect right back to /onboard.
    router.replace("/");
  }

  function handleSubmitAccount(e: FormEvent) {
    e.preventDefault();
    const trimmed = accountName.trim();
    const balance = parseFloat(accountBalance);
    if (trimmed === "" || !Number.isFinite(balance)) return;
    const isLiability =
      accountType === "credit-card" ||
      accountType === "loan" ||
      accountType === "bill";
    addAccount({
      name: trimmed,
      type: accountType,
      balance: isLiability ? -Math.abs(balance) : Math.abs(balance),
    });
    setStep("done");
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),24px)] pb-10">
      {step === "welcome" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-gradient-from to-gradient-to text-fg">
            <Compass size={40} strokeWidth={2.2} />
          </span>
          <h1 className="text-3xl font-extrabold">Welcome to Horizon</h1>
          <p className="max-w-xs text-base text-fg/75">
            A YNAB-style budget plus a Fudget-style ledger, in one PWA. Three
            quick taps and you&rsquo;re set.
          </p>
          <button
            type="button"
            onClick={() => setStep("currency")}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-bold text-fg"
          >
            Get started
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={complete}
            className="text-xs font-semibold text-fg/55"
          >
            Skip for now
          </button>
        </div>
      )}

      {step === "currency" && (
        <div className="flex flex-1 flex-col">
          <h1 className="text-2xl font-extrabold">What currency do you use?</h1>
          <p className="mt-2 text-sm text-fg/70">
            You can change this later in Settings.
          </p>
          <div className="mt-6">
            <FormGroup>
              <FormRow label="Currency" htmlFor="onboard-currency">
                <Select
                  id="onboard-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {SUPPORTED_CURRENCIES.map(([code, name]) => (
                    <option key={code} value={code} className="bg-card">
                      {code} — {name}
                    </option>
                  ))}
                </Select>
              </FormRow>
            </FormGroup>
          </div>
          <div className="mt-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("welcome")}
              className="text-sm font-semibold text-fg/55"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("account")}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-base font-bold text-fg"
            >
              Next
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}

      {step === "account" && (
        <form onSubmit={handleSubmitAccount} className="flex flex-1 flex-col">
          <h1 className="text-2xl font-extrabold">Add your first account</h1>
          <p className="mt-2 text-sm text-fg/70">
            We&rsquo;ll keep the seeded USAA account too — feel free to delete
            it later.
          </p>
          <div className="mt-6">
            <FormGroup>
              <FormRow label="Name" htmlFor="onboard-name">
                <TextInput
                  id="onboard-name"
                  type="text"
                  placeholder="e.g. Chase Checking"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  required
                />
              </FormRow>
              <FormRow label="Type" htmlFor="onboard-type">
                <Select
                  id="onboard-type"
                  value={accountType}
                  onChange={(e) =>
                    setAccountType(e.target.value as AccountType)
                  }
                >
                  {accountTypeOrder.map((t) => (
                    <option key={t} value={t} className="bg-card">
                      {accountTypeSingularLabels[t]}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Balance" htmlFor="onboard-balance">
                <span className="flex items-center justify-end gap-1">
                  <span className="text-fg/60">$</span>
                  <TextInput
                    id="onboard-balance"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="0.00"
                    value={accountBalance}
                    onChange={(e) => setAccountBalance(e.target.value)}
                    required
                    className="max-w-[160px]"
                  />
                </span>
              </FormRow>
            </FormGroup>
          </div>
          <div className="mt-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("done")}
              className="text-sm font-semibold text-fg/55"
            >
              Skip
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-base font-bold text-fg"
            >
              Add account
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-3xl font-extrabold">You&rsquo;re set</h1>
          <p className="max-w-xs text-base text-fg/75">
            Open the Budget tab to assign every dollar a job, or jump in to
            Spending to start logging.
          </p>
          <button
            type="button"
            onClick={complete}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-bold text-fg"
          >
            Go to Horizon
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}
