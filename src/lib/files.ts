import { accountName, balances, catName, itemsIn, perMonth, planFor, simulate, spendCats, sum, FREQ, tripOf, tripStats, yearStats } from './calc'
import { monthName, TODAY } from './dates'
import type { State } from './types'

type Downloads = { save: (r: { filename: string; data: Blob | string | ArrayBuffer }) => Promise<unknown> }
type ClaudeHost = { use: (n: string) => Promise<unknown> }

/**
 * Hands a file to the viewer. Inside the claude.ai viewer this goes through the
 * downloads capability (the viewer confirms); elsewhere it is a normal browser download.
 */
export async function saveFile(filename: string, data: Blob | string): Promise<'saved' | 'declined' | 'failed'> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (host?.use) {
    try {
      const d = (await host.use('downloads')) as Downloads | null
      if (d) { await d.save({ filename, data }); return 'saved' }
    } catch (e) {
      if ((e as { code?: string })?.code === 'declined') return 'declined'
    }
  }
  try {
    const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain' }) : data
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    return 'saved'
  } catch {
    return 'failed'
  }
}

/** A workbook that opens in Excel and Google Sheets: one sheet per part of SpendCop. */
export async function workbook(s: State, year: number) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const add = (name: string, rows: (string | number)[][], widths?: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  const y = yearStats(s, year)

  add('Summary', [
    [`SpendCop ${year}`], [],
    ['Month', 'Money in', 'Money out', 'Put aside', 'Left over', 'Plan'],
    ...y.months.map((k, i) => { const m = y.ms[i]; return [monthName(k), r2(m.income), r2(m.spent), r2(m.saved), r2(m.income - m.spent - m.saved), r2(sum(spendCats(s).map((c) => planFor(s, c, k))))] }),
    ['Total', r2(y.income), r2(y.spent), r2(y.saved), r2(y.income - y.spent - y.saved)],
  ], [16, 12, 12, 12, 12, 12])

  const cats = spendCats(s)
  add('Categories', [
    ['Category', 'Monthly plan', ...y.months.map((k) => monthName(k, false)), 'Year total'],
    ...cats.map((c) => [c.name, c.plan, ...y.ms.map((m) => r2(m.byCat[c.id] || 0)), r2(y.byCat[c.id] || 0)]),
  ], [20, 12, ...y.months.map(() => 9), 12])

  const items = itemsIn(s, `${year}-01-01`, `${year}-12-31`).filter((t) => t.paid).sort((a, b) => a.date.localeCompare(b.date))
  add('Transactions', [
    ['Date', 'Description', 'Type', 'Category', 'Sub-category', 'Account', 'Person', 'Amount', 'Trip'],
    ...items.map((t) => [t.date, t.note, t.type === 'income' ? 'Money in' : t.type === 'savings' ? 'Put aside' : 'Money out', catName(s, t.cat), t.sub ?? '', accountName(s, t.account), t.person ?? '', t.type === 'income' ? t.amount : -t.amount, tripOf(s, t.trip)?.name ?? '']),
  ], [11, 28, 11, 18, 16, 18, 10, 11, 18])

  if (s.trips?.length) add('Trips', [
    ['Trip', 'First day', 'Last day', 'Days', 'Budget', 'Spent', 'Money back', 'Left in budget', 'Entries'],
    ...[...s.trips].sort((a, b) => a.start.localeCompare(b.start)).map((t) => { const st = tripStats(s, t); return [t.name, t.start, t.end, st.days, t.budget || '', r2(st.spent), r2(st.back), t.budget ? r2(st.left) : '', st.count] }),
  ], [24, 11, 11, 6, 10, 10, 11, 13, 8])

  add('Regular items', [
    ['Name', 'Type', 'Category', 'How often', 'Amount', 'Per month', 'Starts', 'Ends'],
    ...s.rules.map((r) => [r.name, r.type, catName(s, r.cat), FREQ[r.freq].label, r.amount, r2(perMonth(r)), r.start, r.end ?? '']),
  ], [22, 10, 18, 16, 10, 10, 11, 11])

  const bal = balances(s)
  add('Accounts', [['Account', 'Type', 'Starting balance', `Balance on ${TODAY}`], ...s.accounts.map((a) => [a.name, a.type, a.start, r2(bal[a.id] || 0)])], [22, 12, 16, 18])
  add('Goals', [['Goal', 'Target', 'Saved', 'Left to save', 'Target date'], ...s.goals.map((g) => [g.name, g.target, g.saved, r2(Math.max(0, g.target - g.saved)), g.due])], [24, 10, 10, 12, 12])
  const sim = simulate(s.debts, s.settings.extra, s.settings.strategy)
  add('Debts', [['Debt', 'Still owed', 'Interest %', 'Minimum', 'Months to pay off', 'Interest you will pay'], ...s.debts.map((d) => [d.name, d.balance, d.rate, d.min, sim.payoff[d.id] ?? '', r2(sim.per[d.id]?.interest ?? 0)])], [20, 12, 10, 10, 16, 18])
  add('Net worth', [['What', 'Group', 'Own', 'Owe'], ...s.holdings.map((h) => [h.name, h.group, h.kind === 'own' ? h.value : '', h.kind === 'owe' ? h.value : '']), ...s.debts.map((d) => [d.name, 'Debt', '', d.balance])], [22, 14, 12, 12])

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
const r2 = (v: number) => Math.round(v * 100) / 100
