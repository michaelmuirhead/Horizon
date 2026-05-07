import { describe, expect, it } from "vitest";
import {
  dedupeAgainstExisting,
  parseTransactionsCsv,
  transactionsToCsv,
} from "./csv";
import type { Transaction } from "./transactions";

const txs: Transaction[] = [
  {
    id: "1",
    date: "2026-05-04",
    payee: "Kroger",
    category: "Groceries",
    amount: -42.5,
    account: "USAA",
    cleared: true,
    memo: "Late-night snack run",
  },
  {
    id: "2",
    date: "2026-05-05",
    payee: "Costco, Inc.",
    category: "Split",
    amount: -120,
    account: "USAA",
    cleared: false,
    splits: [
      { category: "Groceries", amount: -80 },
      { category: "Household", amount: -40 },
    ],
  },
  {
    id: "3",
    date: "2026-05-01",
    payee: "Direct deposit",
    category: "Income: Ready to Assign",
    amount: 2000,
    account: "USAA",
    cleared: true,
    isReadyToAssign: true,
  },
];

describe("CSV round-trip", () => {
  it("re-imports its own export with no errors and intact splits", () => {
    const csv = transactionsToCsv(txs);
    const result = parseTransactionsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);

    const costco = result.rows.find((r) => r.payee === "Costco, Inc.")!;
    expect(costco.amount).toBeCloseTo(-120, 5);
    expect(costco.splits?.length).toBe(2);
    expect(costco.splits?.[0]).toEqual({ category: "Groceries", amount: -80 });

    const inflow = result.rows.find((r) => r.payee === "Direct deposit")!;
    expect(inflow.amount).toBeCloseTo(2000, 5);
    expect(inflow.cleared).toBe(true);
  });
});

describe("parseTransactionsCsv bank-format detection", () => {
  it("recognises Transaction Date / Description aliases and applies fallback account", () => {
    const csv = [
      "Transaction Date,Description,Amount",
      "2026-05-04,KROGER #455,-42.50",
      `2026-05-05,"COSTCO, INC.",-120.00`,
    ].join("\n");
    const result = parseTransactionsCsv(csv, { fallbackAccount: "Chase" });
    expect(result.format).toBe("bank");
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].account).toBe("Chase");
    expect(result.rows[1].payee).toBe("COSTCO, INC.");
  });

  it("strips $ and , from amounts and flips signs when asked", () => {
    const csv = [
      "Date,Description,Amount",
      "2026-05-04,Kroger,\"$1,234.50\"", // positive in CSV
    ].join("\n");
    const flipped = parseTransactionsCsv(csv, {
      fallbackAccount: "Chase",
      flipAmountSign: true,
    });
    expect(flipped.rows[0].amount).toBeCloseTo(-1234.5, 2);
  });

  it("flags missing account when no fallback is provided", () => {
    const csv = [
      "Date,Description,Amount",
      "2026-05-04,Kroger,-10",
    ].join("\n");
    const result = parseTransactionsCsv(csv);
    expect(result.errors.some((e) => e.message.includes("Account"))).toBe(true);
  });
});

describe("parseTransactionsCsv error handling", () => {
  it("flags missing required headers", () => {
    const csv = "Date,Payee\n2026-05-04,Kroger\n";
    const result = parseTransactionsCsv(csv);
    expect(result.rows).toHaveLength(0);
    const messages = result.errors.map((e) => e.message).join(" ");
    expect(messages).toMatch(/Amount/);
    expect(messages).toMatch(/Account/);
  });

  it("skips rows missing required cells but keeps valid ones", () => {
    const csv = [
      "Date,Payee,Category,Account,Amount",
      "2026-05-04,Kroger,Groceries,USAA,-10",
      ",,,,", // blank
      "2026-05-05,,Groceries,USAA,-20", // missing payee
      "2026-05-06,Costco,Groceries,USAA,not-a-number",
    ].join("\n");
    const result = parseTransactionsCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("dedupes parsed rows against existing transactions and within the batch", () => {
    const existing = [
      {
        date: "2026-05-04",
        payee: "KROGER #455",
        amount: -42.5,
        account: "Chase",
      },
    ];
    const csv = [
      "Date,Description,Amount",
      "2026-05-04,Kroger #455,-42.50", // dup of existing (case + spacing)
      "2026-05-05,Costco,-120.00", // unique
      "2026-05-05,Costco,-120.00", // dup within batch
    ].join("\n");
    const parsed = parseTransactionsCsv(csv, { fallbackAccount: "Chase" });
    const diff = dedupeAgainstExisting(parsed.rows, existing);
    expect(diff.unique).toHaveLength(1);
    expect(diff.unique[0].payee).toBe("Costco");
    expect(diff.duplicates).toHaveLength(2);
  });

  it("handles quoted fields with commas", () => {
    const csv = [
      "Date,Payee,Category,Account,Amount",
      `2026-05-04,"Costco, Inc.",Groceries,USAA,-30`,
    ].join("\n");
    const result = parseTransactionsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].payee).toBe("Costco, Inc.");
  });
});
