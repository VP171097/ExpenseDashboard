import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ChevronDown, Download, Plus, Search, SlidersHorizontal, Upload, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ItemRow } from '../components/bits'
import { Bar, Button, Card, CardHead, Empty } from '../components/ui'
import { catName, catOf, duplicateIds, itemsIn, monthItems, sum } from '../lib/calc'
import { friendlyDay, monthName, TODAY } from '../lib/dates'
import { money } from '../lib/money'
import { EMPTY_FILTER, useData, useUI, type Filter } from '../lib/store'
import type { Item } from '../lib/types'

export default function Activity() {
  const s = useData()
  const { month: k, filter: f, setFilter, open } = useUI()
  const [more, setMore] = useState(!!(f.sub || f.person || f.status || f.group || f.account || f.scope !== 'month' || f.sort !== 'newest'))
  const all = f.scope === 'year' ? itemsIn(s, `${k.slice(0, 4)}-01-01`, `${k.slice(0, 4)}-12-31`) : monthItems(s, k)
  const dups = duplicateIds(s)
  const cat = f.cat ? catOf(s, f.cat) : null

  const items = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    const list = all.filter((t) => {
      if (f.type === 'bills' && !t.virtual) return false
      if (f.type && f.type !== 'bills' && t.type !== f.type) return false
      if (f.cat && t.cat !== f.cat) return false
      if (f.sub && (t.sub ?? '') !== f.sub) return false
      if (f.person && t.person !== f.person) return false
      if (f.status && (f.status === 'paid') !== t.paid) return false
      if (f.account && t.account !== f.account && t.to !== f.account) return false
      if (f.group) { const g = t.type === 'savings' ? 'future' : catOf(s, t.cat)?.group; if (t.type === 'income' || g !== f.group) return false }
      if (q && !`${t.note} ${catName(s, t.cat)} ${t.sub ?? ''} ${t.amount} ${t.person ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
    const by: Record<Filter['sort'], (a: Item, b: Item) => number> = {
      newest: (a, b) => b.date.localeCompare(a.date) || Number(a.paid) - Number(b.paid) || b.amount - a.amount,
      oldest: (a, b) => a.date.localeCompare(b.date) || b.amount - a.amount,
      biggest: (a, b) => b.amount - a.amount, smallest: (a, b) => a.amount - b.amount,
    }
    return list.sort(by[f.sort])
  }, [all, f, s])

  const byDate = f.sort === 'newest' || f.sort === 'oldest'
  const later = byDate ? items.filter((t) => t.date > TODAY) : []
  const rest = byDate ? items.filter((t) => t.date <= TODAY) : items
  const [showLater, setShowLater] = useState(false)
  const groups = useMemo(() => {
    if (!byDate) return [{ date: '', items: rest }]
    const g: { date: string; items: Item[] }[] = []
    for (const t of rest) { const last = g[g.length - 1]; if (last && last.date === t.date) last.items.push(t); else g.push({ date: t.date, items: [t] }) }
    return g
  }, [rest, byDate])
  const [limit, setLimit] = useState(14)

  const paid = items.filter((t) => t.paid)
  const totals = { in: sum(paid.filter((t) => t.type === 'income').map((t) => t.amount)), out: sum(paid.filter((t) => t.type === 'expense').map((t) => t.amount)), aside: sum(paid.filter((t) => t.type === 'savings').map((t) => t.amount)) }
  const subTotals = cat ? Object.entries(items.filter((t) => t.paid).reduce((acc, t) => { const k2 = t.sub || 'No sub-category'; acc[k2] = (acc[k2] || 0) + t.amount; return acc }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]) : []
  const dupCount = items.filter((t) => dups.has(t.id)).length
  const set = (p: Partial<Filter>) => { setFilter(p); setLimit(14) }
  const sel = 'field !w-auto shrink-0 !rounded-full !py-1.5 text-[13.5px]'
  const active = JSON.stringify({ ...f, q: '' }) !== JSON.stringify({ ...EMPTY_FILTER, q: '' }) || f.q

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <Card className="col-span-12">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-[2_1_260px]">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field pl-11 text-[15px]" type="search" placeholder="Search, e.g. coffee or 25" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search activity" />
          </div>
          <Button size="sm" variant={more ? 'primary' : 'soft'} onClick={() => setMore((v) => !v)}><SlidersHorizontal size={15} />More filters</Button>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => open({ type: 'csv' })}><Upload size={15} />Import</Button>
            <Button size="sm" onClick={() => open({ type: 'backup' })}><Download size={15} />Export</Button>
          </div>
        </div>
        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {([['', 'Everything'], ['expense', 'Money out'], ['income', 'Money in'], ['savings', 'Put aside'], ['bills', 'Regular bills']] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => set({ type: v })} aria-pressed={f.type === v}
              className={`relative shrink-0 rounded-full border px-4 py-1.5 text-[13.5px] font-semibold transition-colors ${f.type === v ? 'border-transparent text-accent-ink' : 'border-line2 text-ink2 hover:text-ink'}`}>
              {f.type === v && <motion.span layoutId="act-filter" className="absolute inset-0 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <span className="relative">{l}</span>
            </button>
          ))}
          <select className={sel} value={f.cat} onChange={(e) => set({ cat: e.target.value, sub: '' })} aria-label="Category">
            <option value="">All categories</option>{s.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {cat?.subs?.length ? <select className={sel} value={f.sub} onChange={(e) => set({ sub: e.target.value })} aria-label="Sub-category"><option value="">All of {cat.name}</option>{cat.subs.map((x) => <option key={x}>{x}</option>)}</select> : null}
        </div>
        <AnimatePresence initial={false}>
          {more && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap gap-2 pt-2">
                <select className={sel} value={f.scope} onChange={(e) => set({ scope: e.target.value as Filter['scope'] })} aria-label="Period"><option value="month">{monthName(k)}</option><option value="year">All of {k.slice(0, 4)}</option></select>
                <select className={sel} value={f.status} onChange={(e) => set({ status: e.target.value as Filter['status'] })} aria-label="Status"><option value="">Paid and upcoming</option><option value="paid">Paid only</option><option value="upcoming">Not paid yet</option></select>
                <select className={sel} value={f.group} onChange={(e) => set({ group: e.target.value as Filter['group'] })} aria-label="Essentials, extras or future"><option value="">Essentials, extras & future</option><option value="essentials">Essentials (needs)</option><option value="extras">Extras (wants)</option><option value="future">Future you (savings)</option></select>
                {s.people.length > 1 && <select className={sel} value={f.person} onChange={(e) => set({ person: e.target.value })} aria-label="Person"><option value="">Everyone</option>{s.people.map((p) => <option key={p}>{p}</option>)}</select>}
                <select className={sel} value={f.account} onChange={(e) => set({ account: e.target.value })} aria-label="Account"><option value="">All accounts</option>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                <select className={sel} value={f.sort} onChange={(e) => set({ sort: e.target.value as Filter['sort'] })} aria-label="Sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="biggest">Biggest first</option><option value="smallest">Smallest first</option></select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[14px] text-ink2">
          <span><b className="text-ink">{items.length}</b> items</span>
          <span>In <b className="tnum text-good">{money(totals.in)}</b></span>
          <span>Out <b className="tnum text-ink">{money(totals.out)}</b></span>
          <span>Put aside <b className="tnum text-accent">{money(totals.aside)}</b></span>
          {active && <Button size="sm" variant="ghost" onClick={() => set({ ...EMPTY_FILTER })}><X size={14} />Clear filters</Button>}
        </div>
        {dupCount > 0 && <p className="mt-3 flex items-center gap-2 rounded-2xl bg-warn-soft px-3.5 py-2.5 text-[14px] text-ink"><AlertTriangle size={16} className="shrink-0 text-warn" />{dupCount} entries look like they may have been added twice (same amount and category, a day apart). They're marked below. Tap one to check.</p>}
      </Card>

      {cat && subTotals.length > 0 && (
        <Card i={1} className="col-span-12">
          <CardHead title={`${cat.name}: by sub-category`} sub={f.scope === 'year' ? `All of ${k.slice(0, 4)}` : monthName(k)} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subTotals.map(([n, v]) => (
              <button key={n} type="button" onClick={() => set({ sub: n === 'No sub-category' ? '' : n })} className="rounded-2xl border border-line p-3 text-left hover:border-accent">
                <div className="mb-1.5 flex justify-between"><b>{n}</b><b className="tnum">{money(v)}</b></div>
                <Bar value={v / subTotals[0][1]} height={7} color="var(--s1)" label={n} />
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="col-span-12 card p-3 sm:p-5">
        {later.length > 0 && (
          <section className="mb-3 rounded-2xl border border-line bg-surface2 p-2">
            <button type="button" onClick={() => setShowLater((v) => !v)} aria-expanded={showLater} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left">
              <span className="font-bold">Coming up later <span className="font-normal text-muted">({later.length})</span></span>
              <span className="flex items-center gap-2 text-[13px] text-ink2">{money(sum(later.filter((t) => t.type !== 'income').map((t) => t.amount)))} going out<motion.span animate={{ rotate: showLater ? 180 : 0 }}><ChevronDown size={16} /></motion.span></span>
            </button>
            <AnimatePresence initial={false}>
              {showLater && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">{[...later].reverse().map((t) => <ItemRow key={t.id} item={t} showDate />)}</motion.div>}
            </AnimatePresence>
          </section>
        )}
        {rest.length === 0 && later.length === 0 ? (
          <Empty icon={<Search />} title="Nothing found" text={all.length ? 'Try a different search or clear the filters.' : `Nothing recorded for ${monthName(k)} yet.`}
            action={<Button variant="primary" onClick={() => open({ type: 'quick' })}><Plus size={16} />Add something</Button>} />
        ) : (
          <>
            {(byDate ? groups.slice(0, limit) : groups).map((g) => {
              const out = sum(g.items.filter((t) => t.paid && t.type === 'expense').map((t) => t.amount))
              return (
                <section key={g.date || 'all'} className="mb-3 last:mb-0">
                  {g.date && <header className="sticky top-0 z-10 flex items-center justify-between bg-surface px-2 pb-1 pt-2"><h3 className="text-[15px] font-bold">{friendlyDay(g.date)}</h3>{out > 0 && <span className="tnum text-[13px] text-muted">Spent {money(out)}</span>}</header>}
                  <AnimatePresence initial={false}>{(byDate ? g.items : g.items.slice(0, limit * 6)).map((t) => <ItemRow key={t.id} item={t} showDate={!byDate} dup={dups.has(t.id)} />)}</AnimatePresence>
                </section>
              )
            })}
            {(byDate ? groups.length > limit : rest.length > limit * 6) && <div className="mt-3 text-center"><Button onClick={() => setLimit((l) => l + 14)}>Show more</Button></div>}
          </>
        )}
      </div>
    </div>
  )
}
