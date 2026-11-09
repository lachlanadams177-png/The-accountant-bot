import type { ISODate } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): ISODate {
  return toISO(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Monday = 0 … Sunday = 6 */
export function weekdayIndex(s: ISODate): number {
  return (fromISO(s).getDay() + 6) % 7
}

export function startOfWeek(s: ISODate): ISODate {
  return addDays(s, -weekdayIndex(s))
}

export function weekDates(monday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86400000)
}

export function isPast(s: ISODate): boolean {
  return s < today()
}

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const fmt = (s: ISODate, o: Intl.DateTimeFormatOptions) => fromISO(s).toLocaleDateString('en-AU', o)

/** 9/11/2026 */
export const fmtShort = (s: ISODate) => fmt(s, { day: 'numeric', month: 'numeric', year: 'numeric' })
/** Mon 9 Nov */
export const fmtDay = (s: ISODate) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' })
/** Monday 9 November */
export const fmtLong = (s: ISODate) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' })
/** 9 Nov */
export const fmtDM = (s: ISODate) => fmt(s, { day: 'numeric', month: 'short' })
/** November 2026 */
export const fmtMonth = (s: ISODate) => fmt(s, { month: 'long', year: 'numeric' })

/** "Today", "Tomorrow", "Yesterday", or "Mon 9 Nov" */
export function relDay(s: ISODate): string {
  const d = diffDays(s, today())
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d === -1) return 'Yesterday'
  return fmtDay(s)
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

/** '07:30' -> '7:30 am' */
export function fmtClock(t?: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const am = h < 12
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${pad(m)} ${am ? 'am' : 'pm'}`
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** ISO date + local time -> full ISO timestamp */
export function stamp(date: ISODate, hour = 9, minute = 0): string {
  const d = fromISO(date)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
