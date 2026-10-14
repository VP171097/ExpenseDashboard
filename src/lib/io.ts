import { catName, accountName, cents, itemsIn, tripOf, uid } from './calc'
import { pad, TODAY } from './dates'
import type { Kind, State } from './types'

const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export function toCsv(s: State) {
  const rows = itemsIn(s, '1900-01-01', TODAY).filter((t) => t.paid).sort((a, b) => a.date.localeCompare(b.date))
  return ['Date,Description,Type,Category,Account,Person,Amount,Trip']
    .concat(rows.map((t) => [t.date, t.note, t.type === 'income' ? 'Money in' : t.type === 'savings' ? 'Put aside' : 'Money out', catName(s, t.cat), accountName(s, t.account), t.person ?? '', t.type === 'income' ? t.amount : -t.amount, tripOf(s, t.trip)?.name ?? ''].map(cell).join(',')))
    .join('\n')
}

export function parseCsv(text: string) {
  const sep = !text.slice(0, 300).includes(',') && text.includes(';') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], c = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { c += '"'; i++ } else q = false } else c += ch }
    else if (ch === '"') q = true
    else if (ch === sep) { row.push(c); c = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(c); rows.push(row); row = []; c = '' }
    else c += ch
  }
  if (c || row.length) { row.push(c); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim()))
}

