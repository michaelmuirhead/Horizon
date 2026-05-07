export type RuleMode = "contains" | "exact" | "regex";

export type CategorizationRule = {
  id: string;
  pattern: string;
  mode: RuleMode;
  category: string; // category name to apply
};

// True when this rule's pattern fires against the given payee. Regex
// patterns that fail to compile are treated as no-match rather than
// throwing — a typo in the rules editor shouldn't break the importer.
export function ruleMatches(rule: CategorizationRule, payee: string): boolean {
  const needle = payee.trim().toLowerCase();
  const pattern = rule.pattern.trim().toLowerCase();
  if (pattern === "") return false;
  if (rule.mode === "exact") return needle === pattern;
  if (rule.mode === "contains") return needle.includes(pattern);
  if (rule.mode === "regex") {
    try {
      const re = new RegExp(rule.pattern, "i");
      return re.test(payee);
    } catch {
      return false;
    }
  }
  return false;
}

// Walks rules in order and returns the first matching rule's category.
// First-match-wins is intentional so the user controls priority by
// reordering — top rule always trumps a later one for the same payee.
export function applyRules(
  payee: string,
  rules: CategorizationRule[],
): string | null {
  for (const rule of rules) {
    if (ruleMatches(rule, payee)) return rule.category;
  }
  return null;
}
