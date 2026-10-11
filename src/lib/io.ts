import { catName, accountName, itemsIn, uid } from './calc'
import { pad, TODAY } from './dates'
import type { State } from './types'

const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export function toCsv(s: State) {
  const rows = itemsIn(s, '1900-01-01', TODAY).filter((t) => t.paid).sort((a, b) => a.date.localeCompare(b.date))
  return ['Date,Description,Type,Category,Account,Person,Amount']
    .concat(rows.map((t) => [t.date, t.note, t.type === 'income' ? 'Money in' : t.type === 'savings' ? 'Put aside' : 'Money out', catName(s, t.cat), accountName(s, t.account), t.person ?? '', t.type === 'income' ? t.amount : -t.amount].map(cell).join(',')))
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

/** Adds rows from a bank export to the state. Returns how many were added, or an error message. */
export function importCsv(d: State, text: string): number | string {
  const rows = parseCsv(text)
  if (rows.length < 2) return 'No rows found. The first line should be headings such as Date, Description, Amount.'
  const h = rows[0].map((x) => x.trim().toLowerCase())
  const col = (...n: string[]) => h.findIndex((x) => n.some((k) => x.includes(k)))
  const ci = { date: col('date'), note: col('desc', 'note', 'memo', 'payee', 'name', 'details'), amt: col('amount', 'value', 'sum'), type: col('type'), cat: col('category'), person: col('person', 'who') }
  if (ci.date < 0 || ci.amt < 0) return 'The file needs at least a Date column and an Amount column.'
  let n = 0
  for (const r of rows.slice(1)) {
    const ds = normDate(r[ci.date] ?? '')
    const a = num(r[ci.amt] ?? '')
    if (!ds || !isFinite(a) || !a) continue
    const tt = ci.type >= 0 ? String(r[ci.type]).toLowerCase() : ''
    const type = /in|income|credit/.test(tt) && !/out/.test(tt) ? 'income' : /aside|sav/.test(tt) ? 'savings' : tt ? 'expense' : a > 0 ? 'income' : 'expense'
    const cn = ci.cat >= 0 ? String(r[ci.cat]).trim() : ''
    let c = d.categories.find((x) => x.kind === type && x.name.toLowerCase() === cn.toLowerCase())
    if (!c && cn) { c = { id: 'c' + uid(), name: cn, kind: type, group: type === 'savings' ? 'future' : 'extras', plan: 0, slot: null, icon: 'box' }; d.categories.push(c) }
    if (!c) c = d.categories.find((x) => x.kind === type && x.id === 'other') ?? d.categories.find((x) => x.kind === type)!
    const pn = ci.person >= 0 ? String(r[ci.person]).trim() : ''
    d.tx.push({ id: uid(), date: ds, type, cat: c.id, amount: Math.abs(Math.round(a * 100) / 100), account: d.accounts[0].id, person: d.people.includes(pn) ? pn : d.people[0], note: ci.note >= 0 ? String(r[ci.note]).trim() : '' })
    n++
  }
  return n || 'No rows could be read. Check that dates look like 2026-10-11 or 11/10/2026.'
}
