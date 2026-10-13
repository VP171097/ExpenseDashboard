import { addDays, addMonths, addMonthsDate, daysIn, iso, monthEnd, monthsBetween, NOW, parse, THIS_MONTH, TODAY } from './dates'
import type { Category, Debt, Freq, Item, Rule, State, Transfer, Tx } from './types'
import { money0 as fmtM } from './money'

/* Money is stored with at most two decimals and always added up in whole cents, so totals never drift. */
export const cents = (v: number) => Math.round((+v || 0) * 100)
export const sum = (a: number[]) => a.reduce((s, v) => s + cents(v), 0) / 100
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const uid = () => Math.random().toString(36).slice(2, 10)

export const FREQ: Record<Freq, { label: string; short: string; perMonth: number; step: (s: Date, i: number) => Date }> = {
  weekly: { label: 'Every week', short: 'weekly', perMonth: 52 / 12, step: (s, i) => addDays(s, 7 * i) },
  biweekly: { label: 'Every 2 weeks', short: 'every 2 weeks', perMonth: 26 / 12, step: (s, i) => addDays(s, 14 * i) },
  fourweekly: { label: 'Every 4 weeks', short: 'every 4 weeks', perMonth: 13 / 12, step: (s, i) => addDays(s, 28 * i) },
  monthly: { label: 'Every month', short: 'monthly', perMonth: 1, step: (s, i) => addMonthsDate(s, i) },
  quarterly: { label: 'Every 3 months', short: 'every 3 months', perMonth: 1 / 3, step: (s, i) => addMonthsDate(s, 3 * i) },
  semiannual: { label: 'Every 6 months', short: 'twice a year', perMonth: 1 / 6, step: (s, i) => addMonthsDate(s, 6 * i) },
  yearly: { label: 'Every year', short: 'yearly', perMonth: 1 / 12, step: (s, i) => addMonthsDate(s, 12 * i) },
}

/* Each state object is immutable, so results are cached per state. */
const caches = new WeakMap<State, Map<string, unknown>>()
function memo<T>(s: State, key: string, fn: () => T): T {
  let m = caches.get(s)
  if (!m) caches.set(s, (m = new Map()))
  if (!m.has(key)) m.set(key, fn())
  return m.get(key) as T
}

export const catOf = (s: State, id: string) => s.categories.find((c) => c.id === id)
export const catName = (s: State, id: string) => catOf(s, id)?.name ?? 'Other'
export const catColor = (c?: Category | null) =>
  c?.kind === 'income' ? 'var(--s1)' : c?.kind === 'savings' ? 'var(--s3)' : c && c.slot != null ? `var(--s${c.slot + 1})` : 'var(--sother)'
export const accountName = (s: State, id?: string) => s.accounts.find((a) => a.id === id)?.name ?? ''
export const spendCats = (s: State) => s.categories.filter((c) => c.kind === 'expense')

export function occurrences(r: Rule, from: string, to: string) {
  const out: string[] = []
  const start = parse(r.start)
  const f = FREQ[r.freq] ?? FREQ.monthly
  for (let i = 0; i < 4000; i++) {
    const d = iso(f.step(start, i))
    if (d > to || (r.end && d > r.end)) break
    if (d >= from) out.push(d)
  }
  return out
}
export const ruleKey = (id: string, d: string) => `${id}|${d}`
export function isPaid(s: State, r: Rule, d: string) {
  const k = ruleKey(r.id, d)
  if (k in s.paid) return s.paid[k]
  return !!r.paidThrough && d <= r.paidThrough
}

/* One-off entries grouped by month, so a query only touches the months it needs. */
function txIndex(s: State) {
  return memo(s, 'txIndex', () => {
    const m = new Map<string, Tx[]>()
    for (const t of s.tx) { const k = t.date.slice(0, 7); let b = m.get(k); if (!b) m.set(k, (b = [])); b.push(t) }
    return { byMonth: m, months: [...m.keys()].sort() }
  })
}
function transfersByMonth(s: State) {
  return memo(s, 'trIndex', () => {
    const m = new Map<string, Transfer[]>()
    for (const t of s.transfers ?? []) { const k = t.date.slice(0, 7); let b = m.get(k); if (!b) m.set(k, (b = [])); b.push(t) }
    return m
  })
}
/* Unchanged entries keep their object identity between edits, so their list form is built once. */
const itemCache = new WeakMap<Tx, Item>()
const asItem = (t: Tx) => { let i = itemCache.get(t); if (!i) { i = { ...t, paid: true }; itemCache.set(t, i) } return i }

