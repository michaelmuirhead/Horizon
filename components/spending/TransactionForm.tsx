"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Camera,
  FolderOpen,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import SegmentedField from "@/components/forms/SegmentedField";
import SaveButton from "@/components/forms/SaveButton";
import { useAuth } from "@/components/auth/AuthContext";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { allCategoryNames, READY_TO_ASSIGN_CATEGORY } from "@/lib/budget";
import {
  SPLIT_CATEGORY,
  lastCategoryForPayee,
  normalizeTags,
  parseTagsInput,
  type Transaction,
  type TransactionSplit,
} from "@/lib/transactions";
import { formatCurrency } from "@/lib/format";
import { resizeImageFile } from "@/lib/imageResize";
import {
  PDF_SIZE_LIMIT_LABEL,
  isPdfDataUrl,
  isPdfTooLargeError,
  readPdfAsDataUrl,
} from "@/lib/attachmentRead";
import {
  deleteAttachment,
  isStorageUrl,
  uploadAttachment,
} from "@/lib/cloudStorage";

export type TransactionFormValues = Omit<Transaction, "id">;

type Direction = "outflow" | "inflow";

type SplitDraft = { category: string; amount: string };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function detectDirection(
  amount: number,
  isReadyToAssign: boolean | undefined,
): Direction {
  if (isReadyToAssign) return "inflow";
  return amount > 0 ? "inflow" : "outflow";
}

function initialSplitDrafts(
  initial: Transaction | undefined,
  fallbackCategory: string,
): SplitDraft[] {
  if (initial?.splits && initial.splits.length > 0) {
    return initial.splits.map((s) => ({
      category: s.category,
      amount: Math.abs(s.amount).toString(),
    }));
  }
  return [
    { category: fallbackCategory, amount: "" },
    { category: fallbackCategory, amount: "" },
  ];
}

type Props = {
  initial?: Transaction;
  saveLabel: string;
  onSave: (values: TransactionFormValues) => void;
  onDelete?: () => void;
  // Default direction for new transactions (from a quick-add button etc).
  // Ignored when `initial` is set — that flow detects the direction from
  // the existing transaction.
  defaultDirection?: Direction;
};

