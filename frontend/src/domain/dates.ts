// Date-only helpers. dueDate strings are 'YYYY-MM-DD' and are compared as
// strings against local "today" — never parsed with new Date('YYYY-MM-DD')
// (that parses as UTC midnight and shifts the day in western timezones).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Local calendar date as 'YYYY-MM-DD'. */
export function todayLocal(): string {
  const d = new Date()
  return toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function isDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12) return false
  return d >= 1 && d <= daysInMonth(y, m)
}

export function daysInMonth(year: number, month: number): number {
  // Constructing from numeric parts is local-safe (no string parsing).
  return new Date(year, month, 0).getDate()
}

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = parts(from)
  const [ty, tm, td] = parts(to)
  // UTC epoch from numeric parts avoids DST-length days.
  const a = Date.UTC(fy, fm - 1, fd)
  const b = Date.UTC(ty, tm - 1, td)
  return Math.round((b - a) / 86_400_000)
}

export function dayOfWeek(date: string): number {
  const [y, m, d] = parts(date)
  return new Date(y, m - 1, d).getDay()
}

export function isOverdue(dueDate: string, today: string = todayLocal()): boolean {
  return dueDate < today
}

export interface DueLabel {
  text: string
  tone: 'today' | 'future' | 'overdue'
}

/** Relative label for a due date: Today / Tomorrow / Fri / Sep 12 / Yesterday / 3d overdue. */
export function dueLabel(dueDate: string, today: string = todayLocal()): DueLabel {
  const diff = daysBetween(today, dueDate)
  if (diff === 0) return { text: 'Today', tone: 'today' }
  if (diff === 1) return { text: 'Tomorrow', tone: 'future' }
  if (diff > 1 && diff < 7) {
    return { text: WEEKDAYS_SHORT[dayOfWeek(dueDate)], tone: 'future' }
  }
  if (diff >= 7) {
    const [, m, d] = parts(dueDate)
    return { text: `${MONTHS_SHORT[m - 1]} ${d}`, tone: 'future' }
  }
  if (diff === -1) return { text: 'Yesterday', tone: 'overdue' }
  return { text: `${-diff}d overdue`, tone: 'overdue' }
}

/** Page header, e.g. 'Saturday, Sep 6'. */
export function headerDate(date: string = todayLocal()): string {
  const [, m, d] = parts(date)
  return `${WEEKDAYS_LONG[dayOfWeek(date)]}, ${MONTHS_SHORT[m - 1]} ${d}`
}

/** 'Sep 2026' month caption for the date picker. */
export function monthCaption(year: number, month: number): string {
  return `${MONTHS_SHORT[month - 1]} ${year}`
}
