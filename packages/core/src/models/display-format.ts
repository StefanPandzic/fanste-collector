// How amounts and dates are written for people: the gallery, the dashboard and the PDF export
// (FC-26) all use these.

/** e.g. `€12.50`; without a currency just the number. */
export function formatMoney(amount: number, currency: string | null, locale?: string): string {
  if (!currency) return amount.toLocaleString(locale, { maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    // Not a currency Intl knows.
    return `${amount.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}`;
  }
}

/** A `YYYY-MM-DD` date as the user's locale writes it, e.g. `May 1, 2024`. */
export function formatDate(date: string, locale?: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}
