// Three-way-ish merge for two state payloads coming from the same user
// budget. Used when local + remote both have changes since they last
// agreed — instead of LWW-clobbering one side, union id-keyed
// collections so both sides' additions survive.
//
// Tradeoffs we accept (vs. real CRDTs):
//   • Concurrent updates to the same item are still LWW by lastModifiedAt
//     stamp — the slower-stamped side loses.
//   • Deletes have no tombstones, so a delete on one side races against
//     an add/edit of the same id on the other; if the other side's
//     stamp is newer, the deleted item reappears. Personal-finance
//     deletes are rare and the user can re-delete; we'd rather risk a
//     resurrected row than lose every other concurrent edit.

// Element shape for id-keyed collections. The optional `name` lets
// callers (and tests) read the property off a merged entry without a
// cast — every real id-keyed entity in the schema has a name
// (accounts, groups, categories, planner folders/budgets, etc.), so
// declaring it here costs nothing and keeps the public type honest.
type IdItem = { id: string; name?: string };

type StatePayload = {
  transactions?: IdItem[];
  accounts?: IdItem[];
  groups?: (IdItem & { categories?: IdItem[] })[];
  assignments?: Record<string, Record<string, number>>;
  pinnedCategoryIds?: string[];
  targets?: Record<string, unknown>;
  plannerFolders?: IdItem[];
  plannerBudgets?: IdItem[];
  plannerEntries?: IdItem[];
  scheduledTransactions?: IdItem[];
  reconciliations?: IdItem[];
  monthNotes?: Record<string, string>;
  rules?: IdItem[];
  wishlist?: IdItem[];
  savingsGoals?: IdItem[];
  templates?: IdItem[];
  settings?: unknown;
  lastModifiedAt?: number;
};

// Pick the side that should win when both have the same id-keyed entry.
// `winner` is "local" or "remote" depending on which carries the newer
// stamp; the loser still contributes anything the winner doesn't know
// about, which is how concurrent additions both survive.
function unionById<T extends IdItem>(
  local: T[] | undefined,
  remote: T[] | undefined,
  winner: "local" | "remote",
): T[] {
  const a = local ?? [];
  const b = remote ?? [];
  const winSide = winner === "local" ? a : b;
  const loseSide = winner === "local" ? b : a;
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of winSide) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  for (const item of loseSide) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function unionRecord<V>(
  local: Record<string, V> | undefined,
  remote: Record<string, V> | undefined,
  winner: "local" | "remote",
): Record<string, V> {
  const a = local ?? {};
  const b = remote ?? {};
  return winner === "local" ? { ...b, ...a } : { ...a, ...b };
}

function unionAssignments(
  local: Record<string, Record<string, number>> | undefined,
  remote: Record<string, Record<string, number>> | undefined,
  winner: "local" | "remote",
): Record<string, Record<string, number>> {
  const a = local ?? {};
  const b = remote ?? {};
  const out: Record<string, Record<string, number>> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    out[k] = unionRecord<number>(a[k], b[k], winner);
  }
  return out;
}

function unionStringSet(
  local: string[] | undefined,
  remote: string[] | undefined,
): string[] {
  const set = new Set<string>([...(local ?? []), ...(remote ?? [])]);
  return Array.from(set);
}

function unionGroups<
  G extends IdItem & { categories?: IdItem[] },
>(
  local: G[] | undefined,
  remote: G[] | undefined,
  winner: "local" | "remote",
): G[] {
  // Top-level groups: union by id, preferring the winner's row when
  // both sides have the same group. We also union the inner
  // `categories` array of any shared group, again preferring the
  // winner — so a category added on one device + a category added on
  // the other survive together.
  const a = local ?? [];
  const b = remote ?? [];
  const localById = new Map<string, G>(a.map((g) => [g.id, g]));
  const remoteById = new Map<string, G>(b.map((g) => [g.id, g]));
  const winSide = winner === "local" ? a : b;
  const seen = new Set<string>();
  const out: G[] = [];

  function mergeShared(localG: G, remoteG: G): G {
    const winnerG = winner === "local" ? localG : remoteG;
    return {
      ...winnerG,
      categories: unionById(
        localG.categories,
        remoteG.categories,
        winner,
      ) as G["categories"],
    };
  }

  for (const g of winSide) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    const other = (winner === "local" ? remoteById : localById).get(g.id);
    if (other) {
      const localG = winner === "local" ? g : other;
      const remoteG = winner === "local" ? other : g;
      out.push(mergeShared(localG, remoteG));
    } else {
      out.push(g);
    }
  }
  const loseSide = winner === "local" ? b : a;
  for (const g of loseSide) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

export function mergePayloads(
  local: StatePayload,
  remote: StatePayload,
): StatePayload {
  const localStamp = local.lastModifiedAt ?? 0;
  const remoteStamp = remote.lastModifiedAt ?? 0;
  const winner: "local" | "remote" =
    localStamp >= remoteStamp ? "local" : "remote";
  return {
    transactions: unionById(local.transactions, remote.transactions, winner),
    accounts: unionById(local.accounts, remote.accounts, winner),
    groups: unionGroups(local.groups, remote.groups, winner),
    assignments: unionAssignments(
      local.assignments,
      remote.assignments,
      winner,
    ),
    pinnedCategoryIds: unionStringSet(
      local.pinnedCategoryIds,
      remote.pinnedCategoryIds,
    ),
    targets: unionRecord(local.targets, remote.targets, winner),
    plannerFolders: unionById(
      local.plannerFolders,
      remote.plannerFolders,
      winner,
    ),
    plannerBudgets: unionById(
      local.plannerBudgets,
      remote.plannerBudgets,
      winner,
    ),
    plannerEntries: unionById(
      local.plannerEntries,
      remote.plannerEntries,
      winner,
    ),
    scheduledTransactions: unionById(
      local.scheduledTransactions,
      remote.scheduledTransactions,
      winner,
    ),
    reconciliations: unionById(
      local.reconciliations,
      remote.reconciliations,
      winner,
    ),
    monthNotes: unionRecord(local.monthNotes, remote.monthNotes, winner),
    rules: unionById(local.rules, remote.rules, winner),
    wishlist: unionById(local.wishlist, remote.wishlist, winner),
    savingsGoals: unionById(local.savingsGoals, remote.savingsGoals, winner),
    templates: unionById(local.templates, remote.templates, winner),
    settings: winner === "local" ? local.settings : remote.settings,
    lastModifiedAt: Math.max(localStamp, remoteStamp),
  };
}
