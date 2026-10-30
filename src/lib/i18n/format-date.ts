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

/**
 * Moment a listing's expiry stops counting. A bare YYYY-MM-DD is the last live
 * day, so it runs to the end of that day in Santo Domingo (UTC-4, no DST); a
 * full instant is returned as is.
 */
export function calendarDateEnd(value: string): Date {
  return new Date(CALENDAR_DATE.test(value) ? `${value}T23:59:59-04:00` : value)
}