function normDate(s: string) {
  s = s.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000
    let d = +m[1], mo = +m[2]
    if (mo > 12) [d, mo] = [mo, d]
    return `${y}-${pad(mo)}-${pad(d)}`
  }
  return null
}
function num(s: string) {
  let t = String(s).replace(/[^\d.,-]/g, '')
  if (/,\d{1,2}$/.test(t) && !/\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.')
  return parseFloat(t.replace(/,/g, ''))
}

export interface ImportRow { line: number; date: string; type: Kind; catName: string; sub: string; amount: number; note: string; person: string; dup: boolean; trip: string }
export interface ImportPlan { rows: ImportRow[]; invalid: { line: number; reason: string }[]; newCats: string[]; dupCount: number; newTrips: string[] }

/**
 * Reads a bank CSV without changing anything. Rows are checked in batches (so a big file
 * doesn't freeze the page) and returned for preview. Nothing is saved until commitImport.
 */
export async function prepareImport(s: State, text: string, onProgress?: (done: number, total: number) => void): Promise<ImportPlan | string> {
  const rows = parseCsv(text)
  if (rows.length < 2) return 'No rows found. The first line should be headings such as Date, Description, Amount.'
  const h = rows[0].map((x) => x.trim().toLowerCase())
  const col = (...n: string[]) => h.findIndex((x) => n.some((k) => x.includes(k)))
  const ci = { date: col('date'), note: col('desc', 'note', 'memo', 'payee', 'name', 'details'), amt: col('amount', 'value', 'sum'), type: col('type'), cat: col('category'), sub: col('sub'), person: col('person', 'who'), trip: col('trip', 'holiday') }
  if (ci.sub === ci.cat) ci.sub = -1
  if (ci.date < 0 || ci.amt < 0) return 'The file needs at least a Date column and an Amount column.'
  // existing entries, for spotting rows that are already in Tally
  const seen = new Set(s.tx.map((t) => `${t.date}|${cents(t.amount)}`))
  const plan: ImportPlan = { rows: [], invalid: [], newCats: [], dupCount: 0, newTrips: [] }
  const knownTrips = new Set((s.trips ?? []).map((t) => t.name.toLowerCase()))
  const known = new Set(s.categories.map((c) => `${c.kind}|${c.name.toLowerCase()}`))
  const body = rows.slice(1)
  for (let i = 0; i < body.length; i++) {
    const r = body[i], line = i + 2
    const ds = normDate(r[ci.date] ?? '')
    const a = num(r[ci.amt] ?? '')
    if (!ds) { plan.invalid.push({ line, reason: `Date "${(r[ci.date] ?? '').slice(0, 20)}" not understood` }); continue }
    if (!isFinite(a) || !a) { plan.invalid.push({ line, reason: `Amount "${(r[ci.amt] ?? '').slice(0, 20)}" is not a number` }); continue }
    if (Math.abs(a) > 1e9) { plan.invalid.push({ line, reason: 'Amount is too large' }); continue }
    const tt = ci.type >= 0 ? String(r[ci.type]).toLowerCase() : ''
    const type: Kind = /in|income|credit/.test(tt) && !/out/.test(tt) ? 'income' : /aside|sav/.test(tt) ? 'savings' : tt ? 'expense' : a > 0 ? 'income' : 'expense'
    const amount = Math.abs(Math.round(a * 100) / 100)
    const catName = ci.cat >= 0 ? String(r[ci.cat]).trim() : ''
    if (catName && !known.has(`${type}|${catName.toLowerCase()}`)) { known.add(`${type}|${catName.toLowerCase()}`); plan.newCats.push(catName) }
    const tripName = ci.trip >= 0 && type !== 'savings' ? String(r[ci.trip] ?? '').trim().slice(0, 40) : ''
    if (tripName && !knownTrips.has(tripName.toLowerCase())) { knownTrips.add(tripName.toLowerCase()); plan.newTrips.push(tripName) }
    const key = `${ds}|${cents(amount)}`
    const dup = seen.has(key)
    if (dup) plan.dupCount++
    seen.add(key)
    plan.rows.push({ line, date: ds, type, catName, sub: ci.sub >= 0 ? String(r[ci.sub]).trim() : '', amount, note: ci.note >= 0 ? String(r[ci.note]).trim().slice(0, 120) : '', person: ci.person >= 0 ? String(r[ci.person]).trim() : '', dup, trip: tripName })
    if (i % 1000 === 999) { onProgress?.(i + 1, body.length); await new Promise((res) => setTimeout(res, 0)) }
  }
  onProgress?.(body.length, body.length)
  if (!plan.rows.length) return plan.invalid.length ? `None of the ${plan.invalid.length} rows could be read. ${plan.invalid[0].reason} (line ${plan.invalid[0].line}).` : 'No rows found.'
  return plan
}

/** Adds the previewed rows in one change (so one Undo removes them all). */
export function commitImport(d: State, plan: ImportPlan, skipDupes: boolean) {
  let n = 0
  const byName = new Map(d.categories.map((c) => [`${c.kind}|${c.name.toLowerCase()}`, c]))
  d.trips ??= []
  const trips = new Map(d.trips.map((t) => [t.name.toLowerCase(), t]))
  // a trip named in the file that Tally doesn't know yet is created, spanning the dates of its rows
  for (const r of plan.rows) {
    if (!r.trip || (skipDupes && r.dup)) continue
    let t = trips.get(r.trip.toLowerCase())
    if (!t) { t = { id: 't' + uid(), name: r.trip, icon: '✈️', start: r.date, end: r.date, budget: 0 }; d.trips.push(t); trips.set(r.trip.toLowerCase(), t) }
    else if (plan.newTrips.some((n) => n.toLowerCase() === r.trip.toLowerCase())) { if (r.date < t.start) t.start = r.date; if (r.date > t.end) t.end = r.date }
  }
  for (const r of plan.rows) {
    if (skipDupes && r.dup) continue
    let c = r.catName ? byName.get(`${r.type}|${r.catName.toLowerCase()}`) : undefined
    if (!c && r.catName) { c = { id: 'c' + uid(), name: r.catName, kind: r.type, group: r.type === 'savings' ? 'future' : 'extras', plan: 0, slot: null, icon: 'box' }; d.categories.push(c); byName.set(`${r.type}|${r.catName.toLowerCase()}`, c) }
    if (!c) c = d.categories.find((x) => x.kind === r.type && x.id === 'other') ?? d.categories.find((x) => x.kind === r.type)!
    d.tx.push({ id: uid(), date: r.date, type: r.type, cat: c.id, amount: r.amount, account: d.accounts[0].id, person: d.people.includes(r.person) ? r.person : d.people[0], note: r.note, ...(r.sub ? { sub: r.sub } : {}), ...(r.trip ? { trip: trips.get(r.trip.toLowerCase())!.id } : {}) })
    n++
  }
  return n
}

/** Checks a backup before it replaces anything. Returns what it contains, or why it can't be used. */
export function checkBackup(x: unknown): { ok: true; state: State; summary: string } | { ok: false; reason: string } {
  const d = x as State
  if (!d || typeof d !== 'object') return { ok: false, reason: "That doesn't look like a Tally backup." }
  if (d.v !== 2) return { ok: false, reason: 'This backup is from a different version of Tally.' }
  for (const k of ['tx', 'rules', 'categories', 'accounts', 'goals', 'debts', 'people'] as const)
    if (!Array.isArray(d[k])) return { ok: false, reason: `The backup is missing its ${k === 'tx' ? 'transactions' : k}.` }
  if (!d.settings || typeof d.settings.currency !== 'string') return { ok: false, reason: 'The backup is missing its settings.' }
  if (d.trips != null && (!Array.isArray(d.trips) || d.trips.some((t) => !t || typeof t.name !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.start) || !/^\d{4}-\d{2}-\d{2}$/.test(t.end))))
    return { ok: false, reason: 'The backup has a damaged trip (missing name or dates).' }
  if (!d.accounts.length || !d.categories.length) return { ok: false, reason: 'The backup has no accounts or categories.' }
  const bad = d.tx.findIndex((t) => !t || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !isFinite(+t.amount) || !['expense', 'income', 'savings'].includes(t.type))
  if (bad >= 0) return { ok: false, reason: `Entry ${bad + 1} in the backup is damaged (bad date, amount or type).` }
  const span = d.tx.length ? `${d.tx.reduce((m, t) => (t.date < m ? t.date : m), '9999')} to ${d.tx.reduce((m, t) => (t.date > m ? t.date : m), '0000')}` : 'no dates'
  return { ok: true, state: d, summary: `${d.tx.length.toLocaleString()} entries (${span}), ${d.rules.length} regular items, ${d.accounts.length} accounts, ${d.goals.length} goals, ${d.debts.length} debts${d.trips?.length ? `, ${d.trips.length} trip${d.trips.length === 1 ? '' : 's'}` : ''}.` }
}
