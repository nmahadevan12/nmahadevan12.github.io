const DAY_MS = 86_400_000;
const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthOnly = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/** `2026-06` → the first instant of June 2026, UTC. */
export function parseMonth(value: string): Date {
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function toMonthString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonth(date: Date): string {
  return monthYear.format(date);
}

/** "Aug 2026", "Jan – Apr 2026", "Sep 2025 – May 2026", or "Sep 2026 – Present" when there's no end. */
export function formatMonthRange(start: Date, end?: Date): string {
  if (!end) return `${monthYear.format(start)} – Present`;
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  if (sameYear && start.getUTCMonth() === end.getUTCMonth()) return monthYear.format(start);
  if (sameYear) return `${monthOnly.format(start)} – ${monthYear.format(end)}`;
  return `${monthYear.format(start)} – ${monthYear.format(end)}`;
}

/** Calendar length between two instants (ms): "2 yr 2 mo", "9 mo", "1 mo 17 d", "4 d", "6 h". */
export function formatDuration(fromMs: number, toMs: number): string {
  const from = new Date(fromMs);
  const to = new Date(toMs);
  const shifted = (months: number) =>
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + months,
      from.getUTCDate(),
      from.getUTCHours(),
      from.getUTCMinutes(),
    );

  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (shifted(months) > toMs) months -= 1;
  const days = (toMs - shifted(months)) / DAY_MS;
  const years = Math.floor(months / 12);
  const rest = months % 12;

  if (years > 0) return rest > 0 ? `${years} yr ${rest} mo` : `${years} yr`;
  if (rest > 0) return Math.floor(days) > 0 ? `${rest} mo ${Math.floor(days)} d` : `${rest} mo`;
  if (days >= 1) return `${Math.round(days)} d`;
  const hours = days * 24;
  if (hours >= 1) return `${Math.round(hours)} h`;
  return `${Math.max(1, Math.round(hours * 60))} min`;
}

/** Short label for a span of days, used for the "time per 100 px" readout. */
export function formatScale(days: number): string {
  const round = (n: number) => (n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10));
  // Slightly under a unit (float drift after zooming to a preset) still reads as that unit.
  const atLeast = (unit: number) => days >= unit * 0.995;
  if (atLeast(365)) return `${round(days / 365.25)} yr`;
  if (atLeast(30)) return `${round(days / 30.44)} mo`;
  if (atLeast(7)) return `${round(days / 7)} wk`;
  if (atLeast(1)) return `${round(days)} d`;
  if (atLeast(1 / 24)) return `${round(days * 24)} h`;
  return `${round(days * 1440)} min`;
}