export function itemsIn(s: State, from: string, to: string): Item[] {
  return memo(s, `items|${from}|${to}`, () => {
    const out: Item[] = []
    const fm = from.slice(0, 7), tm = to.slice(0, 7), idx = txIndex(s)
    for (const k of idx.months) {
      if (k < fm || k > tm) continue
      const edge = k === fm || k === tm
      for (const t of idx.byMonth.get(k)!) if (!edge || (t.date >= from && t.date <= to)) out.push(asItem(t))
    }
    // look a month either side so a single payment moved across a month boundary still shows up
    const wideFrom = iso(addDays(parse(from), -40)), wideTo = to > '2900' ? to : iso(addDays(parse(to), 40))
    for (const r of s.rules)
      for (const d of occurrences(r, wideFrom, wideTo)) {
        const key = ruleKey(r.id, d)
        if (s.skip[key]) continue
        const ov = s.overrides?.[key]
        const date = ov?.date ?? d
        if (date < from || date > to) continue
        out.push({
          id: `r|${r.id}|${d}`, ruleId: r.id, virtual: true, occ: d, date, amount: ov?.amount ?? +r.amount, type: r.type, cat: r.cat, sub: r.sub,
          account: r.account, to: r.to, person: r.person, note: r.name, paid: isPaid(s, r, d), changed: !!ov,
        })
      }
    return out
  })
}
export const monthItems = (s: State, k: string) => itemsIn(s, k + '-01', monthEnd(k))

export interface MonthStats {
  income: number; spent: number; saved: number
  expectedIn: number; billsDue: number; savingDue: number; nDue: number
  everydaySpent: number; billsAll: number
  byCat: Record<string, number>; byGroup: Record<'essentials' | 'extras' | 'future', number>; byPerson: Record<string, number>
  bySub: Record<string, Record<string, number>>
  /** per person: money in, put aside and spending by category */
  people: Record<string, { in: number; saved: number; spent: number; byCat: Record<string, number> }>
  byDay: number[]; extrasDay: number[]; inDay: number[]; savedDay: number[]
  biggest: Item | null
}
export function monthStats(s: State, k: string): MonthStats {
  return memo(s, 'st|' + k, () => {
    const dim = daysIn(k)
    const z = () => Array(dim + 1).fill(0) as number[]
    // everything below is counted in whole cents and converted back at the end
    const m: MonthStats = {
      income: 0, spent: 0, saved: 0, expectedIn: 0, billsDue: 0, savingDue: 0, nDue: 0, everydaySpent: 0, billsAll: 0,
      byCat: {}, byGroup: { essentials: 0, extras: 0, future: 0 }, byPerson: {}, byDay: z(), extrasDay: z(), inDay: z(), savedDay: z(), biggest: null, bySub: {}, people: {},
    }
    const P = (n?: string) => (m.people[n || '—'] ??= { in: 0, saved: 0, spent: 0, byCat: {} })
    for (const t of monthItems(s, k)) {
      const a = cents(t.amount), day = +t.date.slice(8)
      if (t.virtual && t.type === 'expense') m.billsAll += a
      if (!t.paid) {
        if (t.type === 'income') m.expectedIn += a
        else { m.billsDue += a; m.nDue++; if (t.type === 'savings') m.savingDue += a }
        continue
      }
      if (t.type === 'income') { m.income += a; m.inDay[day] += a; P(t.person).in += a }
      else if (t.type === 'savings') { m.saved += a; m.byGroup.future += a; m.savedDay[day] += a; P(t.person).saved += a }
      else {
        m.spent += a
        m.byCat[t.cat] = (m.byCat[t.cat] || 0) + a
        const g = catOf(s, t.cat)?.group ?? 'extras'
        m.byGroup[g === 'future' ? 'extras' : g] += a
        if (t.person) m.byPerson[t.person] = (m.byPerson[t.person] || 0) + a
        const pp = P(t.person); pp.spent += a; pp.byCat[t.cat] = (pp.byCat[t.cat] || 0) + a
        const sb = (m.bySub[t.cat] ??= {}); sb[t.sub || ''] = (sb[t.sub || ''] || 0) + a
        if (!t.virtual) m.everydaySpent += a
        m.byDay[day] += a
        if (g === 'extras') m.extrasDay[day] += a
        if (!t.virtual && (!m.biggest || t.amount > m.biggest.amount)) m.biggest = t
      }
    }
    const d = (v: number) => v / 100
    const dm = (o: Record<string, number>) => { for (const key in o) o[key] = d(o[key]) }
    for (const key of ['income', 'spent', 'saved', 'expectedIn', 'billsDue', 'savingDue', 'everydaySpent', 'billsAll'] as const) m[key] = d(m[key])
    dm(m.byCat); dm(m.byGroup as Record<string, number>); dm(m.byPerson)
    for (const a of [m.byDay, m.extrasDay, m.inDay, m.savedDay]) for (let i = 0; i < a.length; i++) a[i] = d(a[i])
    for (const c in m.bySub) dm(m.bySub[c])
    for (const p in m.people) { const x = m.people[p]; x.in = d(x.in); x.saved = d(x.saved); x.spent = d(x.spent); dm(x.byCat) }
    return m
  })
}