export default function TransactionForm({
  initial,
  saveLabel,
  onSave,
  onDelete,
  defaultDirection,
}: Props) {
  const { accounts: allAccounts, transactions: existingTxs } =
    useHorizonStore();
  const { user } = useAuth();
  // Closed accounts disappear from the picker, but stay available if the
  // transaction being edited still references one.
  const accounts = allAccounts.filter(
    (a) => !a.closed || a.name === initial?.account,
  );
  const trackingAccountIds = new Set(
    allAccounts.filter((a) => a.tracking).map((a) => a.id),
  );
  const categoryNames = allCategoryNames();

  const initialDirection: Direction = initial
    ? detectDirection(initial.amount, initial.isReadyToAssign)
    : (defaultDirection ?? "outflow");
  const initialAccountId = initial
    ? (accounts.find((a) => a.name === initial.account)?.id ??
      accounts[0]?.id ??
      "")
    : (accounts[0]?.id ?? "");

  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [accountId, setAccountId] = useState<string>(initialAccountId);
  const [date, setDate] = useState<string>(initial?.date ?? todayIso());
  const [payee, setPayee] = useState<string>(initial?.payee ?? "");
  const [category, setCategory] = useState<string>(
    initial && !initial.isReadyToAssign && !initial.splits
      ? initial.category
      : (categoryNames[0] ?? ""),
  );
  const [amount, setAmount] = useState<string>(
    initial && !initial.splits ? Math.abs(initial.amount).toString() : "",
  );
  const [memo, setMemo] = useState<string>(initial?.memo ?? "");
  const [tags, setTags] = useState<string>(initial?.tags?.join(", ") ?? "");
  const [cleared, setCleared] = useState<boolean>(initial?.cleared ?? true);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>(
    initial?.receiptDataUrl,
  );
  const [receiptStoragePath, setReceiptStoragePath] = useState<
    string | undefined
  >(initial?.receiptStoragePath);
  // Three pick paths: camera (capture="environment"), photo library
  // (accept="image/*"), and Files (no accept — iOS opens the Files
  // app directly, skipping the photo action sheet). Browsers don't
  // let one <input> toggle capture/accept dynamically, so each
  // needs its own ref / element. The Files path can yield PDFs or
  // other documents; PDFs route through readPdfAsDataUrl for size
  // checking, then upload to Firebase Storage when the user is
  // signed in so the budget Firestore doc stays small. Unsupported
  // types leave the existing receipt alone.
  const receiptCameraRef = useRef<HTMLInputElement>(null);
  const receiptLibraryRef = useRef<HTMLInputElement>(null);
  const receiptFilesRef = useRef<HTMLInputElement>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);

  useEffect(() => {
    if (!receiptError) return;
    const t = window.setTimeout(() => setReceiptError(null), 4000);
    return () => window.clearTimeout(t);
  }, [receiptError]);

  // Scope id for the Storage path. Uses the existing transaction id
  // on edit; for the new-transaction form we don't have one yet, so
  // a short-lived ref provides a stable prefix that survives
  // re-renders while the user fills out the form.
  const newTxScopeRef = useRef<string>(`tx-${Math.random().toString(36).slice(2, 10)}`);
  const receiptScopeId = initial?.id ?? newTxScopeRef.current;

  // Fire-and-forget cleanup of the previously-stored object on
  // replace / remove. Storage deletes are best-effort — a failure
  // just leaves an orphan, never blocks the user.
  function cleanupPrevReceipt() {
    if (receiptStoragePath) void deleteAttachment(receiptStoragePath);
  }

  async function commitReceiptFromFile(file: File) {
    setReceiptError(null);
    setReceiptUploading(true);
    try {
      const isPdf = file.type === "application/pdf";
      const processedDataUrl = isPdf
        ? await readPdfAsDataUrl(file)
        : await resizeImageFile(file);

      if (user) {
        try {
          const blob = await dataUrlToBlob(processedDataUrl);
          const stored = await uploadAttachment(user.uid, blob, receiptScopeId);
          cleanupPrevReceipt();
          setReceiptDataUrl(stored.url);
          setReceiptStoragePath(stored.path);
          return;
        } catch {
          // Fall through to inline below.
        }
      }
      cleanupPrevReceipt();
      setReceiptDataUrl(processedDataUrl);
      setReceiptStoragePath(undefined);
    } catch (err) {
      if (isPdfTooLargeError(err)) {
        setReceiptError(
          `PDF is too large — keep it under ${PDF_SIZE_LIMIT_LABEL}.`,
        );
      }
      // Other errors silently leave the existing receipt alone.
    } finally {
      setReceiptUploading(false);
    }
  }

  function handleReceiptPickedFrom(
    ref: React.RefObject<HTMLInputElement | null>,
  ) {
    return async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (ref.current) ref.current.value = "";
      if (!file) return;
      await commitReceiptFromFile(file);
    };
  }

  function handleReceiptRemove() {
    cleanupPrevReceipt();
    setReceiptDataUrl(undefined);
    setReceiptStoragePath(undefined);
  }
  // Track whether the user has explicitly picked a category. Auto-suggest from
  // payee history when they haven't, but never overwrite a deliberate choice.
  const [categoryTouched, setCategoryTouched] = useState<boolean>(
    initial !== undefined,
  );
  const suggestedCategory = !categoryTouched
    ? lastCategoryForPayee(existingTxs, payee)
    : null;

  const [isSplit, setIsSplit] = useState<boolean>(
    Boolean(initial?.splits && initial.splits.length > 0),
  );
  const [splits, setSplits] = useState<SplitDraft[]>(() =>
    initialSplitDrafts(initial, categoryNames[0] ?? ""),
  );

  const isTrackingAccount = trackingAccountIds.has(accountId);
  const splitTotal = splits.reduce(
    (sum, s) => sum + (Number.isFinite(parseFloat(s.amount)) ? parseFloat(s.amount) : 0),
    0,
  );
  const splitsValid =
    splits.length >= 2 &&
    splits.every((s) => parseFloat(s.amount) > 0 && s.category !== "");
  const useSplits = direction === "outflow" && isSplit && !isTrackingAccount;

  const baseValid = accountId !== "" && payee.trim() !== "";
  const amountValid = useSplits ? splitsValid : parseFloat(amount) > 0;
  const valid = baseValid && amountValid;

  function setSplitAt(idx: number, patch: Partial<SplitDraft>) {
    setSplits((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }

  function addSplit() {
    setSplits((prev) => [
      ...prev,
      { category: categoryNames[0] ?? "", amount: "" },
    ]);
  }

  function removeSplit(idx: number) {
    setSplits((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;

    const normalizedTags = normalizeTags(parseTagsInput(tags));

    if (useSplits) {
      const splitItems: TransactionSplit[] = splits.map((s) => ({
        category: s.category,
        amount: -parseFloat(s.amount),
      }));
      const total = splitItems.reduce((sum, s) => sum + s.amount, 0);
      onSave({
        date,
        payee: payee.trim(),
        category: SPLIT_CATEGORY,
        amount: total,
        account: account.name,
        cleared,
        memo: memo.trim() || undefined,
        splits: splitItems,
        tags: normalizedTags,
        receiptDataUrl,
        receiptStoragePath,
      });
      return;
    }

    const magnitude = parseFloat(amount);
    const signed = direction === "inflow" ? magnitude : -magnitude;
    if (isTrackingAccount) {
      // Off-budget activity — no envelope tagging, no RTA bump.
      onSave({
        date,
        payee: payee.trim(),
        category: "Tracking",
        amount: signed,
        account: account.name,
        cleared,
        memo: memo.trim() || undefined,
        tags: normalizedTags,
        receiptDataUrl,
        receiptStoragePath,
      });
      return;
    }
    const isReadyToAssign = direction === "inflow";
    // Apply the payee suggestion at save time when the user hasn't picked a
    // category, so the suggested value lands in the saved record.
    const effectiveCategory = isReadyToAssign
      ? READY_TO_ASSIGN_CATEGORY
      : suggestedCategory && !categoryTouched
        ? suggestedCategory
        : category;
    onSave({
      date,
      payee: payee.trim(),
      category: effectiveCategory,
      amount: signed,
      account: account.name,
      cleared,
      isReadyToAssign,
      memo: memo.trim() || undefined,
      tags: normalizedTags,
      receiptDataUrl,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
      {initial?.reconciled && (
        <div className="rounded-2xl bg-amber-900/30 px-4 py-3 text-xs text-amber-200">
          This transaction was reconciled. Editing it will desync your records
          from the bank balance you confirmed.
        </div>
      )}
      <SegmentedField<Direction>
        value={direction}
        onChange={setDirection}
        options={[
          { value: "outflow", label: "Outflow" },
          { value: "inflow", label: "Inflow" },
        ]}
      />

      <FormGroup>
        {!useSplits && (
          <FormRow label="Amount" htmlFor="amount">
            <span className="flex items-center justify-end gap-1">
              <span className="text-fg/60">
                {direction === "outflow" ? "−" : "+"}$
              </span>
              <TextInput
                id="amount"
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
        )}

        <FormRow label="Account" htmlFor="account">
          {accounts.length === 0 ? (
            <span className="text-fg/55">No accounts yet</span>
          ) : (
            <Select
              id="account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-card">
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </FormRow>

        <FormRow label="Date" htmlFor="date">
          <TextInput
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </FormRow>

        <FormRow label="Payee" htmlFor="payee">
          <TextInput
            id="payee"
            type="text"
            placeholder="Required"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            required
            autoComplete="off"
          />
        </FormRow>

        {direction === "outflow" && !isTrackingAccount && (
          <FormRow label="Split">
            <button
              type="button"
              role="switch"
              aria-checked={isSplit}
              onClick={() => setIsSplit((v) => !v)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                isSplit ? "bg-accent" : "bg-white/20"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  isSplit ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </FormRow>
        )}

        {direction === "outflow" && !useSplits && !isTrackingAccount && (
          <FormRow label="Category" htmlFor="category">
            <Select
              id="category"
              value={
                suggestedCategory && !categoryTouched
                  ? suggestedCategory
                  : category
              }
              onChange={(e) => {
                setCategory(e.target.value);
                setCategoryTouched(true);
              }}
            >
              {categoryNames.map((name) => (
                <option key={name} value={name} className="bg-card">
                  {name}
                </option>
              ))}
            </Select>
          </FormRow>
        )}

        {direction === "outflow" &&
          !useSplits &&
          !isTrackingAccount &&
          suggestedCategory &&
          !categoryTouched && (
            <div className="px-4 pt-1 pb-2 text-[11px] text-fg/55">
              Suggested from past <span className="font-semibold">{payee}</span>{" "}
              transactions —{" "}
              <button
                type="button"
                onClick={() => setCategoryTouched(true)}
                className="text-accent font-semibold"
              >
                pick a different one
              </button>
            </div>
          )}

        <FormRow label="Memo" htmlFor="memo">
          <TextInput
            id="memo"
            type="text"
            placeholder="Optional"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            autoComplete="off"
          />
        </FormRow>

        <FormRow label="Tags" htmlFor="tags">
          <TextInput
            id="tags"
            type="text"
            placeholder="vacation, tax-deductible"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            autoComplete="off"
          />
        </FormRow>

        <FormRow label="Receipt">
          <div className="flex items-center justify-end gap-2">
            {receiptUploading && (
              <Loader2 size={14} className="animate-spin text-fg/55" />
            )}
            {receiptDataUrl && !receiptUploading && (
              <button
                type="button"
                onClick={handleReceiptRemove}
                aria-label="Remove receipt"
                className="grid h-7 w-7 place-items-center rounded-full bg-card-elevated text-fg/70"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            )}
            <label
              htmlFor="receipt-input-camera"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-card-elevated px-3 py-1.5 text-xs font-bold text-fg/85"
            >
              <Camera size={14} strokeWidth={2.4} />
              Camera
            </label>
            <input
              id="receipt-input-camera"
              ref={receiptCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptPickedFrom(receiptCameraRef)}
              className="sr-only"
            />
            <label
              htmlFor="receipt-input-library"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-card-elevated px-3 py-1.5 text-xs font-bold text-fg/85"
            >
              <ImageIcon size={14} strokeWidth={2.4} />
              Library
            </label>
            <input
              id="receipt-input-library"
              ref={receiptLibraryRef}
              type="file"
              accept="image/*"
              onChange={handleReceiptPickedFrom(receiptLibraryRef)}
              className="sr-only"
            />
            <label
              htmlFor="receipt-input-files"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-card-elevated px-3 py-1.5 text-xs font-bold text-fg/85"
            >
              <FolderOpen size={14} strokeWidth={2.4} />
              Files
            </label>
            <input
              id="receipt-input-files"
              ref={receiptFilesRef}
              type="file"
              onChange={handleReceiptPickedFrom(receiptFilesRef)}
              className="sr-only"
            />
          </div>
        </FormRow>
        {receiptError && (
          <p className="px-4 text-xs font-semibold text-rose-300">
            {receiptError}
          </p>
        )}
        {receiptDataUrl && (
          <div className="px-4 pb-3">
            {isPdfDataUrl(receiptDataUrl) ? (
              <div className="overflow-hidden rounded-xl bg-card-elevated">
                <iframe
                  src={receiptDataUrl}
                  title="Receipt"
                  className="block h-72 w-full"
                />
                <a
                  href={receiptDataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 text-center text-xs font-bold text-accent"
                >
                  Open PDF in new tab
                </a>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={receiptDataUrl}
                alt="Receipt"
                className="block max-h-72 w-full rounded-xl object-contain bg-card-elevated"
              />
            )}
          </div>
        )}

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

      {useSplits && (
        <div className="rounded-2xl bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-fg/5">
            <span className="text-sm font-semibold text-fg/70">Splits</span>
            <span className="text-base font-bold tabular-nums">
              {formatCurrency(-splitTotal)}
            </span>
          </div>
          <ul className="divide-y divide-fg/5">
            {splits.map((s, idx) => (
              <li key={idx} className="flex items-center gap-2 px-4 py-3">
                <Select
                  value={s.category}
                  onChange={(e) => setSplitAt(idx, { category: e.target.value })}
                  aria-label={`Split ${idx + 1} category`}
                >
                  {categoryNames.map((name) => (
                    <option key={name} value={name} className="bg-card">
                      {name}
                    </option>
                  ))}
                </Select>
                <span className="text-fg/60">−$</span>
                <TextInput
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={s.amount}
                  onChange={(e) => setSplitAt(idx, { amount: e.target.value })}
                  aria-label={`Split ${idx + 1} amount`}
                  className="max-w-[100px]"
                />
                <button
                  type="button"
                  onClick={() => removeSplit(idx)}
                  disabled={splits.length <= 2}
                  aria-label={`Remove split ${idx + 1}`}
                  className="grid h-8 w-8 place-items-center text-rose-400/70 hover:text-rose-400 disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addSplit}
            className="flex w-full items-center justify-center gap-2 px-4 py-3 text-accent text-sm font-bold border-t border-fg/5"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Split
          </button>
        </div>
      )}

      <SaveButton label={saveLabel} disabled={!valid} />

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="block w-full rounded-full border border-rose-400/40 px-5 py-3.5 text-base font-bold text-rose-400"
        >
          Delete Transaction
        </button>
      )}
    </form>
  );
}

// Convert a data URL back into a Blob we can hand to uploadBytes.
// Mirrors the helper in AttachPhotoCard — small enough to inline
// in both call sites rather than create a one-function shared module.
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
