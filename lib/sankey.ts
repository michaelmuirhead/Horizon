import type { Transaction } from "./transactions";

export type SankeyNode = {
  id: string;
  label: string;
  // Total flow through this node (sum of incoming or outgoing — they're
  // equal in a balanced Sankey).
  value: number;
  column: 0 | 1 | 2;
};

export type SankeyFlow = {
  source: string;
  target: string;
  value: number;
};

export type SankeyData = {
  nodes: SankeyNode[];
  flows: SankeyFlow[];
};

const TOP_INCOME = 4;
const TOP_CATEGORIES = 6;
const TOP_PAYEES_PER_CATEGORY = 3;

// Builds a 3-column sankey: income payees → spending categories → top
// payees per category. Items beyond the per-column caps roll into an
// "Other" node so the chart stays readable on a phone.
export function buildSankey(
  transactions: Transaction[],
  fromIso: string,
  toIso: string,
): SankeyData {
  const inWindow = transactions.filter(
    (t) => t.date >= fromIso && t.date <= toIso && !t.transferId,
  );

  // Income side — RTA-tagged inflows grouped by payee.
  const incomeByPayee = new Map<string, number>();
  for (const t of inWindow) {
    if (!t.isReadyToAssign) continue;
    if (t.amount <= 0) continue;
    incomeByPayee.set(t.payee, (incomeByPayee.get(t.payee) ?? 0) + t.amount);
  }

  // Spending side — category → total spent and per-payee breakdown.
  const spendByCategory = new Map<string, number>();
  const payeesByCategory = new Map<string, Map<string, number>>();
  for (const t of inWindow) {
    if (t.isReadyToAssign) continue;
    if (t.splits && t.splits.length > 0) {
      for (const s of t.splits) {
        if (s.amount >= 0) continue;
        const v = -s.amount;
        spendByCategory.set(s.category, (spendByCategory.get(s.category) ?? 0) + v);
        const inner =
          payeesByCategory.get(s.category) ?? new Map<string, number>();
        inner.set(t.payee, (inner.get(t.payee) ?? 0) + v);
        payeesByCategory.set(s.category, inner);
      }
      continue;
    }
    if (t.amount >= 0) continue;
    const v = -t.amount;
    spendByCategory.set(t.category, (spendByCategory.get(t.category) ?? 0) + v);
    const inner =
      payeesByCategory.get(t.category) ?? new Map<string, number>();
    inner.set(t.payee, (inner.get(t.payee) ?? 0) + v);
    payeesByCategory.set(t.category, inner);
  }

  // Cap the income column to TOP_INCOME, fold the rest into "Other income".
  const incomeEntries = Array.from(incomeByPayee.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const incomeTop = incomeEntries.slice(0, TOP_INCOME);
  const incomeRest = incomeEntries.slice(TOP_INCOME);
  const incomeOther = incomeRest.reduce((s, [, v]) => s + v, 0);
  const incomeNodes: SankeyNode[] = incomeTop.map(([payee, value]) => ({
    id: `in:${payee}`,
    label: payee,
    value,
    column: 0,
  }));
  if (incomeOther > 0) {
    incomeNodes.push({
      id: "in:__other__",
      label: "Other income",
      value: incomeOther,
      column: 0,
    });
  }

  // Same shape for categories.
  const catEntries = Array.from(spendByCategory.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const catTop = catEntries.slice(0, TOP_CATEGORIES);
  const catRest = catEntries.slice(TOP_CATEGORIES);
  const catOther = catRest.reduce((s, [, v]) => s + v, 0);
  const categoryNodes: SankeyNode[] = catTop.map(([cat, value]) => ({
    id: `cat:${cat}`,
    label: cat,
    value,
    column: 1,
  }));
  if (catOther > 0) {
    categoryNodes.push({
      id: "cat:__other__",
      label: "Other",
      value: catOther,
      column: 1,
    });
  }

  // Per-category top payees.
  const payeeNodes: SankeyNode[] = [];
  const payeeIndex = new Map<string, SankeyNode>();
  for (const cat of categoryNodes) {
    const isOther = cat.id === "cat:__other__";
    const sourceCats = isOther ? catRest.map(([c]) => c) : [cat.label];
    // Aggregate payees across all categories rolled into this node.
    const merged = new Map<string, number>();
    for (const c of sourceCats) {
      const inner = payeesByCategory.get(c) ?? new Map();
      for (const [p, v] of inner) merged.set(p, (merged.get(p) ?? 0) + v);
    }
    const sorted = Array.from(merged.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, TOP_PAYEES_PER_CATEGORY);
    const restPayees = sorted.slice(TOP_PAYEES_PER_CATEGORY);
    const restValue = restPayees.reduce((s, [, v]) => s + v, 0);
    for (const [payee, value] of top) {
      const id = `pay:${cat.id}:${payee}`;
      payeeNodes.push({ id, label: payee, value, column: 2 });
      payeeIndex.set(id, payeeNodes[payeeNodes.length - 1]);
    }
    if (restValue > 0) {
      const id = `pay:${cat.id}:__other__`;
      payeeNodes.push({
        id,
        label: "Others",
        value: restValue,
        column: 2,
      });
      payeeIndex.set(id, payeeNodes[payeeNodes.length - 1]);
    }
  }

  // Income → category flows are split proportional to each category's
  // share of total spend. Same shape for income source: every income
  // node fans out to every category.
  const totalSpend = categoryNodes.reduce((s, n) => s + n.value, 0);
  const flows: SankeyFlow[] = [];
  if (totalSpend > 0) {
    for (const inc of incomeNodes) {
      for (const cat of categoryNodes) {
        const share = (cat.value / totalSpend) * inc.value;
        if (share > 0) {
          flows.push({ source: inc.id, target: cat.id, value: share });
        }
      }
    }
  }
  // Category → payee flows.
  for (const cat of categoryNodes) {
    for (const node of payeeNodes) {
      if (!node.id.startsWith(`pay:${cat.id}:`)) continue;
      flows.push({ source: cat.id, target: node.id, value: node.value });
    }
  }

  return { nodes: [...incomeNodes, ...categoryNodes, ...payeeNodes], flows };
}
