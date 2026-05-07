import { describe, expect, it } from "vitest";
import { applyRules, ruleMatches, type CategorizationRule } from "./categorization";

describe("ruleMatches", () => {
  it("contains is case-insensitive", () => {
    const rule: CategorizationRule = {
      id: "r1",
      pattern: "kroger",
      mode: "contains",
      category: "Groceries",
    };
    expect(ruleMatches(rule, "KROGER #455")).toBe(true);
    expect(ruleMatches(rule, "Whole Foods")).toBe(false);
  });

  it("exact requires the whole payee to match", () => {
    const rule: CategorizationRule = {
      id: "r1",
      pattern: "Spotify",
      mode: "exact",
      category: "Subscriptions",
    };
    expect(ruleMatches(rule, "Spotify")).toBe(true);
    expect(ruleMatches(rule, "Spotify USA")).toBe(false);
  });

  it("regex evaluates the raw pattern with case-insensitive flag", () => {
    const rule: CategorizationRule = {
      id: "r1",
      pattern: "^uber( eats)?$",
      mode: "regex",
      category: "Transportation",
    };
    expect(ruleMatches(rule, "Uber")).toBe(true);
    expect(ruleMatches(rule, "UBER EATS")).toBe(true);
    expect(ruleMatches(rule, "Lyft")).toBe(false);
  });

  it("invalid regex never throws and never matches", () => {
    const rule: CategorizationRule = {
      id: "r1",
      pattern: "[bad",
      mode: "regex",
      category: "Anything",
    };
    expect(() => ruleMatches(rule, "anything")).not.toThrow();
    expect(ruleMatches(rule, "anything")).toBe(false);
  });

  it("empty pattern never matches (avoids accidental catch-alls)", () => {
    const rule: CategorizationRule = {
      id: "r1",
      pattern: "  ",
      mode: "contains",
      category: "Misc",
    };
    expect(ruleMatches(rule, "Anything")).toBe(false);
  });
});

describe("applyRules", () => {
  it("first matching rule wins", () => {
    const rules: CategorizationRule[] = [
      { id: "1", pattern: "kroger", mode: "contains", category: "Groceries" },
      { id: "2", pattern: "kroger", mode: "contains", category: "Other" },
    ];
    expect(applyRules("Kroger", rules)).toBe("Groceries");
  });

  it("returns null when nothing matches", () => {
    const rules: CategorizationRule[] = [
      { id: "1", pattern: "kroger", mode: "contains", category: "Groceries" },
    ];
    expect(applyRules("Costco", rules)).toBeNull();
  });
});
