import { motion } from 'framer-motion'
import { CalendarCheck, ChevronDown, CreditCard, Landmark, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Bar, Button, Card, CardHead, Chip, Empty, Explain, Num } from '../components/ui'
import { sum } from '../lib/calc'
import { fmtDate, friendlyDay } from '../lib/dates'
import { emiSchedule, emiStatus } from '../lib/emi'
import { money, money0 } from '../lib/money'
import { useData, useUI } from '../lib/store'
import type { Emi } from '../lib/types'

const monthYear = (d: string) => fmtDate(d, { month: 'long', year: 'numeric' })

export default function Emis() {
  const s = useData()
  const open = useUI((u) => u.open)
  const list = s.emis ?? []
  if (!list.length) return (
    <Card><Empty icon={<Landmark />} title="No loans or card EMIs yet" text="Add a loan or something you're paying off in monthly instalments. Tally works out the EMI, how many you've paid and when the last one is due."
      action={<div className="flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={() => open({ type: 'emi', kind: 'loan' })}><Plus size={16} />Add a loan</Button><Button onClick={() => open({ type: 'emi', kind: 'card' })}><CreditCard size={16} />Add a card EMI</Button></div>} /></Card>
  )
  const st = list.map((e) => ({ e, st: emiStatus(e) }))
  const live = st.filter((x) => x.st.left > 0)
  const owed = sum(live.map((x) => x.st.owed))
  const monthly = sum(live.filter((x) => x.st.done > 0 || x.st.thisMonth).map((x) => x.st.emi))
  const nextUp = live.map((x) => x.st.next!).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))[0]
  const nextOf = nextUp && live.find((x) => x.st.next?.date === nextUp.date)
  const freeBy = live.map((x) => x.st.last).sort().at(-1)
  const loans = st.filter((x) => x.e.kind === 'loan'), cards = st.filter((x) => x.e.kind === 'card')

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <motion.section className="hero col-span-12 overflow-hidden rounded-[28px] p-6 shadow-card sm:p-8" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[13px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--hero-muted)' }}>Still owed on loans and EMIs</p>
        <p className="mt-1 font-display text-[44px] font-extrabold leading-none sm:text-[58px]"><Num value={owed} /></p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {([
            ['Paid each month', money0(monthly), `${live.length} running`],
            ['Next EMI', nextUp ? money0(nextOf!.st.emi) : '—', nextUp ? `${nextOf!.e.name} · ${friendlyDay(nextUp.date)}` : 'nothing due'],
            ['Last EMI', freeBy ? monthYear(freeBy) : '—', freeBy ? 'then you are free of them' : 'all paid off'],
            ['Interest still to pay', money0(sum(live.map((x) => x.st.interestTotal - x.st.interestPaid))), 'if paid as scheduled'],
          ] as const).map(([l, v, sub]) => (
            <div key={l}><p className="text-[13px]" style={{ color: 'var(--hero-muted)' }}>{l}</p><p className="font-display text-[22px] font-bold">{v}</p><p className="text-[12px]" style={{ color: 'var(--hero-muted)' }}>{sub}</p></div>
          ))}
        </div>
      </motion.section>

      <Section title="Loans" sub="Home, car, personal and education loans" items={loans} add={() => open({ type: 'emi', kind: 'loan' })} addLabel="Add a loan" i={1} />
      <Section title="Card EMIs" sub="Purchases on a credit card turned into monthly instalments" items={cards} add={() => open({ type: 'emi', kind: 'card' })} addLabel="Add a card EMI" i={2} />
      <p className="col-span-12 text-[12.5px] text-muted">Worked out on a reducing balance with interest charged monthly, the way most lenders do it. Lenders round and count days a little differently, so figures can be a few {s.settings.currency === 'INR' ? 'rupees' : 'units'} off your statement. Enter the EMI from your statement when you edit a loan to match it exactly.</p>
    </div>
  )
}