function firstMonth(s: State) {
  return memo(s, 'first', () => {
    let m = THIS_MONTH
    s.tx.forEach((t) => { if (t.date.slice(0, 7) < m) m = t.date.slice(0, 7) })
    s.rules.forEach((r) => { if (r.start.slice(0, 7) < m) m = r.start.slice(0, 7) })
    ;(s.transfers ?? []).forEach((t) => { if (t.date.slice(0, 7) < m) m = t.date.slice(0, 7) })
    return m
  })
}
/** The plan for a category this month, including leftovers carried in when roll-over is on. */
export function planFor(s: State, c: Category, k: string, depth = 0): number {
  const base = +c.plan || 0
  if (!s.settings.rollover || depth >= 6) return base
  const pk = addMonths(k, -1)
  if (pk < firstMonth(s)) return base
  const prev = planFor(s, c, pk, depth + 1)
  return Math.max(0, base + (prev - (monthStats(s, pk).byCat[c.id] || 0)))
}
export const totalPlan = (s: State, k: string) => memo(s, 'tp|' + k, () => sum(spendCats(s).map((c) => planFor(s, c, k))))

type Cents = Record<string, number>
/** How each account moved (in cents) from paid items and transfers in a date range inside one month. */
function deltas(s: State, from: string, to: string): Cents {
  const b: Cents = {}
  for (const t of itemsIn(s, from, to)) {
    if (!t.paid) continue
    const a = cents(t.amount)
    if (t.type === 'income') b[t.account] = (b[t.account] || 0) + a
    else { b[t.account] = (b[t.account] || 0) - a; if (t.type === 'savings' && t.to) b[t.to] = (b[t.to] || 0) + a }
  }
  for (const t of transfersByMonth(s).get(from.slice(0, 7)) ?? []) if (t.date >= from && t.date <= to) {
    const a = cents(t.amount); b[t.from] = (b[t.from] || 0) - a; b[t.to] = (b[t.to] || 0) + a
  }
  return b
}
/** Balances (cents) at the end of every month, built forward one month at a time and cached. */
function monthEndBalances(s: State, k: string): Cents {
  const cache = memo(s, 'balEnd', () => new Map<string, Cents>())
  const first = firstMonth(s)
  const starts: Cents = {}
  s.accounts.forEach((a) => (starts[a.id] = cents(a.start)))
  if (k < first) return starts
  if (cache.has(k)) return cache.get(k)!
  let cur = first, prev = starts
  // resume from the latest cached month before k
  for (let x = addMonths(k, -1); x >= first; x = addMonths(x, -1)) if (cache.has(x)) { prev = cache.get(x)!; cur = addMonths(x, 1); break }
  for (; cur <= k; cur = addMonths(cur, 1)) {
    const d = deltas(s, cur + '-01', monthEnd(cur)), next = { ...prev }
    for (const id in d) next[id] = (next[id] || 0) + d[id]
    cache.set(cur, next)
    prev = next
  }
  return cache.get(k)!
}
/** Account balances at the end of a given day (today by default). */
export function balances(s: State, upTo = TODAY) {
  return memo(s, 'bal|' + upTo, () => {
    const k = upTo.slice(0, 7)
    const b = { ...monthEndBalances(s, addMonths(k, -1)) }
    const d = deltas(s, k + '-01', upTo)
    for (const id in d) b[id] = (b[id] || 0) + d[id]
    const out: Record<string, number> = {}
    s.accounts.forEach((a) => (out[a.id] = 0))
    for (const id in b) out[id] = b[id] / 100
    return out
  })
}
/** Money that came into and went out of one account between two dates (transfers included). */
export function accountFlows(s: State, id: string, from: string, to: string) {
  let received = 0, withdrawn = 0
  for (const t of itemsIn(s, from, to)) {
    if (!t.paid) continue
    if (t.type === 'income' && t.account === id) received += t.amount
    else if (t.type !== 'income' && t.account === id) withdrawn += t.amount
    if (t.type === 'savings' && t.to === id) received += t.amount
  }
  for (const t of s.transfers ?? []) if (t.date >= from && t.date <= to) { if (t.to === id) received += t.amount; if (t.from === id) withdrawn += t.amount }
  return { received, withdrawn }
}
/** Possible double entries: same amount and category within a day of each other. */
export function findDuplicate(s: State, t: { id?: string; date: string; amount: number; cat: string }) {
  const lo = iso(addDays(parse(t.date), -1)), hi = iso(addDays(parse(t.date), 1))
  const idx = txIndex(s).byMonth
  for (const k of new Set([lo.slice(0, 7), t.date.slice(0, 7), hi.slice(0, 7)]))
    for (const x of idx.get(k) ?? []) if (x.id !== t.id && x.cat === t.cat && cents(x.amount) === cents(t.amount) && x.date >= lo && x.date <= hi) return x
  return null
}
export function duplicateIds(s: State) {
  return memo(s, 'dups', () => {
    const groups = new Map<string, { id: string; date: string }[]>()
    for (const t of s.tx) {
      const k = `${t.cat}|${t.amount.toFixed(2)}`
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(t)
    }
    const out = new Set<string>()
    for (const g of groups.values()) {
      if (g.length < 2) continue
      g.sort((x, y) => x.date.localeCompare(y.date))
      for (let i = 1; i < g.length; i++)
        if ((parse(g[i].date).getTime() - parse(g[i - 1].date).getTime()) / 86400000 <= 1) { out.add(g[i].id); out.add(g[i - 1].id) }
    }
    return out
  })
}

