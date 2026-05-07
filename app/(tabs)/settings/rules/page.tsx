"use client";

import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  applyRules,
  ruleMatches,
  type CategorizationRule,
  type RuleMode,
} from "@/lib/categorization";
import { allCategoryNames } from "@/lib/budget";

export default function CategorizationRulesPage() {
  const {
    rules,
    groups,
    transactions,
    addRule,
    updateRule,
    deleteRule,
    reorderRules,
  } = useHorizonStore();
  const categoryNames = allCategoryNames(groups);

  const [pattern, setPattern] = useState("");
  const [mode, setMode] = useState<RuleMode>("contains");
  const [category, setCategory] = useState<string>(categoryNames[0] ?? "");
  const [previewPayee, setPreviewPayee] = useState("");

  const draftValid = pattern.trim() !== "" && category !== "";
  const previewMatch = (() => {
    if (previewPayee.trim() === "") return null;
    if (draftValid) {
      const draft: CategorizationRule = {
        id: "preview",
        pattern: pattern.trim(),
        mode,
        category,
      };
      if (ruleMatches(draft, previewPayee)) {
        return `→ ${draft.category} (this draft)`;
      }
    }
    const matched = applyRules(previewPayee, rules);
    return matched ? `→ ${matched}` : "no match";
  })();

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!draftValid) return;
    addRule({ pattern: pattern.trim(), mode, category });
    setPattern("");
  }

  function move(idx: number, delta: number) {
    const target = idx + delta;
    if (target < 0 || target >= rules.length) return;
    const ids = rules.map((r) => r.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    reorderRules(ids);
  }

  // Quick stats so the user can see how many transactions would actually
  // benefit from rules existing today (those that landed as Uncategorized).
  const uncategorizedCount = transactions.filter(
    (t) =>
      !t.isReadyToAssign &&
      !t.transferId &&
      (!t.splits || t.splits.length === 0) &&
      (t.category === "" || t.category === "Uncategorized"),
  ).length;

  return (
    <>
      <SubpageHeader title="Categorization rules" backHref="/settings" />
      <div className="px-4 pt-2 pb-10 space-y-4">
        <p className="px-2 text-xs text-fg/55">
          Rules run when a transaction is added (manually or via CSV import)
          and the category isn&rsquo;t already explicitly set. Top rule wins
          when more than one matches.
          {uncategorizedCount > 0 && (
            <>
              {" "}
              You currently have{" "}
              <span className="font-bold text-fg/85">
                {uncategorizedCount}
              </span>{" "}
              uncategorized {uncategorizedCount === 1 ? "row" : "rows"}.
            </>
          )}
        </p>

        <form onSubmit={handleAdd} className="space-y-2">
          <FormGroup>
            <FormRow label="If payee" htmlFor="rule-pattern">
              <TextInput
                id="rule-pattern"
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="kroger"
                autoComplete="off"
              />
            </FormRow>
            <FormRow label="Match" htmlFor="rule-mode">
              <Select
                id="rule-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as RuleMode)}
              >
                <option value="contains" className="bg-card">
                  Contains (case-insensitive)
                </option>
                <option value="exact" className="bg-card">
                  Equals exactly
                </option>
                <option value="regex" className="bg-card">
                  Regex
                </option>
              </Select>
            </FormRow>
            <FormRow label="Set category" htmlFor="rule-category">
              <Select
                id="rule-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categoryNames.map((name) => (
                  <option key={name} value={name} className="bg-card">
                    {name}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Test payee" htmlFor="rule-preview">
              <TextInput
                id="rule-preview"
                type="text"
                value={previewPayee}
                onChange={(e) => setPreviewPayee(e.target.value)}
                placeholder="KROGER #455"
                autoComplete="off"
              />
            </FormRow>
            {previewMatch && previewPayee.trim() !== "" && (
              <p className="px-4 pb-2 text-xs text-fg/65">{previewMatch}</p>
            )}
          </FormGroup>
          <button
            type="submit"
            disabled={!draftValid}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-fg disabled:opacity-40"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add rule
          </button>
        </form>

        {rules.length === 0 ? (
          <div className="rounded-2xl bg-card px-5 py-10 text-center text-sm text-fg/55">
            No rules yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {rules.map((r, idx) => (
              <li key={r.id} className="rounded-2xl bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">
                      <code className="rounded bg-card-elevated px-1.5 py-0.5 text-xs">
                        {r.mode}
                      </code>{" "}
                      <span className="text-fg/85">{r.pattern}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-fg/55">
                      → <span className="text-fg/85">{r.category}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                      className="grid h-8 w-8 place-items-center rounded-full bg-card-elevated disabled:opacity-30"
                    >
                      <ArrowUp size={14} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === rules.length - 1}
                      aria-label="Move down"
                      className="grid h-8 w-8 place-items-center rounded-full bg-card-elevated disabled:opacity-30"
                    >
                      <ArrowDown size={14} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRule(r.id)}
                      aria-label={`Delete ${r.pattern}`}
                      className="grid h-8 w-8 place-items-center rounded-full bg-rose-900/40 text-rose-300"
                    >
                      <Trash2 size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Select
                    value={r.category}
                    onChange={(e) =>
                      updateRule({ ...r, category: e.target.value })
                    }
                    aria-label={`Category for rule ${r.pattern}`}
                    className="flex-1"
                  >
                    {categoryNames.map((name) => (
                      <option key={name} value={name} className="bg-card">
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
