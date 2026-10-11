export const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d || 1)
}
export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export const addMonthsDate = (d: Date, n: number) => {
  const day = d.getDate()
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const dim = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, dim))
  return x
}
const mk = (y: number, m: number) => `${y}-${pad(m + 1)}`
export const addMonths = (k: string, n: number) => {
  const [y, m] = k.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return mk(Math.floor(t / 12), ((t % 12) + 12) % 12)
}
export const daysIn = (k: string) => {
  const [y, m] = k.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
export const monthEnd = (k: string) => `${k}-${pad(daysIn(k))}`

const now = new Date()
now.setHours(0, 0, 0, 0)
export const NOW = now
export const TODAY = iso(now)
export const THIS_MONTH = TODAY.slice(0, 7)

export const monthName = (k: string, long = true) =>
  parse(k + '-01').toLocaleDateString(undefined, long ? { month: 'long', year: 'numeric' } : { month: 'short' })
export const fmtDate = (s: string, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  parse(s).toLocaleDateString(undefined, o)
export const monthsBetween = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth()

/** "Today", "Yesterday", "Tomorrow" or a short weekday date. */
export function friendlyDay(s: string) {
  if (s === TODAY) return 'Today'
  if (s === iso(addDays(NOW, -1))) return 'Yesterday'
  if (s === iso(addDays(NOW, 1))) return 'Tomorrow'
  return fmtDate(s, { weekday: 'long', day: 'numeric', month: 'long' })
}
export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
