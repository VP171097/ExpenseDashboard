import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ItemRow } from '../components/bits'
import { Button, Card, CardHead, Empty, Explain, Num } from '../components/ui'
import { accountFlows, balances, catColor, catOf, monthItems, monthStats, sum } from '../lib/calc'
import { addDays, addMonths, daysIn, fmtDate, friendlyDay, iso, monthEnd, monthName, pad, parse, TODAY } from '../lib/dates'
import { money, money0 } from '../lib/money'
import { update, useData, useUI } from '../lib/store'
import type { Item } from '../lib/types'

type Show = { spend: boolean; bills: boolean; income: boolean }

export default function Calendar() {
  const s = useData()
  const { month: k, open } = useUI()
  const m = monthStats(s, k)
  const all = monthItems(s, k)
  const dim = daysIn(k)
  const ws = s.settings.weekStart
  const first = parse(k + '-01')
  const offset = (first.getDay() - ws + 7) % 7
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
  const [show, setShow] = useState<Show>({ spend: true, bills: true, income: true })
  const [sel, setSel] = useState<string | null>(null)
  const max = Math.max(1, ...m.byDay)
  const names = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + ((i + ws) % 7)).toLocaleDateString(undefined, { weekday: 'short' }))
  const spendable = s.accounts.filter((a) => a.type === 'everyday' || a.type === 'cash').map((a) => a.id)
  const balOn = (d: string) => sum(spendable.map((id) => balances(s, d)[id] || 0))
  const startBal = balOn(iso(addDays(first, -1)))
  const endDay = monthEnd(k) < TODAY ? monthEnd(k) : TODAY
  const endBal = k > TODAY.slice(0, 7) ? startBal : balOn(endDay)
  const flows = spendable.reduce((acc, id) => { const f = accountFlows(s, id, k + '-01', endDay); return { in: acc.in + f.received, out: acc.out + f.withdrawn } }, { in: 0, out: 0 })
  const dayItems = (ds: string) => all.filter((t) => t.date === ds)
  let running = 0

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <Card className="col-span-12 xl:col-span-9">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show on calendar">
            {([['spend', 'Spending', 'var(--s2)'], ['bills', 'Bills', 'var(--s4)'], ['income', 'Money in', 'var(--s1)']] as const).map(([key, l, c]) => (
              <button key={key} type="button" aria-pressed={show[key]} onClick={() => setShow((x) => ({ ...x, [key]: !x[key] }))}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors ${show[key] ? 'border-transparent bg-surface2 text-ink' : 'border-dashed border-line2 text-muted line-through'}`}>
                <i className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-[13.5px] font-semibold text-ink2">Week starts on
            <select className="field !w-auto !py-1.5" value={ws} onChange={(e) => update((d) => { d.settings.weekStart = +e.target.value })}>
              {[1, 0, 6].map((v) => <option key={v} value={v}>{new Date(2024, 0, 7 + v).toLocaleDateString(undefined, { weekday: 'long' })}</option>)}
            </select>
          </label>
        </div>
        <div className="-mx-2 overflow-x-auto px-2 pb-1">
          <div className="grid min-w-[720px] grid-cols-[repeat(7,minmax(0,1fr))_96px] gap-1.5">
            {names.map((n) => <div key={n} className="label pb-1 text-center">{n}</div>)}
            <div className="label pb-1 text-center">Week</div>
            {weeks.map((wk, wi) => {
              const days = wk.filter(Boolean) as number[]
              const wSpent = sum(days.map((d) => m.byDay[d]))
              running += wSpent
              const wBills = sum(days.map((d) => sum(dayItems(`${k}-${pad(d)}`).filter((t) => t.virtual && t.type !== 'income').map((t) => t.amount))))
              return [
                ...wk.map((d, i) => {
                  if (!d) return <div key={`${wi}-${i}`} className="min-h-[104px] rounded-2xl border border-dashed border-line opacity-40" />
                  const ds = `${k}-${pad(d)}`, items = dayItems(ds), sp = m.byDay[d]
                  const bills = items.filter((t) => t.virtual && t.type !== 'income'), ins = items.filter((t) => t.type === 'income')
                  const cats = [...new Set(items.filter((t) => t.type === 'expense' && !t.virtual).map((t) => t.cat))].slice(0, 5)
                  const nospend = ds <= TODAY && !m.extrasDay[d]
                  return (
                    <motion.button key={ds} type="button" onClick={() => setSel(sel === ds ? null : ds)} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (wi * 7 + i) * 0.006 }}
                      aria-pressed={sel === ds} aria-label={`${friendlyDay(ds)}: spent ${money(sp)}`}
                      className={`relative flex min-h-[104px] flex-col gap-1 rounded-2xl border p-2 text-left ${sel === ds ? 'border-accent ring-2 ring-accent' : 'border-line'}`}
                      style={{ background: show.spend && sp ? `color-mix(in srgb, var(--s2) ${Math.round(6 + (sp / max) * 30)}%, var(--surface))` : 'var(--surface)' }}>
                      <span className="flex items-center justify-between">
                        <span className={`grid h-6 w-6 place-items-center rounded-lg text-[12.5px] font-bold ${ds === TODAY ? 'bg-accent text-accent-ink' : ''}`}>{d}</span>
                        {nospend && <span className="h-2 w-2 rounded-full bg-good" title="No extras this day" />}
                      </span>
                      {show.bills && bills.slice(0, 2).map((b) => <span key={b.id} className={`truncate rounded-md border px-1 text-[10.5px] ${b.paid ? 'border-line bg-surface2 text-ink2' : 'border-dashed border-s4 text-ink'}`}>{b.paid ? '✓ ' : ''}{b.note}</span>)}
                      {show.bills && bills.length > 2 && <span className="text-[10.5px] text-muted">+{bills.length - 2} more</span>}
                      {show.income && ins.length > 0 && <span className="truncate text-[11px] font-semibold text-good">+{money0(sum(ins.map((t) => t.amount)))}</span>}
                      <span className="mt-auto flex items-end justify-between gap-1">
                        {show.spend && sp > 0 && <span className="tnum text-[12.5px] font-bold">{money0(sp)}</span>}
                        <span className="flex gap-0.5">{show.spend && cats.map((c) => <i key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: catColor(catOf(s, c)) }} />)}</span>
                      </span>
                    </motion.button>
                  )
                }),
                <div key={`w${wi}`} className="flex min-h-[104px] flex-col justify-center gap-0.5 rounded-2xl bg-surface2 p-2 text-[11.5px] text-muted">
                  <span>Spent</span><b className="tnum text-[14px] text-ink">{money0(wSpent)}</b>
                  {wBills > 0 && <span>Bills {money0(wBills)}</span>}
                  <span>So far {money0(running)}</span>
                </div>,
              ]
            })}
          </div>
        </div>
        <p className="mt-3 text-[13px] text-ink2">Shading shows how much was spent. Dashed bills are not ticked off yet. A green dot means nothing was spent on extras.</p>
      </Card>

      <div className="col-span-12 grid content-start gap-4 md:grid-cols-2 xl:col-span-3 xl:grid-cols-1">
        <Card i={1}>
          <CardHead title="Month snapshot" help="Your everyday bank account and cash: what was there at the start of the month and what is there now." />
          <div className="grid grid-cols-2 gap-3">
            <div><p className="label">Started with</p><p className="font-display text-[22px] font-bold"><Num value={startBal} /></p></div>
            <div><p className="label">{endDay === TODAY ? 'Now' : 'Ended with'}</p><p className={`font-display text-[22px] font-bold ${endBal < 0 ? 'text-bad' : ''}`}><Num value={endBal} /></p></div>
            <div><p className="label">In</p><p className="tnum font-bold text-good">+{money0(flows.in)}</p></div>
            <div><p className="label">Out</p><p className="tnum font-bold">−{money0(flows.out)}</p></div>
          </div>
        </Card>
        <Card i={2}>
          {sel ? (
            <>
              <CardHead title={friendlyDay(sel)} sub={`Balance at the end of the day: ${money0(balOn(sel))}`} right={<Button size="sm" variant="primary" onClick={() => open({ type: 'quick', date: sel })}><Plus size={15} />Add</Button>} />
              <div className="-mx-2">{dayItems(sel).length ? dayItems(sel).map((t: Item) => <ItemRow key={t.id} item={t} />) : <Empty title="A quiet day" text="Nothing recorded on this day." />}</div>
            </>
          ) : (
            <>
              <CardHead title="Bills this month" sub="Tap a day to see everything on it" />
              <div className="flex flex-col gap-1.5 text-[13.5px]">
                {all.filter((t) => t.virtual && t.type !== 'income').sort((a, b) => a.date.localeCompare(b.date)).map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-muted">{fmtDate(t.date)}</span>
                    <span className={`flex-1 truncate ${t.paid ? 'text-muted line-through' : 'font-semibold'}`}>{t.note}</span>
                    <span className="tnum">{money(t.amount)}</span>
                  </div>
                ))}
                {!all.some((t) => t.virtual) && <p className="text-ink2">No regular bills this month.</p>}
              </div>
              <p className="mt-3 flex items-center gap-1 text-[12.5px] text-muted">Previous month: {monthName(addMonths(k, -1))}<Explain text="Use the arrows at the top of the page to move between months." /></p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