export function worthNow(s: State) {
  const b = balances(s)
  let own = 0, owe = 0
  s.accounts.forEach((a) => { const v = b[a.id] || 0; if (v >= 0) own += v; else owe -= v })
  s.holdings.forEach((h) => { if (h.kind === 'owe') owe += +h.value || 0; else own += +h.value || 0 })
  s.debts.forEach((d) => (owe += +d.balance || 0))
  return { own, owe, net: own - owe }
}

export const perMonth = (r: Rule) => (+r.amount || 0) * (FREQ[r.freq]?.perMonth ?? 1)
export function nextDue(s: State, r: Rule) {
  return occurrences(r, TODAY, iso(addMonthsDate(NOW, 13))).find((d) => !s.skip[ruleKey(r.id, d)]) ?? null
}
/** Unpaid bills and transfers from the start of this month up to `days` from today. */
export function upcoming(s: State, days: number) {
  return itemsIn(s, THIS_MONTH + '-01', iso(addDays(NOW, days)))
    .filter((t) => t.virtual && !t.paid && t.type !== 'income')
    .sort((a, b) => a.date.localeCompare(b.date))
}

/* ---------- the "safe to spend" picture for a month ---------- */
export function monthPicture(s: State, k: string) {
  const m = monthStats(s, k)
  const isCur = k === THIS_MONTH, isFuture = k > THIS_MONTH
  const dim = daysIn(k)
  const elapsed = isCur ? NOW.getDate() : isFuture ? 0 : dim
  const daysLeft = isCur ? dim - NOW.getDate() + 1 : isFuture ? dim : 0
  const moneyIn = m.income + m.expectedIn
  const safe = moneyIn - m.spent - m.saved - m.billsDue
  const plan = totalPlan(s, k)
  const forecast = isCur && elapsed ? m.billsAll + (m.everydaySpent / elapsed) * dim : isFuture ? m.billsAll : m.spent
  return { m, isCur, isFuture, dim, elapsed, daysLeft, moneyIn, safe, plan, forecast, perDay: daysLeft ? safe / daysLeft : 0 }
}

