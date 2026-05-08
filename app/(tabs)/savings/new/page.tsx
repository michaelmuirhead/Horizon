"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import SaveButton from "@/components/forms/SaveButton";
import { useHorizonStore } from "@/components/store/HorizonStore";

export default function NewSavingsGoalPage() {
  const router = useRouter();
  const { addSavingsGoal } = useHorizonStore();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const valid = name.trim() !== "" && parseFloat(targetAmount) > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    addSavingsGoal({
      name: name.trim(),
      targetAmount: parseFloat(targetAmount),
      ...(emoji.trim() ? { emoji: emoji.trim() } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    router.push("/savings");
  }

  return (
    <>
      <SubpageHeader title="New Savings Goal" backHref="/savings" />
      <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
        <FormGroup>
          <FormRow label="Name" htmlFor="goal-name">
            <TextInput
              id="goal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vacation to Spain"
              required
              autoComplete="off"
            />
          </FormRow>
          <FormRow label="Emoji" htmlFor="goal-emoji">
            <TextInput
              id="goal-emoji"
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🏖️"
              maxLength={4}
              className="max-w-[80px]"
            />
          </FormRow>
          <FormRow label="Target" htmlFor="goal-target">
            <span className="flex items-center justify-end gap-1">
              <span className="text-fg/60">$</span>
              <TextInput
                id="goal-target"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="0.00"
                required
                className="max-w-[160px]"
              />
            </span>
          </FormRow>
          <FormRow label="Due Date" htmlFor="goal-due">
            <TextInput
              id="goal-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="max-w-[180px]"
            />
          </FormRow>
          <FormRow label="Notes" htmlFor="goal-notes">
            <TextInput
              id="goal-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
            />
          </FormRow>
        </FormGroup>

        <p className="px-2 text-xs text-fg/55">
          Open the goal after creating it to log deposits and withdrawals.
        </p>

        <SaveButton label="Create Goal" disabled={!valid} />
      </form>
    </>
  );
}
