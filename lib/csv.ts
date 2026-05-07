import { normalizeTags, type Transaction, type TransactionSplit } from "./transactions";

const HEADER = [
  "Date",
  "Payee",
  "Category",
  "Account",
  "Amount",
  "Cleared",
  "Memo",
  "Splits",
  "Tags",
];

function quote(value: string | number | undefined | null): string {
  const s = value === undefined || value === null ? "" : String(value);
  if (s === "") return "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function encodeSplits(splits: TransactionSplit[] | undefined): string {
  if (!splits || splits.length === 0) return "";
  return splits.map((s) => `${s.category}=${s.amount.toFixed(2)}`).join("|");
}

export function transactionsToCsv(transactions: Transaction[]): string {
  const lines = [HEADER.join(",")];
  for (const t of transactions) {
    lines.push(
      [
        quote(t.date),
        quote(t.payee),
        quote(t.category),
        quote(t.account),
        quote(t.amount.toFixed(2)),
        quote(t.cleared ? "yes" : "no"),
        quote(t.memo ?? ""),
        quote(encodeSplits(t.splits)),
        quote(t.tags ? t.tags.join("|") : ""),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

// Forgiving CSV row parser — handles quoted fields with commas and escaped
// double quotes via "". Doesn't try to be RFC4180-perfect; just enough for
// re-importing what transactionsToCsv produces and typical bank exports.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else if (ch === '"' && cur === "") {
      inQuote = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function decodeSplits(field: string): TransactionSplit[] | undefined {
  const trimmed = field.trim();
  if (trimmed === "") return undefined;
  const out: TransactionSplit[] = [];
  for (const part of trimmed.split("|")) {
    const eq = part.lastIndexOf("=");
    if (eq < 0) continue;
    const category = part.slice(0, eq).trim();
    const amount = parseFloat(part.slice(eq + 1));
    if (category === "" || !Number.isFinite(amount)) continue;
    out.push({ category, amount });
  }
  return out.length > 0 ? out : undefined;
}

export type ParsedCsvRow = Omit<Transaction, "id">;

export type CsvParseResult = {
  rows: ParsedCsvRow[];
  errors: { line: number; message: string }[];
  format?: "horizon" | "bank";
};

export type CsvParseOptions = {
  // When the CSV doesn't include an Account column (bank exports), apply this
  // account name to every row.
  fallbackAccount?: string;
  // Some bank CSVs sign Amount opposite of our convention (positive = charge
  // on credit cards, for example). Flip multiplies every parsed amount by -1.
  flipAmountSign?: boolean;
};

// Header aliases — many banks export different names for the same fields.
// Lower-cased on lookup. The first matching alias wins.
const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "transaction date", "trans date", "trans. date", "post date", "posting date"],
  payee: ["payee", "description", "name", "original description", "merchant", "details"],
  category: ["category", "type"],
  account: ["account", "account name"],
  amount: ["amount", "debit", "credit"],
  cleared: ["cleared", "status"],
  memo: ["memo", "notes", "note"],
  splits: ["splits"],
  tags: ["tags", "labels"],
};

function findHeaderIndex(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

// Cheap duplicate key for CSV-import dedupe. We match on the same fingerprint
// the user would eyeball — date + payee + amount — within the same account.
// Payees are normalised (lowercased, collapsed whitespace) so "KROGER #455"
// vs "Kroger #455" still collide. Amount is rounded to cents.
function dedupeKey(
  account: string,
  date: string,
  payee: string,
  amount: number,
): string {
  const normPayee = payee.trim().toLowerCase().replace(/\s+/g, " ");
  const cents = Math.round(amount * 100);
  return `${account}|${date}|${normPayee}|${cents}`;
}

export type DedupedImport<T> = {
  unique: T[];
  duplicates: T[];
};

// Splits a list of parsed CSV rows into ones that look new vs. ones that
// already exist among `existing` transactions. Used by the importer to warn
// before committing.
export function dedupeAgainstExisting<T extends ParsedCsvRow>(
  rows: T[],
  existing: { date: string; payee: string; amount: number; account: string }[],
): DedupedImport<T> {
  const seen = new Set<string>();
  for (const t of existing) {
    seen.add(dedupeKey(t.account, t.date, t.payee, t.amount));
  }
  const unique: T[] = [];
  const duplicates: T[] = [];
  // Also catch duplicates *within* the same CSV — re-uploading the same file
  // twice in one session shouldn't sneak rows through just because they
  // weren't in the store yet.
  const inBatch = new Set<string>();
  for (const r of rows) {
    const key = dedupeKey(r.account, r.date, r.payee, r.amount);
    if (seen.has(key) || inBatch.has(key)) {
      duplicates.push(r);
    } else {
      unique.push(r);
      inBatch.add(key);
    }
  }
  return { unique, duplicates };
}

export function parseTransactionsCsv(
  text: string,
  options: CsvParseOptions = {},
): CsvParseResult {
  const errors: { line: number; message: string }[] = [];
  const rows: ParsedCsvRow[] = [];
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows, errors };

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const dateI = findHeaderIndex(header, HEADER_ALIASES.date);
  const payeeI = findHeaderIndex(header, HEADER_ALIASES.payee);
  const accountI = findHeaderIndex(header, HEADER_ALIASES.account);
  const amountI = findHeaderIndex(header, HEADER_ALIASES.amount);
  const categoryI = findHeaderIndex(header, HEADER_ALIASES.category);
  const clearedI = findHeaderIndex(header, HEADER_ALIASES.cleared);
  const memoI = findHeaderIndex(header, HEADER_ALIASES.memo);
  const splitsI = findHeaderIndex(header, HEADER_ALIASES.splits);
  const tagsI = findHeaderIndex(header, HEADER_ALIASES.tags);

  // Required: date, payee, amount. Account is optional if a fallback is given.
  if (dateI < 0)
    errors.push({ line: 1, message: "Missing a Date column" });
  if (payeeI < 0)
    errors.push({
      line: 1,
      message: "Missing a Payee / Description column",
    });
  if (amountI < 0)
    errors.push({ line: 1, message: "Missing an Amount column" });
  if (accountI < 0 && !options.fallbackAccount) {
    errors.push({
      line: 1,
      message: "Missing an Account column (pick one to apply to every row)",
    });
  }
  if (errors.length > 0) return { rows, errors };

  // Detect format: ours has Account + Splits headers; otherwise treat as bank.
  const format: "horizon" | "bank" =
    accountI >= 0 && splitsI >= 0 ? "horizon" : "bank";
  const flip = options.flipAmountSign === true;

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const date = cells[dateI]?.trim() ?? "";
    const payee = cells[payeeI]?.trim() ?? "";
    const accountFromCsv =
      accountI >= 0 ? (cells[accountI]?.trim() ?? "") : "";
    const account = accountFromCsv !== "" ? accountFromCsv : (options.fallbackAccount ?? "");
    const amountStr = cells[amountI]?.trim() ?? "";
    if (date === "" || payee === "" || account === "" || amountStr === "") {
      errors.push({
        line: i + 1,
        message: "Missing one of Date / Payee / Account / Amount",
      });
      continue;
    }
    let amount = parseFloat(amountStr.replace(/[$,]/g, ""));
    if (!Number.isFinite(amount)) {
      errors.push({
        line: i + 1,
        message: `Amount "${amountStr}" is not a number`,
      });
      continue;
    }
    if (flip) amount = -amount;
    const category = (categoryI >= 0 ? cells[categoryI] : "")?.trim() ?? "";
    const cleared =
      clearedI >= 0
        ? /^(y|yes|true|1|c|cleared|posted)$/i.test(
            cells[clearedI]?.trim() ?? "",
          )
        : false;
    const memoRaw = memoI >= 0 ? (cells[memoI]?.trim() ?? "") : "";
    const splits = splitsI >= 0 ? decodeSplits(cells[splitsI] ?? "") : undefined;
    const tagsRaw = tagsI >= 0 ? (cells[tagsI]?.trim() ?? "") : "";
    const tags = tagsRaw === ""
      ? undefined
      : normalizeTags(tagsRaw.split(/[|,;]/));
    rows.push({
      date,
      payee,
      category: category || (splits ? "Split" : "Uncategorized"),
      account,
      amount,
      cleared,
      memo: memoRaw === "" ? undefined : memoRaw,
      splits,
      tags,
    });
  }
  return { rows, errors, format };
}