/* ---------- debts ---------- */
export function simulate(debts: Debt[], extra: number, strategy: 'cheapest' | 'quickwins' | 'custom') {
  const ds = debts.map((d, i) => ({ ...d, bal: +d.balance, rank: d.order ?? i, int: 0, paid: 0 })).filter((d) => d.bal > 0)
  const budget = sum(ds.map((d) => +d.min)) + (+extra || 0)
  let month = 0, interest = 0
  const line = [sum(ds.map((d) => d.bal))]
  const payoff: Record<string, number> = {}
  const order = () =>
    ds.filter((d) => d.bal > 0.005).sort(strategy === 'quickwins' ? (a, b) => a.bal - b.bal : strategy === 'custom' ? (a, b) => a.rank - b.rank : (a, b) => b.rate - a.rate || a.bal - b.bal)
  while (ds.some((d) => d.bal > 0.005) && month < 600) {
    month++
    ds.forEach((d) => { if (d.bal > 0.005) { const i = (d.bal * d.rate) / 1200; d.bal += i; interest += i; d.int += i } })
    let pool = budget
    ds.forEach((d) => { if (d.bal > 0.005) { const p = Math.min(d.bal, +d.min); d.bal -= p; d.paid += p; pool -= p } })
    for (const d of order()) { if (pool <= 0) break; const p = Math.min(d.bal, pool); d.bal -= p; d.paid += p; pool -= p }
    ds.forEach((d) => { if (d.bal <= 0.005 && !payoff[d.id]) payoff[d.id] = month })
    line.push(sum(ds.map((d) => Math.max(0, d.bal))))
  }
  const per: Record<string, { interest: number; paid: number }> = {}
  ds.forEach((d) => (per[d.id] = { interest: d.int, paid: d.paid }))
  return { months: month, interest, line, payoff, per, stuck: month >= 600 }
}

/* ---------- money health score ---------- */
export interface Check { ok: boolean | 'half'; title: string; detail: string; points: number; max: number }
export function health(s: State, k: string) {
  return memo(s, 'health|' + k, () => {
    const p = monthPicture(s, k), m = p.m
    const checks: Check[] = []
    // 1. staying within the plan
    if (p.plan > 0) {
      const r = p.forecast / p.plan
      const pts = r <= 1 ? 30 : r <= 1.1 ? 15 : 0
      checks.push({
        ok: pts === 30 ? true : pts ? 'half' : false, points: pts, max: 30,
        title: r <= 1 ? 'Spending is within your plan' : r <= 1.1 ? 'Spending is a little over your plan' : 'Spending is heading well over your plan',
        detail: p.isCur ? `At this rate the month ends at about ${fmtM(p.forecast)}, against a plan of ${fmtM(p.plan)}.` : `You spent ${fmtM(m.spent)} against a plan of ${fmtM(p.plan)}.`,
      })
    }
    // 2. putting money aside
    const target = s.settings.ratios[2] / 100
    const rate = p.moneyIn ? (m.saved + m.savingDue) / p.moneyIn : 0
    const pts2 = rate >= target ? 25 : rate >= target / 2 ? 12 : 0
    checks.push({
      ok: pts2 === 25 ? true : pts2 ? 'half' : false, points: pts2, max: 25,
      title: rate >= target ? 'You are putting enough aside' : 'You could put more aside',
      detail: `${Math.round(rate * 100)}% of the money coming in goes to savings. A healthy amount is ${Math.round(target * 100)}% or more.`,
    })
    // 3. bills on time
    const overdue = itemsIn(s, k + '-01', TODAY < monthEnd(k) ? iso(addDays(NOW, -1)) : monthEnd(k)).filter((t) => t.virtual && !t.paid && t.type !== 'income' && t.date < TODAY)
    checks.push({
      ok: overdue.length ? false : true, points: overdue.length ? 5 : 20, max: 20,
      title: overdue.length ? `${overdue.length} bill${overdue.length > 1 ? 's are' : ' is'} not ticked off yet` : 'Bills are paid on time',
      detail: overdue.length ? `Tick off ${overdue.map((t) => t.note).slice(0, 3).join(', ')} once paid, so your numbers stay right.` : 'Every bill due so far this month is marked as paid.',
    })
    // 4. safety cushion
    const bal = balances(s)
    const cushion = sum(s.accounts.filter((a) => a.type === 'savings').map((a) => Math.max(0, bal[a.id] || 0)))
    const essentials = Math.max(1, sum(spendCats(s).filter((c) => c.group === 'essentials').map((c) => +c.plan)))
    const months = cushion / essentials
    const pts4 = months >= 3 ? 25 : months >= 1 ? 12 : 0
    checks.push({
      ok: pts4 === 25 ? true : pts4 ? 'half' : false, points: pts4, max: 25,
      title: months >= 3 ? 'You have a safety cushion' : 'Build a safety cushion',
      detail: `Your savings would cover about ${months.toFixed(1)} month${months.toFixed(1) === '1.0' ? '' : 's'} of essentials if your income stopped. Three months or more is a good aim.`,
    })
    const max = sum(checks.map((c) => c.max))
    const score = Math.round((sum(checks.map((c) => c.points)) / max) * 100)
    const label = score >= 80 ? 'Looking great' : score >= 60 ? 'Doing well' : score >= 40 ? 'Needs a little care' : "Let's fix this together"
    const tone: 'good' | 'warn' | 'bad' = score >= 60 ? 'good' : score >= 40 ? 'warn' : 'bad'
    return { score, label, tone, checks }
  })
}