function Section({ title, sub, items, add, addLabel, i }: { title: string; sub: string; items: { e: Emi; st: ReturnType<typeof emiStatus> }[]; add: () => void; addLabel: string; i: number }) {
  return (
    <Card i={i} className="col-span-12">
      <CardHead title={title} sub={sub} right={<Button size="sm" onClick={add}><Plus size={15} />{addLabel}</Button>} />
      {items.length ? <div className="grid gap-3 lg:grid-cols-2">{items.map((x, n) => <EmiCard key={x.e.id} e={x.e} st={x.st} i={n} />)}</div>
        : <p className="text-[14px] text-ink2">None yet.</p>}
    </Card>
  )
}

function EmiCard({ e, st, i }: { e: Emi; st: ReturnType<typeof emiStatus>; i: number }) {
  const open = useUI((u) => u.open)
  const [plan, setPlan] = useState(false)
  const tm = st.thisMonth
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{e.kind === 'card' ? <CreditCard size={19} /> : <Landmark size={19} />}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{e.name}</p>
          <p className="text-[13px] text-ink2">{[e.lender, `${money0(e.principal)} at ${e.rate}% a year`, `${e.months} months`].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" onClick={() => open({ type: 'emi', id: e.id })} aria-label={`Edit ${e.name}`}><Pencil size={15} /></button>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><p className="label">EMI</p><p className="font-display text-[26px] font-bold leading-none">{money(st.emi)}</p></div>
        {st.phase === 'closed' ? <Chip tone="good">All {e.months} paid</Chip>
          : tm ? <Chip tone={tm.paid ? 'good' : 'accent'}>{tm.paid ? 'Paid' : 'Due'} {fmtDate(tm.date)} · EMI {tm.n} of {e.months}</Chip>
            : <Chip>Starts {fmtDate(st.next!.date, { day: 'numeric', month: 'short', year: 'numeric' })}</Chip>}
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-ink2">{st.done} of {e.months} EMIs paid</span><span className="font-semibold">{st.left} left</span></div>
        <Bar value={st.done / e.months} label={`${st.done} of ${e.months} EMIs paid`} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
        {([
          ['Still owed', money0(st.owed)], ['Last EMI', fmtDate(st.last, { day: 'numeric', month: 'short', year: 'numeric' })],
          ['Interest paid so far', money0(st.interestPaid)], ['Total interest', money0(st.interestTotal)],
        ] as const).map(([l, v]) => <div key={l} className="rounded-xl bg-surface2 p-2"><dt className="text-muted">{l}</dt><dd className="tnum text-[14px] font-bold">{v}</dd></div>)}
      </dl>
      <button type="button" onClick={() => setPlan((v) => !v)} aria-expanded={plan} className="flex w-fit items-center gap-1 text-[13.5px] font-semibold text-accent">
        <CalendarCheck size={15} />{plan ? 'Hide' : 'See'} every EMI<motion.span animate={{ rotate: plan ? 180 : 0 }}><ChevronDown size={14} /></motion.span>
      </button>
      {plan && <Schedule e={e} done={st.done} />}
    </motion.article>
  )
}

function Schedule({ e, done }: { e: Emi; done: number }) {
  const rows = emiSchedule(e)
  return (
    <div className="max-h-72 overflow-auto rounded-xl border border-line">
      <table className="w-full text-[12.5px] tnum">
        <thead className="sticky top-0 bg-surface2 text-left text-muted"><tr><th className="px-2 py-1.5">#</th><th className="px-2">Date</th><th className="px-2 text-right">EMI</th><th className="px-2 text-right"><span className="inline-flex items-center gap-0.5">Interest<Explain text="The part of this EMI that is the lender's charge for the loan." /></span></th><th className="px-2 text-right">Loan</th><th className="px-2 text-right">Owed after</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} className={`border-t border-line ${r.n <= done ? 'text-muted' : ''}`}>
              <td className="px-2 py-1">{r.n}</td><td className="px-2">{fmtDate(r.date, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
              <td className="px-2 text-right">{money(r.pay)}</td><td className="px-2 text-right">{money(r.interest)}</td><td className="px-2 text-right">{money(r.principal)}</td><td className="px-2 text-right">{money0(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
