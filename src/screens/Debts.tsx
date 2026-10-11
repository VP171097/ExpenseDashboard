import { motion } from 'framer-motion'
import { Pencil, Plus, Rabbit, Scale } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TimeChart } from '../components/charts'
import { Button, Card, CardHead, celebrate, Chip, Empty, Explain, Num, Slider } from '../components/ui'
import { simulate, sum, uid } from '../lib/calc'
import { addMonthsDate, NOW, TODAY } from '../lib/dates'
import { money, money0 } from '../lib/money'
import { toast, update, useData, useUI } from '../lib/store'

const when = (n: number) => addMonthsDate(NOW, n).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
const span = (n: number) => `${Math.floor(n / 12) ? `${Math.floor(n / 12)} year${Math.floor(n / 12) > 1 ? 's' : ''} ` : ''}${n % 12 ? `${n % 12} month${n % 12 > 1 ? 's' : ''}` : ''}`.trim()

export default function Debts() {
  const s = useData()
  const open = useUI((u) => u.open)
  const D = s.debts
  const [extra, setExtra] = useState(s.settings.extra)
  useEffect(() => setExtra(s.settings.extra), [s.settings.extra])
  useEffect(() => {
    if (extra === s.settings.extra) return
    const t = setTimeout(() => update((d) => { d.settings.extra = extra }), 350)
    return () => clearTimeout(t)
  }, [extra, s.settings.extra])

  if (!D.length) return (
    <Card><Empty icon={<Scale />} title="No debts. Lovely!" text="If you have a loan or a credit card you're paying off, add it to see when you'll be free of it."
      action={<Button variant="primary" onClick={() => open({ type: 'debt' })}><Plus size={16} />Add a loan or card</Button>} /></Card>
  )
  const strat = s.settings.strategy
  const plan = simulate(D, extra, strat)
  const other = simulate(D, extra, strat === 'cheapest' ? 'quickwins' : 'cheapest')
  const mins = simulate(D, 0, strat)
  const total = sum(D.map((d) => +d.balance))
  const n = Math.max(plan.line.length, mins.line.length)
  const data = Array.from({ length: n }, (_, i) => ({ m: i, plan: i < plan.line.length ? Math.round(plan.line[i]) : null, mins: i < mins.line.length ? Math.round(mins.line[i]) : null }))
  const order = [...D].sort((a, b) => (plan.payoff[a.id] || 999) - (plan.payoff[b.id] || 999))

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <motion.section className="hero col-span-12 overflow-hidden rounded-[28px] p-6 shadow-card sm:p-8" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[13px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--hero-muted)' }}>You could be debt-free by</p>
        <p className="mt-1 font-display text-[44px] font-extrabold leading-none sm:text-[58px]">{plan.stuck ? 'Not yet' : when(plan.months)}</p>
        <p className="mt-3 max-w-2xl text-[16px]">
          {plan.stuck ? 'Your payments are smaller than the interest being added. Try raising the extra amount below.'
            : <>That's {span(plan.months)} from now. You owe <b>{money0(total)}</b> today and will pay about <b>{money0(plan.interest)}</b> in interest along the way.
              {mins.months > plan.months && <> Paying the extra saves you <b>{money0(mins.interest - plan.interest)}</b> and {span(mins.months - plan.months)}.</>}</>}
        </p>
      </motion.section>

      <Card i={1} className="col-span-12 lg:col-span-5">
        <CardHead title="Choose your way" sub="Pay the minimum on everything, then put any extra on one debt at a time." />
        <div className="grid gap-3">
          {([['cheapest', Scale, 'Cheapest way', 'Pay off the highest interest first. You pay the least in total.'], ['quickwins', Rabbit, 'Quick wins', 'Pay off the smallest debt first. Each one gone feels great and keeps you going.']] as const).map(([v, I, t, d]) => {
            const r = v === strat ? plan : other
            return (
              <motion.button key={v} type="button" whileTap={{ scale: 0.98 }} onClick={() => update((x) => { x.settings.strategy = v })} aria-pressed={strat === v}
                className={`flex gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${strat === v ? 'border-accent bg-accent-soft' : 'border-line hover:border-line2'}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${strat === v ? 'bg-accent text-accent-ink' : 'bg-surface2 text-ink2'}`}><I size={20} /></span>
                <span>
                  <span className="block font-bold">{t}</span>
                  <span className="block text-[13.5px] text-ink2">{d}</span>
                  {!r.stuck && <span className="mt-1 block text-[13px] font-semibold">Done {when(r.months)} · {money0(r.interest)} interest</span>}
                </span>
              </motion.button>
            )
          })}
        </div>
        <div className="mt-5">
          <div className="flex items-baseline justify-between"><span className="flex items-center gap-1 font-semibold">Extra each month<Explain text="Anything you pay on top of the minimum payments. Even a small amount makes a big difference over time." /></span><b className="font-display text-[24px]">{money0(extra)}</b></div>
          <Slider value={extra} min={0} max={1500} step={10} onChange={setExtra} label="Extra each month" />
          <p className="text-[13px] text-ink2">Total going to debts each month: {money0(sum(D.map((d) => +d.min)) + extra)}</p>
        </div>
      </Card>

      <Card i={2} className="col-span-12 lg:col-span-7">
        <CardHead title="Your path to zero" sub="How much you'll owe over time" right={
          <div className="flex gap-4 text-[13px] text-ink2"><span className="inline-flex items-center gap-1.5"><i className="h-[3px] w-4 rounded" style={{ background: 'var(--s1)' }} />Your plan</span><span className="inline-flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--sother)' }} />Minimums only</span></div>} />
        <TimeChart data={data} x="m" height={270} xTicks={data.filter((d) => d.m % 12 === 0).map((d) => d.m)}
          title={(l) => when(+l)} series={[{ key: 'mins', name: 'Minimums only', color: 'var(--sother)', dashed: true }, { key: 'plan', name: 'Your plan', color: 'var(--s1)', area: true }]} />
        <p className="-mt-1 text-center text-[12px] text-muted">Months from now (each tick is a year)</p>
      </Card>

      <Card i={3} className="col-span-12">
        <CardHead title="The order to pay them off" sub="Made a payment on top of the usual? Log it and the balance goes down." right={<Button onClick={() => open({ type: 'debt' })}><Plus size={16} />Add</Button>} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {order.map((d, i) => <DebtCard key={d.id} id={d.id} i={i} payoffIn={plan.payoff[d.id]} />)}
        </div>
      </Card>
    </div>
  )
}

