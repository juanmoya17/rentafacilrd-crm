const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Formats a date for the active locale in a fixed zone, so every viewer sees
 * the same day. A bare YYYY-MM-DD is a calendar date (a listing's expiry) and
 * is read in UTC so it never shifts; any other input is an instant, shown in
 * Santo Domingo time.
 */
export function formatDateValue(
  intlLocale: string,
  input: Date | string | number,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  const timeZone =
    typeof input === 'string' && CALENDAR_DATE.test(input) ? 'UTC' : 'America/Santo_Domingo'
  return new Intl.DateTimeFormat(intlLocale, { ...options, timeZone }).format(new Date(input))
}
