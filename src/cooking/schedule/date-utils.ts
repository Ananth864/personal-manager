/**
 * Calendar-date helpers for the Schedule. All arithmetic is done on UTC-noon
 * Date values parsed from `yyyy-mm-dd` strings, so daylight-saving edges can't
 * roll a date into the wrong day. "Today" is the user's *local* today.
 *
 * Isomorphic — used by both the schedule service (server) and the schedule UI.
 */

/** Parse a `yyyy-mm-dd` string into a Date at UTC noon (stable for arithmetic). */
function utcNoon(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local today as `yyyy-mm-dd`. */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Format a UTC Date (constructed from an ISO date) back to `yyyy-mm-dd`. */
function toISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Add `n` days to a `yyyy-mm-dd` string. */
export function addDays(iso: string, n: number): string {
  const d = utcNoon(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toISODate(d)
}

/** The Monday of the week containing `iso` (weeks are Monday–Sunday). */
export function mondayOfWeek(iso: string): string {
  const d = utcNoon(iso)
  const dow = d.getUTCDay() // 0 = Sun … 6 = Sat
  const offset = dow === 0 ? -6 : 1 - dow // shift back to Monday
  return addDays(iso, offset)
}

/** The Monday of the current week. */
export function currentWeekStart(): string {
  return mondayOfWeek(todayISO())
}

/** The seven ISO dates of the week starting Monday `weekStart`. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function isToday(iso: string): boolean {
  return iso === todayISO()
}

/** A calendar date strictly before today. */
export function isPastDay(iso: string): boolean {
  return iso < todayISO()
}

/** The whole week (Mon–Sun) is in the past — a read-only archive. */
export function isPastWeek(weekStart: string): boolean {
  return addDays(weekStart, 6) < todayISO()
}

export interface DayLabel {
  weekday: string // "Mon"
  month: string // "Jul"
  day: string // "21"
}

export function dayLabel(iso: string): DayLabel {
  const d = utcNoon(iso)
  return {
    weekday: d.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    month: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    day: String(d.getUTCDate()),
  }
}

/** "Jul 21 – 27" (or "Jul 28 – Aug 3" across a month boundary). */
export function weekRangeLabel(weekStart: string): string {
  const start = utcNoon(weekStart)
  const end = utcNoon(addDays(weekStart, 6))
  const sameMonth = start.getUTCMonth() === end.getUTCMonth()
  const fmt = (d: Date, withMonth: boolean) => {
    const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    return withMonth ? `${mon} ${d.getUTCDate()}` : String(d.getUTCDate())
  }
  return `${fmt(start, true)} – ${fmt(end, !sameMonth)}`
}
