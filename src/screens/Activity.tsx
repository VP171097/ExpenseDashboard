import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Download, Plus, Search, SlidersHorizontal, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ItemRow } from '../components/bits'
import { Pager, usePaged } from '../components/Pager'
import { Bar, Button, Card, CardHead, Empty } from '../components/ui'
import { catOf, cents, duplicateIds, earliestMonth, itemsIn, searchText, tripOf } from '../lib/calc'
import { friendlyDay, monthEnd, monthName, THIS_MONTH, TODAY } from '../lib/dates'
import { money } from '../lib/money'
import { EMPTY_FILTER, useData, useUI, type Filter } from '../lib/store'
import type { Item, State } from '../lib/types'

/** Which dates the current filter covers. */
function range(s: State, f: Filter, k: string): [string, string, string] {
  if (f.scope === 'year') return [`${k.slice(0, 4)}-01-01`, `${k.slice(0, 4)}-12-31`, `all of ${k.slice(0, 4)}`]
  if (f.scope === 'all') return [`${earliestMonth(s)}-01`, monthEnd(k > THIS_MONTH ? k : THIS_MONTH), 'all time']
  if (f.scope === 'range' && f.from && f.to) return f.from <= f.to ? [f.from, f.to, 'your dates'] : [f.to, f.from, 'your dates']
  return [k + '-01', monthEnd(k), monthName(k)]
}

const SORTS: Record<Filter['sort'], (a: Item, b: Item) => number> = {
  newest: (a, b) => b.date.localeCompare(a.date) || Number(a.paid) - Number(b.paid) || b.amount - a.amount,
  oldest: (a, b) => a.date.localeCompare(b.date) || b.amount - a.amount,
  biggest: (a, b) => b.amount - a.amount || b.date.localeCompare(a.date),
  smallest: (a, b) => a.amount - b.amount || b.date.localeCompare(a.date),
}

