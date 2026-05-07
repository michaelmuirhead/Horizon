"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Heart, Plus } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import WishlistRow from "@/components/wishlist/WishlistRow";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  sortActive,
  sortPurchased,
  totalCost,
  type WishlistPriority,
} from "@/lib/wishlist";
import { formatCurrency } from "@/lib/format";

export default function WishlistPage() {
  const { wishlist, addWishlistItem } = useHorizonStore();
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [priority, setPriority] = useState<WishlistPriority>("medium");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const active = sortActive(wishlist);
  const purchased = sortPurchased(wishlist);
  const remaining = totalCost(active);

  const valid = name.trim() !== "" && parseFloat(cost) > 0;

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    addWishlistItem({
      name: name.trim(),
      cost: parseFloat(cost),
      priority,
      url: url.trim() === "" ? undefined : url.trim(),
      notes: notes.trim() === "" ? undefined : notes.trim(),
    });
    setName("");
    setCost("");
    setPriority("medium");
    setUrl("");
    setNotes("");
    setFormOpen(false);
  }

  return (
    <>
      <SubpageHeader title="Wishlist" backHref="/" />
      <div className="px-4 pt-2">
        <div className="rounded-3xl bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
            <Heart size={11} className="inline mr-1" /> Wishing for
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {formatCurrency(remaining)}
          </p>
          <p className="mt-1 text-xs text-fg/55">
            {active.length === 0
              ? "Add something you're saving up for."
              : `${active.length} ${active.length === 1 ? "item" : "items"} on the list`}
          </p>
        </div>

        <div className="mt-3">
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-fg"
            >
              <Plus size={16} strokeWidth={2.5} />
              Add wish
            </button>
          ) : (
            <form onSubmit={handleAdd} className="space-y-3">
              <FormGroup>
                <FormRow label="Item" htmlFor="wish-name">
                  <TextInput
                    id="wish-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What do you want?"
                    required
                    autoComplete="off"
                  />
                </FormRow>
                <FormRow label="Estimated cost" htmlFor="wish-cost">
                  <span className="flex items-center justify-end gap-1">
                    <span className="text-fg/60">$</span>
                    <TextInput
                      id="wish-cost"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      placeholder="0.00"
                      required
                      className="max-w-[140px]"
                    />
                  </span>
                </FormRow>
                <FormRow label="Priority" htmlFor="wish-priority">
                  <Select
                    id="wish-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as WishlistPriority)}
                  >
                    <option value="high" className="bg-card">High</option>
                    <option value="medium" className="bg-card">Medium</option>
                    <option value="low" className="bg-card">Low</option>
                  </Select>
                </FormRow>
                <FormRow label="Link" htmlFor="wish-url">
                  <TextInput
                    id="wish-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Optional"
                    autoComplete="off"
                  />
                </FormRow>
                <FormRow label="Notes" htmlFor="wish-notes">
                  <TextInput
                    id="wish-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                    autoComplete="off"
                  />
                </FormRow>
              </FormGroup>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!valid}
                  className="flex-1 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-fg disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-full border border-fg/15 px-5 py-2.5 text-sm font-bold text-fg/70"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {active.length === 0 && purchased.length === 0 ? null : (
        <div className="mt-4 space-y-4 pb-10">
          {active.length > 0 && (
            <section>
              <h2 className="px-4 pb-2 text-xs font-bold uppercase tracking-wide text-fg/55">
                Want
              </h2>
              <ul className="divide-y divide-fg/5 border-y border-fg/5">
                {active.map((item) => (
                  <li key={item.id}>
                    <WishlistRow item={item} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {purchased.length > 0 && (
            <section>
              <h2 className="px-4 pb-2 text-xs font-bold uppercase tracking-wide text-fg/55">
                Got it
              </h2>
              <ul className="divide-y divide-fg/5 border-y border-fg/5">
                {purchased.map((item) => (
                  <li key={item.id}>
                    <WishlistRow item={item} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
