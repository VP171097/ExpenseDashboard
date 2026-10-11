import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChevronDown, Download, List, Plus, Search, Upload, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ItemRow } from '../components/bits'
import { Button, Card, CardHead, Empty, Explain, Segmented } from '../components/ui'
import { catName, catOf, monthItems, monthStats, sum } from '../lib/calc'
import { daysIn, friendlyDay, monthName, pad, TODAY } from '../lib/dates'
import { money, money0 } from '../lib/money'
import { useData, useUI } from '../lib/store'
import type { Item } from '../lib/types'

export default function Activity() {
  const s = useData()
  const { month: k, filter, setFilter, open } = useUI()
  const [mode, setMode] = useState<'list' | 'calendar'>('list')
  const all = monthItems(s, k)

  const items = useMemo(() => {
    const q = filter.q.trim().toLowerCase()
    return all
      .filter((t) => {
        if (filter.type === 'bills' && !t.virtual) return false
        if (filter.type && filter.type !== 'bills' && t.type !== filter.type) return false
        if (filter.cat && t.cat !== filter.cat) return false
        if (q && !`${t.note} ${catName(s, t.cat)} ${t.amount} ${t.person ?? ''}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date) || Number(a.paid) - Number(b.paid) || b.amount - a.amount)
  }, [all, filter, s])

  const later = items.filter((t) => t.date > TODAY).reverse()
  const [showLater, setShowLater] = useState(false)
  const groups = useMemo(() => {
    const g: { date: string; items: Item[] }[] = []
    for (const t of items.filter((x) => x.date <= TODAY)) {
      const last = g[g.length - 1]
      if (last && last.date === t.date) last.items.push(t)
      else g.push({ date: t.date, items: [t] })
    }
    return g
  }, [items])
  const [limit, setLimit] = useState(14)

  const paid = items.filter((t) => t.paid)
  const totals = { in: sum(paid.filter((t) => t.type === 'income').map((t) => t.amount)), out: sum(paid.filter((t) => t.type === 'expense').map((t) => t.amount)), aside: sum(paid.filter((t) => t.type === 'savings').map((t) => t.amount)) }
  const activeCat = filter.cat ? catOf(s, filter.cat) : null

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <Card className="col-span-12">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-[2_1_260px]">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field pl-11 text-[15px]" type="search" placeholder="Search, e.g. coffee or 25" value={filter.q} onChange={(e) => { setFilter({ q: e.target.value }); setLimit(14) }} aria-label="Search activity" />
          </div>
          <Segmented label="Show" value={mode} onChange={setMode} options={[['list', <><List size={15} />List</>], ['calendar', <><CalendarDays size={15} />Calendar</>]]} />
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => open({ type: 'csv' })}><Upload size={15} />Import</Button>
            <Button size="sm" onClick={() => open({ type: 'backup' })}><Download size={15} />Export</Button>
          </div>
        </div>
        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {([['', 'Everything'], ['expense', 'Money out'], ['income', 'Money in'], ['savings', 'Put aside'], ['bills', 'Regular bills']] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setFilter({ type: v })} aria-pressed={filter.type === v}
              className={`relative shrink-0 rounded-full border px-4 py-1.5 text-[13.5px] font-semibold transition-colors ${filter.type === v ? 'border-transparent text-accent-ink' : 'border-line2 text-ink2 hover:text-ink'}`}>
              {filter.type === v && <motion.span layoutId="act-filter" className="absolute inset-0 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <span className="relative">{l}</span>
            </button>
          ))}
          <select className="field !w-auto shrink-0 !rounded-full !py-1.5 text-[13.5px]" value={filter.cat} onChange={(e) => setFilter({ cat: e.target.value })} aria-label="Category">
            <option value="">All categories</option>
            {s.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {(filter.cat || filter.q || filter.type) && <Button size="sm" variant="ghost" onClick={() => setFilter({ q: '', cat: '', type: '' })}><X size={14} />Clear</Button>}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-ink2">
          <span><b className="text-ink">{items.length}</b> items{activeCat ? ` in ${activeCat.name}` : ''}</span>
          <span>In <b className="tnum text-good">{money(totals.in)}</b></span>
          <span>Out <b className="tnum text-ink">{money(totals.out)}</b></span>
          <span>Put aside <b className="tnum text-accent">{money(totals.aside)}</b></span>
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {mode === 'list' ? (
          <motion.div key="list" className="col-span-12" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="card p-3 sm:p-5">
              {later.length > 0 && (
                <section className="mb-3 rounded-2xl border border-line bg-surface2 p-2">
                  <button type="button" onClick={() => setShowLater((v) => !v)} aria-expanded={showLater} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left">
                    <span className="font-bold">Coming up later this month <span className="font-normal text-muted">({later.length})</span></span>
                    <span className="flex items-center gap-2 text-[13px] text-ink2">{money(sum(later.filter((t) => t.type !== 'income').map((t) => t.amount)))} going out<motion.span animate={{ rotate: showLater ? 180 : 0 }}><ChevronDown size={16} /></motion.span></span>
                  </button>
                  <AnimatePresence initial={false}>
                    {showLater && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">{later.map((t) => <ItemRow key={t.id} item={t} showDate />)}</motion.div>}
                  </AnimatePresence>
                </section>
              )}
              {groups.length === 0 && later.length === 0 ? (
                <Empty icon={<Search />} title="Nothing found" text={all.length ? 'Try a different search or clear the filters.' : `Nothing recorded for ${monthName(k)} yet.`}
                  action={<Button variant="primary" onClick={() => open({ type: 'quick' })}><Plus size={16} />Add something</Button>} />
              ) : (
                <>
                  {groups.slice(0, limit).map((g) => {
                    const out = sum(g.items.filter((t) => t.paid && t.type === 'expense').map((t) => t.amount))
                    return (
                      <section key={g.date} className="mb-3 last:mb-0">
                        <header className="sticky top-0 z-10 flex items-center justify-between bg-surface px-2 pb-1 pt-2">
                          <h3 className="text-[15px] font-bold">{friendlyDay(g.date)}</h3>
                          {out > 0 && <span className="tnum text-[13px] text-muted">Spent {money(out)}</span>}
                        </header>
                        <AnimatePresence initial={false}>{g.items.map((t) => <ItemRow key={t.id} item={t} />)}</AnimatePresence>
                      </section>
                    )
                  })}
                  {groups.length > limit && <div className="mt-3 text-center"><Button onClick={() => setLimit((l) => l + 14)}>Show more days</Button></div>}
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="cal" className="col-span-12" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <MonthCalendar />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MonthCalendar() {
  const s = useData()
  const { month: k, open } = useUI()
  const m = monthStats(s, k)
  const all = monthItems(s, k)
  const dim = daysIn(k)
  const ws = s.settings.weekStart
  const first = new Date(+k.slice(0, 4), +k.slice(5) - 1, 1)
  const offset = (first.getDay() - ws + 7) % 7
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const max = Math.max(1, ...m.byDay)
  const [sel, setSel] = useState<string | null>(null)
  const names = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + ((i + ws) % 7)).toLocaleDateString(undefined, { weekday: 'short' }))
  const selItems = sel ? all.filter((t) => t.date === sel) : []
  const noSpend = (d: number) => `${k}-${pad(d)}` <= TODAY && !m.extrasDay[d]

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <Card className="col-span-12 lg:col-span-8">
        <CardHead title={monthName(k)} sub="Darker days mean more spending. A green dot means nothing spent on extras that day."
          help="Extras are things like eating out, shopping and fun. Days without them are good for your budget." />
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {names.map((n) => <div key={n} className="label pb-1 text-center">{n}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const ds = `${k}-${pad(d)}`, sp = m.byDay[d], bills = all.filter((t) => t.date === ds && t.virtual)
            const r = sp / max
            return (
              <motion.button key={i} type="button" onClick={() => setSel(sel === ds ? null : ds)} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.008 }}
                aria-label={`${friendlyDay(ds)}, spent ${money(sp)}`} aria-pressed={sel === ds}
                className={`relative flex aspect-square flex-col items-start rounded-xl border p-1.5 text-left sm:aspect-auto sm:min-h-[84px] sm:rounded-2xl sm:p-2 ${sel === ds ? 'border-accent ring-2 ring-accent' : 'border-line'}`}
                style={{ background: sp ? `color-mix(in srgb, var(--s1) ${Math.round(8 + r * 50)}%, var(--surface))` : 'var(--surface)' }}>
                <span className={`grid h-6 w-6 place-items-center rounded-lg text-[12.5px] font-bold ${ds === TODAY ? 'bg-accent text-accent-ink' : ''}`}>{d}</span>
                {noSpend(d) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-good" title="No extras" />}
                <span className="mt-auto hidden w-full flex-col gap-0.5 sm:flex">
                  {bills.slice(0, 1).map((b) => <span key={b.id} className={`truncate rounded-md border px-1 text-[10.5px] ${b.paid ? 'border-line bg-surface2' : 'border-dashed border-line2'} ${b.type === 'income' ? 'text-good' : 'text-ink2'}`}>{b.note}</span>)}
                  {sp > 0 && <span className="tnum text-[12px] font-bold">{money0(sp)}</span>}
                </span>
              </motion.button>
            )
          })}
        </div>
      </Card>
      <Card className="col-span-12 lg:col-span-4">
        {sel ? (
          <>
            <CardHead title={friendlyDay(sel)} sub={`${selItems.length} item${selItems.length === 1 ? '' : 's'}`} right={<Button size="sm" variant="primary" onClick={() => open({ type: 'quick', date: sel })}><Plus size={15} />Add</Button>} />
            <div className="-mx-2">{selItems.length ? selItems.map((t) => <ItemRow key={t.id} item={t} />) : <Empty title="A quiet day" text="Nothing recorded on this day." />}</div>
          </>
        ) : (
          <>
            <CardHead title="Pick a day" sub="Tap any day to see what happened" />
            <div className="flex flex-col gap-3 text-[14px] text-ink2">
              <div className="flex items-center gap-2"><span className="inline-flex gap-1">{[8, 24, 40, 58].map((p) => <i key={p} className="h-4 w-5 rounded" style={{ background: `color-mix(in srgb, var(--s1) ${p}%, var(--surface))` }} />)}</span> Less to more spending</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-good" /> No spending on extras <Explain text="A no-spend day is a day with no eating out, shopping or other extras. A few of these each week adds up quickly." /></div>
              <div className="rounded-2xl bg-surface2 p-4">
                <p className="label">Most expensive day</p>
                {(() => { const d = m.byDay.indexOf(Math.max(...m.byDay)); return d > 0 && m.byDay[d] > 0 ? <p className="mt-1"><b className="text-ink">{friendlyDay(`${k}-${pad(d)}`)}</b>: {money(m.byDay[d])}</p> : <p className="mt-1">No spending yet</p> })()}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
