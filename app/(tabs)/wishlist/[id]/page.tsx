"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import SaveButton from "@/components/forms/SaveButton";
import { useHorizonStore } from "@/components/store/HorizonStore";
import type { WishlistPriority } from "@/lib/wishlist";

export default function EditWishlistItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const {
    wishlist,
    updateWishlistItem,
    deleteWishlistItem,
    markUndoable,
  } = useHorizonStore();
  const item = wishlist.find((w) => w.id === id);

  const [name, setName] = useState(item?.name ?? "");
  const [cost, setCost] = useState(item ? String(item.cost) : "");
  const [priority, setPriority] = useState<WishlistPriority>(
    item?.priority ?? "medium",
  );
  const [url, setUrl] = useState(item?.url ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [purchased, setPurchased] = useState(!!item?.purchasedAt);

  if (!item) {
    return (
      <>
        <SubpageHeader title="Wishlist item" backHref="/wishlist" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">Item not found.</p>
          <Link
            href="/wishlist"
            className="mt-4 inline-block text-accent text-base font-bold"
          >
            Back to Wishlist
          </Link>
        </div>
      </>
    );
  }

  const valid = name.trim() !== "" && parseFloat(cost) > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || !item) return;
    updateWishlistItem({
      ...item,
      name: name.trim(),
      cost: parseFloat(cost),
      priority,
      url: url.trim() === "" ? undefined : url.trim(),
      notes: notes.trim() === "" ? undefined : notes.trim(),
      purchasedAt: purchased
        ? (item.purchasedAt ?? new Date().toISOString().slice(0, 10))
        : undefined,
    });
    router.push("/wishlist");
  }

  function handleDelete() {
    if (!item) return;
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    markUndoable(`Wishlist item "${item.name}" deleted`);
    deleteWishlistItem(item.id);
    router.push("/wishlist");
  }

  return (
    <>
      <SubpageHeader title="Edit wish" backHref="/wishlist" />
      <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
        <FormGroup>
          <FormRow label="Item" htmlFor="wish-name">
            <TextInput
              id="wish-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
          <FormRow label="Purchased">
            <button
              type="button"
              role="switch"
              aria-checked={purchased}
              onClick={() => setPurchased((v) => !v)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                purchased ? "bg-emerald-500" : "bg-fg/20"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  purchased ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </FormRow>
        </FormGroup>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-accent"
          >
            <ExternalLink size={14} strokeWidth={2.4} />
            Open link
          </a>
        )}

        <SaveButton label="Save" disabled={!valid} />

        <button
          type="button"
          onClick={handleDelete}
          className="block w-full rounded-full border border-rose-400/40 px-5 py-3.5 text-base font-bold text-rose-400"
        >
          Delete
        </button>
      </form>
    </>
  );
}
