export type TransactionTemplateDirection = "outflow" | "inflow";

export type TransactionTemplate = {
  id: string;
  // User-facing label for the template list ("Coffee at Joe's").
  name: string;
  // What the resulting transaction will look like when applied.
  payee: string;
  category: string;
  account?: string;
  amount: number; // positive magnitude; sign comes from direction
  direction: TransactionTemplateDirection;
  memo?: string;
  tags?: string[];
};

export const sampleTemplates: TransactionTemplate[] = [];