function DebtCard({ id, i, payoffIn }: { id: string; i: number; payoffIn?: number }) {
  const s = useData()
  const open = useUI((u) => u.open)
  const d = s.debts.find((x) => x.id === id)!
  const [amt, setAmt] = useState('')
  const log = (e: React.FormEvent) => {
    e.preventDefault()
    const a = parseFloat(amt)
    if (!(a > 0)) return
    const cleared = a >= d.balance
    update((x) => {
      const y = x.debts.find((z) => z.id === id)!
      y.balance = Math.max(0, Math.round((y.balance - a) * 100) / 100)
      x.tx.push({ id: uid(), date: TODAY, type: 'expense', cat: x.categories.find((c) => c.id === 'debt')?.id ?? x.categories[0].id, amount: a, account: 'chk', person: x.people[0], note: `Extra payment: ${d.name}` })
    })
    setAmt('')
    celebrate(null, cleared)
    toast(cleared ? `${d.name} is paid off. Amazing!` : `Logged ${money(a)} off ${d.name}`, null, 'good')
  }
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display font-bold ${i === 0 ? 'bg-accent text-accent-ink' : 'bg-surface2 text-ink2'}`}>{i + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{d.name}</p>
          <p className="text-[13px] text-ink2">{d.rate}% interest a year · min {money(d.min)} a month</p>
        </div>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" onClick={() => open({ type: 'debt', id })} aria-label={`Edit ${d.name}`}><Pencil size={15} /></button>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div><p className="label">Still owed</p><p className="font-display text-[26px] font-bold leading-none"><Num value={d.balance} /></p></div>
        {payoffIn ? <Chip tone={i === 0 ? 'accent' : 'plain'}>Gone by {addMonthsDate(NOW, payoffIn).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Chip> : <Chip tone="bad">Not in sight</Chip>}
      </div>
      {i === 0 && <p className="text-[13px] text-ink2">Your extra money goes here first.</p>}
      <form onSubmit={log} className="flex gap-2">
        <input className="field !py-2" type="number" min="0" step="any" inputMode="decimal" placeholder="Extra paid" value={amt} onChange={(e) => setAmt(e.target.value)} aria-label={`Extra payment for ${d.name}`} />
        <Button type="submit" size="sm">Log payment</Button>
      </form>
    </motion.div>
  )
}
