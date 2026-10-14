import { motion } from 'framer-motion'
import { ArrowRight, UserPlus, Users } from 'lucide-react'
import { Button, Card, CardHead, CatIcon, Empty, Explain, Num, Ring } from '../components/ui'
import { monthStats, spendCats, sum } from '../lib/calc'
import { monthName } from '../lib/dates'
import { money0, pct } from '../lib/money'
import { EMPTY_FILTER, useData, useUI } from '../lib/store'

const COLORS = ['var(--s1)', 'var(--s5)', 'var(--s3)', 'var(--s7)', 'var(--s4)', 'var(--s2)']

export default function Household() {
  const s = useData()
  const { month: k, go, setFilter } = useUI()
  const m = monthStats(s, k)
  if (s.people.length < 2) return (
    <Card><Empty icon={<Users />} title="Budgeting with someone?" text="Add your partner or housemates in Settings (up to 6 people). Then tag who paid for what and see how money is shared."
      action={<Button variant="primary" onClick={() => go('settings')}><UserPlus size={16} />Add people</Button>} /></Card>
  )
  const people = s.people.map((p, i) => ({ name: p, color: COLORS[i % COLORS.length], ...(m.people[p] ?? { in: 0, saved: 0, spent: 0, byCat: {} }) }))
  const totalIn = sum(people.map((p) => p.in)), totalSpent = sum(people.map((p) => p.spent))
  const cats = spendCats(s).filter((c) => (m.byCat[c.id] || 0) > 0).sort((a, b) => (m.byCat[b.id] || 0) - (m.byCat[a.id] || 0))
  const see = (person: string) => { setFilter({ ...EMPTY_FILTER, person }); go('activity') }

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      {people.map((p, i) => {
        const ratio = p.in ? p.spent / p.in : 0
        return (
          <motion.article key={p.name} className="card col-span-12 flex flex-col gap-4 p-5 md:col-span-6 xl:col-span-4" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full font-display text-[18px] font-bold text-white" style={{ background: p.color }}>{p.name.slice(0, 1).toUpperCase()}</span>
              <div className="flex-1"><h3 className="text-[19px] font-bold">{p.name}</h3><p className="text-[13px] text-muted">{monthName(k)}</p></div>
            </div>
            <div className="flex items-center gap-4">
              <Ring value={Math.min(1, ratio)} size={92} stroke={10} color={ratio > 1 ? 'var(--bad)' : p.color}><div><b className="text-[18px]">{p.in ? pct(ratio) : '—'}</b></div></Ring>
              <p className="flex-1 text-[14px] leading-relaxed text-ink2">{p.in ? <>Spent <b className="text-ink">{pct(ratio)}</b> of what they brought in.</> : 'No money in recorded for this person this month.'}
                <Explain text="Money out divided by money in for this person. Under 100% means they spent less than they earned." /></p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[13px]">
              <div className="rounded-xl bg-surface2 p-2.5"><p className="text-muted">In</p><b className="tnum text-good"><Num value={p.in} /></b><p className="text-[11.5px] text-muted">{pct(totalIn ? p.in / totalIn : 0)} of household</p></div>
              <div className="rounded-xl bg-surface2 p-2.5"><p className="text-muted">Out</p><b className="tnum"><Num value={p.spent} /></b><p className="text-[11.5px] text-muted">{pct(totalSpent ? p.spent / totalSpent : 0)} of household</p></div>
              <div className="rounded-xl bg-surface2 p-2.5"><p className="text-muted">Put aside</p><b className="tnum text-accent"><Num value={p.saved} /></b></div>
            </div>
            <Button variant="plain" onClick={() => see(p.name)}>See {p.name}'s payments <ArrowRight size={15} /></Button>
          </motion.article>
        )
      })}

      <Card i={4} className="col-span-12">
        <CardHead title="Who pays for what" sub="Each category split by person. Hover a bar for amounts." />
        <div className="mb-4 flex flex-wrap gap-4 text-[13px] text-ink2">{people.map((p) => <span key={p.name} className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />{p.name}</span>)}</div>
        <div className="flex flex-col gap-3">
          {cats.map((c, ci) => {
            const tot = m.byCat[c.id] || 0
            return (
              <div key={c.id} className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)_60px] items-center gap-2 text-[14px] sm:grid-cols-[minmax(0,180px)_1fr_80px] sm:gap-3">
                <span className="flex min-w-0 items-center gap-2 font-semibold"><CatIcon cat={c} size={30} /><span className="truncate">{c.name}</span></span>
                <div className="flex h-7 overflow-hidden rounded-lg bg-surface2">
                  {people.map((p, pi) => {
                    const v = p.byCat[c.id] || 0
                    return v ? <motion.div key={p.name} title={`${p.name}: ${money0(v)} (${pct(v / tot)})`} className="grid h-full place-items-center overflow-hidden text-[11px] font-bold text-white"
                      style={{ background: p.color, marginLeft: pi ? 2 : 0 }} initial={{ width: 0 }} animate={{ width: `${(v / tot) * 100}%` }} transition={{ duration: 0.8, delay: ci * 0.04 }}>{v / tot > 0.18 ? pct(v / tot) : ''}</motion.div> : null
                  })}
                </div>
                <b className="tnum text-right">{money0(tot)}</b>
              </div>
            )
          })}
        </div>
      </Card>

      <Card i={5} className="col-span-12">
        <CardHead title="The full table" sub="Every category and person for the month" />
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead><tr className="label">{['Category', ...s.people, 'Total'].map((h, i) => <th key={h} className={`border-b border-line px-2 py-2 font-bold ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
            <tbody>
              {cats.map((c) => <tr key={c.id}><td className="border-b border-line px-2 py-2">{c.name}</td>{people.map((p) => <td key={p.name} className="tnum border-b border-line px-2 py-2 text-right">{money0(p.byCat[c.id] || 0)}</td>)}<td className="tnum border-b border-line px-2 py-2 text-right font-bold">{money0(m.byCat[c.id] || 0)}</td></tr>)}
              <tr className="font-bold"><td className="px-2 py-2">Money out</td>{people.map((p) => <td key={p.name} className="tnum px-2 text-right">{money0(p.spent)}</td>)}<td className="tnum px-2 text-right">{money0(totalSpent)}</td></tr>
              <tr className="font-bold text-good"><td className="px-2 py-1">Money in</td>{people.map((p) => <td key={p.name} className="tnum px-2 text-right">{money0(p.in)}</td>)}<td className="tnum px-2 text-right">{money0(totalIn)}</td></tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