/* ---------- plain-language tips ---------- */
export interface Tip { tone: 'good' | 'warn' | 'bad' | 'info'; text: string; action?: { label: string; view: string } }
export function tips(s: State, k: string): Tip[] {
  const p = monthPicture(s, k), m = p.m, out: Tip[] = []
  if (p.isCur && p.plan && NOW.getDate() > 3) {
    const d = p.forecast - p.plan
    out.push(d > 0
      ? { tone: 'bad', text: `At this rate you'll spend about ${fmtM(d)} more than planned this month. Holding back on extras for a few days would help.`, action: { label: 'See my plan', view: 'plan' } }
      : { tone: 'good', text: `Nice! You're on track to finish about ${fmtM(-d)} under your plan this month.` })
  }
  const prev3 = [1, 2, 3].map((i) => monthStats(s, addMonths(k, -i)))
  let best: { name: string; r: number; now: number; avg: number } | null = null
  for (const c of spendCats(s)) {
    const now = m.byCat[c.id] || 0, avg = sum(prev3.map((x) => x.byCat[c.id] || 0)) / 3
    if (avg > 40 && now > avg * 1.15 && now - avg > 40) { const r = now / avg - 1; if (!best || r > best.r) best = { name: c.name, r, now, avg } }
  }
  if (best) out.push({ tone: 'warn', text: `${best.name} is higher than usual: ${fmtM(best.now)} so far, compared with about ${fmtM(best.avg)} in a normal month.`, action: { label: 'See where it went', view: 'activity' } })
  const over = spendCats(s).filter((c) => { const pl = planFor(s, c, k); return pl > 0 && (m.byCat[c.id] || 0) > pl })
  if (over.length) out.push({ tone: 'bad', text: `You've gone over your plan for ${over.map((c) => c.name).join(', ')}.`, action: { label: 'Adjust plan', view: 'plan' } })
  const subs = s.rules.filter((r) => r.cat === 'subs')
  if (subs.length) out.push({ tone: 'info', text: `Your subscriptions add up to ${fmtM(sum(subs.map(perMonth)) * 12)} a year. Cancelling one you rarely use is an easy win.`, action: { label: 'Check bills', view: 'bills' } })
  if (p.safe > 300 && p.isCur && s.goals.some((g) => g.saved < g.target))
    out.push({ tone: 'info', text: `You have ${fmtM(p.safe)} free this month. Moving a little into a savings goal now means you won't spend it by accident.`, action: { label: 'Open goals', view: 'goals' } })
  return out.slice(0, 4)
}

