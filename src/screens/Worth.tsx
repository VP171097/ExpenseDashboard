import { motion } from 'framer-motion'
import { ChevronRight, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Donut, MonthBars, TimeChart } from '../components/charts'
import { Bar, Button, Card, CardHead, Explain, Num, Slider } from '../components/ui'
import { balances, sum, worthNow } from '../lib/calc'
import { addMonths, monthName, NOW, THIS_MONTH } from '../lib/dates'
import { money, money0 } from '../lib/money'
import { update, useData, useUI } from '../lib/store'

export default function Worth() {
  const s = useData()
  const open = useUI((u) => u.open)
  const go = useUI((u) => u.go)
  const w = worthNow(s)
  const bal = balances(s)
  const months = Array.from({ length: 13 }, (_, i) => addMonths(THIS_MONTH, i - 12))
  const hist = months.map((m) => (m === THIS_MONTH ? { own: w.own, owe: w.owe } : s.history[m]))
  const first = hist.find(Boolean)
  const change = first ? w.net - (first.own - first.owe) : 0
  const invested = sum(s.holdings.filter((h) => h.kind === 'own' && h.group === 'Investments').map((h) => +h.value))

  const [fc, setFc] = useState(s.settings.forecast)
  useEffect(() => {
    const t = setTimeout(() => { if (JSON.stringify(fc) !== JSON.stringify(s.settings.forecast)) update((d) => { d.settings.forecast = fc }) }, 400)
    return () => clearTimeout(t)
  }, [fc, s.settings.forecast])
  const proj = useMemo(() => {
    const out: { y: number; value: number; paid: number }[] = []
    let v = invested, paid = invested
    const r = fc.rate / 1200
    for (let m = 0; m <= fc.years * 12; m++) {
      if (m % 12 === 0) out.push({ y: NOW.getFullYear() + m / 12, value: Math.round(v), paid: Math.round(paid) })
      v = v * (1 + r) + fc.monthly
      paid += fc.monthly
    }
    return out
  }, [invested, fc])
  const end = proj[proj.length - 1]

  const groups: Record<string, typeof s.holdings> = {}
  s.holdings.filter((h) => h.kind === 'own').forEach((h) => (groups[h.group] ??= []).push(h))
  const Row = ({ name, sub, v, neg, onClick }: { name: string; sub: string; v: number; neg?: boolean; onClick?: () => void }) => (
    <button type="button" onClick={onClick} disabled={!onClick} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors enabled:hover:bg-surface2">
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{name}</span><span className="block text-[12.5px] text-muted">{sub}</span></span>
      <span className={`tnum font-bold ${neg ? 'text-bad' : ''}`}>{neg ? '−' : ''}{money(Math.abs(v))}</span>
      {onClick && <ChevronRight size={16} className="text-muted" />}
    </button>
  )

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <motion.section className="hero col-span-12 overflow-hidden rounded-[28px] p-6 shadow-card sm:p-8 xl:col-span-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <p className="flex items-center gap-1 text-[13px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--hero-muted)' }}>What you're worth
          <span className="normal-case tracking-normal [&_button]:text-[var(--hero-muted)]"><Explain text="Add up everything you own (money in accounts, investments, a car) and take away everything you owe (loans, cards). Watching this grow is the best sign you're getting ahead." /></span></p>
        <p className="mt-1 font-display text-[52px] font-extrabold leading-none sm:text-[60px]"><Num value={w.net} /></p>
        <p className="mt-3 text-[16px]">{change >= 0 ? 'Up' : 'Down'} <b>{money0(Math.abs(change))}</b> in the last 12 months.</p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div><p className="text-[13px]" style={{ color: 'var(--hero-muted)' }}>You own</p><p className="font-display text-[26px] font-bold"><Num value={w.own} /></p></div>
          <div><p className="text-[13px]" style={{ color: 'var(--hero-muted)' }}>You owe</p><p className="font-display text-[26px] font-bold"><Num value={w.owe} /></p></div>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white/10">
          <motion.span className="h-full" style={{ background: 'var(--s3)' }} initial={{ width: 0 }} animate={{ width: `${(w.own / Math.max(1, w.own + w.owe)) * 100}%` }} transition={{ duration: 1 }} />
          <motion.span className="ml-[3px] h-full" style={{ background: 'var(--s8)' }} initial={{ width: 0 }} animate={{ width: `${(w.owe / Math.max(1, w.own + w.owe)) * 100}%` }} transition={{ duration: 1, delay: 0.15 }} />
        </div>
      </motion.section>

      <Card i={1} className="col-span-12 xl:col-span-7">
        <CardHead title="Over the last year" sub="Tally saves a snapshot every month you use it" />
        <TimeChart data={months.map((m, i) => ({ label: monthName(m, false), net: hist[i] ? Math.round(hist[i]!.own - hist[i]!.owe) : null }))} x="label" height={250}
          series={[{ key: 'net', name: "What you're worth", color: 'var(--s3)', area: true }]} />
      </Card>

      <Card i={2} className="col-span-12 md:col-span-6">
        <CardHead title="What you own" right={<Button size="sm" onClick={() => open({ type: 'holding', kind: 'own' })}><Plus size={15} />Add</Button>} />
        <p className="label px-2">Bank accounts</p>
        {s.accounts.map((a) => <Row key={a.id} name={a.name} sub="Updates from your activity" v={bal[a.id] || 0} neg={(bal[a.id] || 0) < 0} onClick={() => open({ type: 'account', id: a.id })} />)}
        {Object.entries(groups).map(([g, l]) => (
          <div key={g} className="mt-2"><p className="label px-2">{g}</p>{l.map((h) => <Row key={h.id} name={h.name} sub="Update the value now and then" v={+h.value} onClick={() => open({ type: 'holding', id: h.id })} />)}</div>
        ))}
      </Card>

      <Card i={3} className="col-span-12 md:col-span-6">
        <CardHead title="What you owe" right={<Button size="sm" onClick={() => open({ type: 'holding', kind: 'owe' })}><Plus size={15} />Add</Button>} />
        {s.debts.length > 0 && <><p className="label px-2">Loans and cards</p>{s.debts.map((d) => <Row key={d.id} name={d.name} sub={`${d.rate}% interest`} v={+d.balance} neg onClick={() => go('debts')} />)}</>}
        {s.holdings.filter((h) => h.kind === 'owe').map((h) => <Row key={h.id} name={h.name} sub={h.group} v={+h.value} neg onClick={() => open({ type: 'holding', id: h.id })} />)}
        {!s.debts.length && !s.holdings.some((h) => h.kind === 'owe') && <p className="px-2 py-6 text-center text-ink2">You don't owe anything. Brilliant.</p>}
      </Card>

      <Card i={4} className="col-span-12 lg:col-span-5">
        <CardHead title="How your wealth is spread" sub="Everything you own, grouped" />
        {(() => {
          const cash = Math.max(0, s.accounts.reduce((a, x) => a + Math.max(0, bal[x.id] || 0), 0))
          const items = [{ name: 'Bank accounts', value: Math.round(cash), color: 'var(--s1)' }, ...Object.entries(groups).map(([g, l], i) => ({ name: g, value: Math.round(l.reduce((a, h) => a + +h.value, 0)), color: ['var(--s3)', 'var(--s7)', 'var(--s4)', 'var(--s5)', 'var(--s2)'][i % 5] }))].filter((x) => x.value > 0)
          const tot = items.reduce((a, x) => a + x.value, 0) || 1
          return (
            <div className="flex flex-wrap items-center gap-5">
              <Donut items={items} center={money0(w.own)} sub="you own" size={190} />
              <ul className="flex min-w-[160px] flex-1 flex-col gap-2 text-[14px]">{items.map((x) => <li key={x.name} className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: x.color }} /><span className="flex-1">{x.name}</span><span className="text-muted">{Math.round((x.value / tot) * 100)}%</span><b className="tnum">{money0(x.value)}</b></li>)}</ul>
            </div>
          )
        })()}
      </Card>

      <Card i={5} className="col-span-12 lg:col-span-7">
        <CardHead title="Assets vs liabilities" sub="Month by month" />
        <MonthBars data={months.map((m, i) => ({ label: monthName(m, false), own: hist[i] ? Math.round(hist[i]!.own) : 0, owe: hist[i] ? Math.round(hist[i]!.owe) : 0 }))}
          series={[{ key: 'own', name: 'You own', color: 'var(--s3)' }, { key: 'owe', name: 'You owe', color: 'var(--s8)' }]} height={230} />
      </Card>

      <Card i={6} className="col-span-12">
        <CardHead title="What if I invest regularly?" sub={`Starting from the ${money0(invested)} you have invested today.`}
          help="Investing means putting money into things like funds that can grow over time. Growth is never guaranteed: values go up and down, especially in the short run. This is only an estimate." />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 flex flex-col gap-5 lg:col-span-4">
            {([['monthly', 'Each month I put in', 0, 3000, 25, (v: number) => money0(v)], ['rate', 'It grows each year by', 0, 12, 0.5, (v: number) => `${v}%`], ['years', 'For this many years', 1, 40, 1, (v: number) => `${v}`]] as const).map(([key, label, min, max, step, f]) => (
              <div key={key}>
                <div className="flex items-baseline justify-between"><span className="font-semibold">{label}</span><b className="font-display text-[22px]">{f(fc[key])}</b></div>
                <Slider value={fc[key]} min={min} max={max} step={step} onChange={(v) => setFc((x) => ({ ...x, [key]: v }))} label={label} />
              </div>
            ))}
            <div className="rounded-2xl bg-surface2 p-4 text-[14px] leading-relaxed">
              After {fc.years} years you could have <b className="text-ink">{money0(end.value)}</b>. You put in {money0(end.paid)}, and growth adds about <b className="text-good">{money0(end.value - end.paid)}</b>.
              <div className="mt-3"><Bar value={end.paid / Math.max(1, end.value)} color="var(--sother)" label="Share you put in" /></div>
              <p className="mt-1 text-[12.5px] text-muted">Grey is what you put in. The rest is growth.</p>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-8">
            <TimeChart data={proj} x="y" height={300} series={[{ key: 'paid', name: 'What you put in', color: 'var(--sother)', dashed: true }, { key: 'value', name: 'Estimated value', color: 'var(--s7)', area: true }]} />
          </div>
        </div>
      </Card>
    </div>
  )
}
