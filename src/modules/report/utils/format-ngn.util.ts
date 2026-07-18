/** Formats minor currency units as NGN for display in reports. */
export function formatNgnFromAmount(amount: number): string {
  const naira = amount / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(naira);
}