export const monthsUntil = (due: string) => Math.max(1, monthsBetween(NOW, parse(due)))

/* ---------- pay periods ---------- */
export function payPeriod(s: State, offset = 0) {
  const st = s.settings, anchor = parse(st.payAnchor || TODAY)
  if (st.payCycle === 'monthly' || st.payCycle === 'semimonthly') {
    const day = anchor.getDate()
    if (st.payCycle === 'monthly') {
      let start = new Date(NOW.getFullYear(), NOW.getMonth(), Math.min(day, 28))
      if (start > NOW) start = addMonthsDate(start, -1)
      start = addMonthsDate(start, offset)
      return { start: iso(start), end: iso(addDays(addMonthsDate(start, 1), -1)) }
    }
    // twice a month: 1st-15th and 16th-end
    const halves: [Date, Date][] = []
    for (let m = -14; m <= 14; m++) {
      const b = new Date(NOW.getFullYear(), NOW.getMonth() + m, 1)
      halves.push([b, new Date(b.getFullYear(), b.getMonth(), 15)], [new Date(b.getFullYear(), b.getMonth(), 16), new Date(b.getFullYear(), b.getMonth() + 1, 0)])
    }
    const i = halves.findIndex(([a, b]) => NOW >= a && NOW <= b) + offset
    const [a, b] = halves[Math.max(0, Math.min(halves.length - 1, i))]
    return { start: iso(a), end: iso(b) }
  }
  const len = st.payCycle === 'weekly' ? 7 : st.payCycle === 'biweekly' ? 14 : Math.max(1, st.payDays || 14)
  const diff = Math.floor((NOW.getTime() - anchor.getTime()) / 86400000)
  const n = Math.floor(diff / len) + offset
  const start = addDays(anchor, n * len)
  return { start: iso(start), end: iso(addDays(start, len - 1)) }
}

/* ---------- a whole year ---------- */
export function yearStats(s: State, y: number) {
  return memo(s, 'year|' + y, () => {
    const months = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`)
    const ms = months.map((k) => monthStats(s, k))
    return {
      months, ms,
      income: sum(ms.map((m) => m.income)), spent: sum(ms.map((m) => m.spent)), saved: sum(ms.map((m) => m.saved)),
      byCat: ms.reduce((acc, m) => { for (const [c, v] of Object.entries(m.byCat)) acc[c] = (acc[c] || 0) + v; return acc }, {} as Record<string, number>),
    }
  })
}

/* ---------- search ---------- */
const searchCache = new WeakMap<Item, string>()
/** Lower-case text an entry can be found by: description, category, sub-category, amount and person. */
export function searchText(s: State, t: Item) {
  let v = searchCache.get(t)
  if (v == null) {
    v = `${t.note} ${catName(s, t.cat)} ${t.sub ?? ''} ${t.amount} ${t.amount.toFixed(2)} ${t.person ?? ''}`.toLowerCase()
    searchCache.set(t, v)
  }
  return v
}
/** The first month that has any data, for "all time" views. */
export const earliestMonth = (s: State) => firstMonth(s)

/* ---------- savings goals ---------- */
export type GoalState = 'done' | 'late' | 'behind' | 'on-track' | 'new'
/** Where a goal stands, based on its target date and what was added over the last three months. */
export function goalStatus(g: { target: number; saved: number; due: string; history?: { date: string; amount: number }[] }) {
  const remaining = Math.max(0, g.target - g.saved)
  const monthsLeft = monthsUntil(g.due)
  const need = remaining / monthsLeft
  const since = iso(addDays(NOW, -91))
  const recent = sum((g.history ?? []).filter((h) => h.date >= since).map((h) => h.amount))
  const pace = recent / 3
  const state: GoalState = remaining <= 0 ? 'done' : g.due < TODAY ? 'late' : !g.history?.length ? 'new' : pace >= need * 0.9 ? 'on-track' : 'behind'
  const eta = pace > 0 && remaining > 0 ? addMonthsDate(NOW, Math.ceil(remaining / pace)) : null
  return { state, remaining, need, pace, eta, monthsLeft }
}
