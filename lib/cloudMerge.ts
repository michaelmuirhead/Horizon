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
  fudgetRecurring?: IdItem[];
  scheduledTransactions?: IdItem[];
  reconciliations?: IdItem[];
  monthNotes?: Record<string, string>;
  rules?: IdItem[];
  wishlist?: IdItem[];
  savingsGoals?: IdItem[];
  templates?: IdItem[];
  settings?: unknown;
  lastModifiedAt?: number;
  // id → deletedAt epoch ms. Tombstones are how we tell "I never had
  // this" from "I deleted this" across devices: union-by-id alone
  // would resurrect anything a stale device still has cached.
  tombstones?: Record<string, number>;
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

// Merge two tombstone maps, keeping the larger (newer) deletedAt for
// any id present on both sides. Equivalent to a Last-Writer-Wins
// register per id, which is what we want — once an entry is tombstoned,
// every device should converge on the freshest deletion stamp.
function mergeTombstones(
  local: Record<string, number> | undefined,
  remote: Record<string, number> | undefined,
): Record<string, number> {
  const out: Record<string, number> = { ...(remote ?? {}) };
  for (const [id, stamp] of Object.entries(local ?? {})) {
    const existing = out[id];
    if (existing === undefined || stamp > existing) {
      out[id] = stamp;
    }
  }
  return out;
}

// Drop any item whose id is in the merged tombstones map. Used to
// suppress resurrection: if a stale device still has a deleted entry
// cached, the tombstone wins and the entry is filtered out of the
// merged collection.
function filterTombstoned<T extends IdItem>(
  items: T[],
  tombstones: Record<string, number>,
): T[] {
  return items.filter((it) => !(it.id in tombstones));
}

export function mergePayloads(
  local: StatePayload,
  remote: StatePayload,
): StatePayload {
  const localStamp = local.lastModifiedAt ?? 0;
  const remoteStamp = remote.lastModifiedAt ?? 0;
  const winner: "local" | "remote" =
    localStamp >= remoteStamp ? "local" : "remote";
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  return {
    transactions: filterTombstoned(
      unionById(local.transactions, remote.transactions, winner),
      tombstones,
    ),
    accounts: filterTombstoned(
      unionById(local.accounts, remote.accounts, winner),
      tombstones,
    ),
    // Groups need both layers filtered: the group id itself, and
    // each group's inner categories.
    groups: unionGroups(local.groups, remote.groups, winner)
      .filter((g) => !(g.id in tombstones))
      .map((g) => ({
        ...g,
        categories: g.categories
          ? filterTombstoned(g.categories, tombstones)
          : g.categories,
      })),
    assignments: unionAssignments(
      local.assignments,
      remote.assignments,
      winner,
    ),
    pinnedCategoryIds: unionStringSet(
      local.pinnedCategoryIds,
      remote.pinnedCategoryIds,
    ).filter((id) => !(id in tombstones)),
    targets: stripTombstonedKeys(
      unionRecord(local.targets, remote.targets, winner),
      tombstones,
    ),
    plannerFolders: filterTombstoned(
      unionById(local.plannerFolders, remote.plannerFolders, winner),
      tombstones,
    ),
    plannerBudgets: filterTombstoned(
      unionById(local.plannerBudgets, remote.plannerBudgets, winner),
      tombstones,
    ),
    plannerEntries: filterTombstoned(
      unionById(local.plannerEntries, remote.plannerEntries, winner),
      tombstones,
    ),
    fudgetRecurring: filterTombstoned(
      unionById(local.fudgetRecurring, remote.fudgetRecurring, winner),
      tombstones,
    ),
    scheduledTransactions: filterTombstoned(
      unionById(
        local.scheduledTransactions,
        remote.scheduledTransactions,
        winner,
      ),
      tombstones,
    ),
    reconciliations: filterTombstoned(
      unionById(local.reconciliations, remote.reconciliations, winner),
      tombstones,
    ),
    monthNotes: unionRecord(local.monthNotes, remote.monthNotes, winner),
    rules: filterTombstoned(
      unionById(local.rules, remote.rules, winner),
      tombstones,
    ),
    wishlist: filterTombstoned(
      unionById(local.wishlist, remote.wishlist, winner),
      tombstones,
    ),
    savingsGoals: filterTombstoned(
      unionById(local.savingsGoals, remote.savingsGoals, winner),
      tombstones,
    ),
    templates: filterTombstoned(
      unionById(local.templates, remote.templates, winner),
      tombstones,
    ),
    settings: winner === "local" ? local.settings : remote.settings,
    tombstones,
    lastModifiedAt: Math.max(localStamp, remoteStamp),
  };
}

// Drop record entries whose key is tombstoned. Used for targets, which
// is keyed by category id — if the category is gone, its target
// should be too.
function stripTombstonedKeys<V>(
  record: Record<string, V>,
  tombstones: Record<string, number>,
): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!(key in tombstones)) out[key] = value;
  }
  return out;
}