export default function Activity() {
  const s = useData()
  const { month: k, filter: f, setFilter, open } = useUI()
  const [more, setMore] = useState(!!(f.trip || f.sub || f.person || f.status || f.group || f.account || f.scope !== 'month' || f.sort !== 'newest'))
  // search box updates instantly; the list follows a moment later so typing never stutters
  const [q, setQ] = useState(f.q)
  useEffect(() => { const t = setTimeout(() => { if (q !== f.q) setFilter({ q }) }, 120); return () => clearTimeout(t) }, [q, f.q, setFilter])
  useEffect(() => { setQ(f.q) }, [f.q])

  const [from, to, label] = range(s, f, k)
  const dups = duplicateIds(s)
  const cat = f.cat ? catOf(s, f.cat) : null

  // 1. dataset and dates  2. search  3. filters  4. sort
  const items = useMemo(() => {
    const needle = f.q.trim().toLowerCase()
    // trips whose name matches the search, so "lisbon" finds every Lisbon trip entry
    const tripHit = new Set(needle ? (s.trips ?? []).filter((x) => x.name.toLowerCase().includes(needle)).map((x) => x.id) : [])
    const list = itemsIn(s, from, to).filter((t) => {
      if (needle && !searchText(s, t).includes(needle) && !(t.trip && tripHit.has(t.trip))) return false
      if (f.trip && (f.trip === 'any' ? !t.trip : f.trip === 'none' ? !!t.trip : t.trip !== f.trip)) return false
      if (f.type === 'bills' && !t.virtual) return false
      if (f.type && f.type !== 'bills' && t.type !== f.type) return false
      if (f.cat && t.cat !== f.cat) return false
      if (f.sub && (t.sub ?? '') !== f.sub) return false
      if (f.person && t.person !== f.person) return false
      if (f.status && (f.status === 'paid') !== t.paid) return false
      if (f.account && t.account !== f.account && t.to !== f.account) return false
      if (f.group) { const g = t.type === 'savings' ? 'future' : catOf(s, t.cat)?.group; if (t.type === 'income' || g !== f.group) return false }
      return true
    })
    return list.sort(SORTS[f.sort])
  }, [s, from, to, f])

  // 5. totals and breakdowns over every match, not just this page
  const totals = useMemo(() => {
    const c = { in: 0, out: 0, aside: 0, upcoming: 0 }, subs: Record<string, number> = {}
    for (const t of items) {
      const a = cents(t.amount)
      if (!t.paid) { if (t.type !== 'income') c.upcoming += a; continue }
      if (t.type === 'income') c.in += a; else if (t.type === 'savings') c.aside += a; else c.out += a
      if (cat) subs[t.sub || 'No sub-category'] = (subs[t.sub || 'No sub-category'] || 0) + a
    }
    return { in: c.in / 100, out: c.out / 100, aside: c.aside / 100, upcoming: c.upcoming / 100, subs: Object.entries(subs).map(([n, v]) => [n, v / 100] as [string, number]).sort((a, b) => b[1] - a[1]), dup: items.filter((t) => dups.has(t.id)).length }
  }, [items, cat, dups])

  // 6. paginate the final list; any change to the result set goes back to page 1
  const resetKey = JSON.stringify([from, to, f])
  const pg = usePaged(items, resetKey, 25)
  const groups = useMemo(() => {
    const byDate = f.sort === 'newest' || f.sort === 'oldest'
    if (!byDate) return [{ date: '', items: pg.rows }]
    const g: { date: string; items: Item[] }[] = []
    for (const t of pg.rows) { const last = g[g.length - 1]; if (last && last.date === t.date) last.items.push(t); else g.push({ date: t.date, items: [t] }) }
    return g
  }, [pg.rows, f.sort])

  const set = (p: Partial<Filter>) => setFilter(p)
  const sel = 'field !w-auto shrink-0 !rounded-full !py-1.5 text-[13.5px]'
  const active = JSON.stringify({ ...f, q: '' }) !== JSON.stringify({ ...EMPTY_FILTER, q: '' }) || f.q
  const nf = new Intl.NumberFormat()

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <Card className="col-span-12">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-[2_1_260px]">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field pl-11 text-[15px]" type="search" placeholder="Search description, category, trip, amount or person" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search activity" />
          </div>
          <select className={sel} value={f.scope} onChange={(e) => set({ scope: e.target.value as Filter['scope'] })} aria-label="Dates">
            <option value="month">{monthName(k)}</option><option value="year">All of {k.slice(0, 4)}</option><option value="all">All time</option><option value="range">Choose dates…</option>
          </select>
          <Button size="sm" variant={more ? 'primary' : 'soft'} onClick={() => setMore((v) => !v)}><SlidersHorizontal size={15} />More filters</Button>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => open({ type: 'csv' })}><Upload size={15} />Import</Button>
            <Button size="sm" onClick={() => open({ type: 'backup' })}><Download size={15} />Export</Button>
          </div>
        </div>
        {f.scope === 'range' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink2">
            From <input type="date" className="field !w-auto !py-1.5" value={f.from} max={f.to || undefined} onChange={(e) => set({ from: e.target.value })} aria-label="From date" />
            to <input type="date" className="field !w-auto !py-1.5" value={f.to} min={f.from || undefined} onChange={(e) => set({ to: e.target.value })} aria-label="To date" />
            {!(f.from && f.to) && <span className="font-normal text-muted">Pick both dates. Showing {monthName(k)} until then.</span>}
          </div>
        )}
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
          {(s.trips ?? []).length > 0 && <select className={sel} value={f.trip} onChange={(e) => set({ trip: e.target.value })} aria-label="Trip">
            <option value="">Trips and everyday</option><option value="any">Any trip</option><option value="none">Not on a trip</option>
            {[...s.trips].sort((a, b) => b.start.localeCompare(a.start)).map((x) => <option key={x.id} value={x.id}>{x.icon} {x.name}</option>)}
          </select>}
          {cat?.subs?.length ? <select className={sel} value={f.sub} onChange={(e) => set({ sub: e.target.value })} aria-label="Sub-category"><option value="">All of {cat.name}</option>{cat.subs.map((x) => <option key={x}>{x}</option>)}</select> : null}
        </div>
        <AnimatePresence initial={false}>
          {more && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap gap-2 pt-2">
                <select className={sel} value={f.status} onChange={(e) => set({ status: e.target.value as Filter['status'] })} aria-label="Status"><option value="">Paid and upcoming</option><option value="paid">Paid only</option><option value="upcoming">Not paid yet</option></select>
                <select className={sel} value={f.group} onChange={(e) => set({ group: e.target.value as Filter['group'] })} aria-label="Essentials, extras or future"><option value="">Essentials, extras & future</option><option value="essentials">Essentials (needs)</option><option value="extras">Extras (wants)</option><option value="future">Future you (savings)</option></select>
                {s.people.length > 1 && <select className={sel} value={f.person} onChange={(e) => set({ person: e.target.value })} aria-label="Person"><option value="">Everyone</option>{s.people.map((p) => <option key={p}>{p}</option>)}</select>}
                <select className={sel} value={f.account} onChange={(e) => set({ account: e.target.value })} aria-label="Account"><option value="">All accounts</option>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                <select className={sel} value={f.sort} onChange={(e) => set({ sort: e.target.value as Filter['sort'] })} aria-label="Sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="biggest">Biggest first</option><option value="smallest">Smallest first</option></select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[14px] text-ink2" aria-live="polite">
          <span><b className="tnum text-ink">{nf.format(items.length)}</b> matching · {label}{tripOf(s, f.trip) ? <> · <b className="text-ink">{tripOf(s, f.trip)!.icon} {tripOf(s, f.trip)!.name}</b></> : null}</span>
          <span>In <b className="tnum text-good">{money(totals.in)}</b></span>
          <span>Out <b className="tnum text-ink">{money(totals.out)}</b></span>
          <span>Put aside <b className="tnum text-accent">{money(totals.aside)}</b></span>
          {totals.upcoming > 0 && <span>Still to pay <b className="tnum text-ink">{money(totals.upcoming)}</b></span>}
          {active && <Button size="sm" variant="ghost" onClick={() => { setQ(''); set({ ...EMPTY_FILTER }) }}><X size={14} />Clear filters</Button>}
        </div>
        {totals.dup > 0 && <p className="mt-3 flex items-center gap-2 rounded-2xl bg-warn-soft px-3.5 py-2.5 text-[14px] text-ink"><AlertTriangle size={16} className="shrink-0 text-warn" />{totals.dup} entries may have been added twice (same amount and category, a day apart). They're marked "twice?" below.</p>}
      </Card>

      {cat && totals.subs.length > 0 && (
        <Card i={1} className="col-span-12">
          <CardHead title={`${cat.name}: by sub-category`} sub={`Paid, ${label}`} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {totals.subs.map(([n, v]) => (
              <button key={n} type="button" onClick={() => set({ sub: n === 'No sub-category' ? '' : n })} className="rounded-2xl border border-line p-3 text-left hover:border-accent">
                <div className="mb-1.5 flex justify-between"><b>{n}</b><b className="tnum">{money(v)}</b></div>
                <Bar value={v / totals.subs[0][1]} height={7} color="var(--s1)" label={n} />
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="card col-span-12 p-3 sm:p-5" style={{ background: 'var(--surface)', backdropFilter: 'none' }}>
        {items.length === 0 ? (
          <Empty icon={<Search />} title="Nothing found" text={active ? 'Try a different search or clear the filters.' : `Nothing recorded for ${label} yet.`}
            action={<Button variant="primary" onClick={() => open({ type: 'quick' })}><Plus size={16} />Add something</Button>} />
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.date || 'all'} className="mb-3 last:mb-0">
                {g.date && (
                  <header className="sticky top-0 z-10 flex items-center justify-between bg-surface px-2 pb-1 pt-2">
                    <h3 className="flex items-center gap-2 text-[15px] font-bold">{friendlyDay(g.date)}{g.date > TODAY && <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11.5px] font-semibold text-ink2">coming up</span>}</h3>
                  </header>
                )}
                <AnimatePresence initial={false}>{g.items.map((t) => <ItemRow key={t.id} item={t} showDate={!g.date} dup={dups.has(t.id)} />)}</AnimatePresence>
              </section>
            ))}
            <Pager {...pg} noun="entries" />
          </>
        )}
      </div>
    </div>
  )
}
