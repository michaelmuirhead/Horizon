// Formatter is rebuilt whenever setCurrency is called so we can support
// Intl-supported currency codes without threading a dependency through every
// caller. UI changes that need a re-render after switching currency should
// reload the page (the Settings page does this).
let currentCurrency = "USD";
let currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: currentCurrency,
  minimumFractionDigits: 2,
});

export function getCurrency(): string {
  return currentCurrency;
}

export function setCurrency(code: string): void {
  if (!code || code === currentCurrency) return;
  try {
    const next = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
    });
    currentCurrency = code;
    currencyFormatter = next;
  } catch {
    // Ignore invalid currency codes; keep the existing formatter.
  }
}

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
