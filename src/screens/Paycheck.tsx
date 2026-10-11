import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ItemRow } from '../components/bits'
import { TimeChart } from '../components/charts'
import { Bar, Card, CardHead, Chip, Empty, Explain, Field, Num, Segmented } from '../components/ui'
import { itemsIn, payPeriod, perMonth, sum, totalPlan } from '../lib/calc'
import { addDays, fmtDate, iso, parse, THIS_MONTH, TODAY } from '../lib/dates'
import { money0 } from '../lib/money'
import { update, useData } from '../lib/store'
import type { Settings } from '../lib/types'

export default function Paycheck() {
  const s = useData()
  const st = s.settings
  const [offset, setOffset] = useState(0)
  const { start, end } = payPeriod(s, offset)
  const days = Math.round((parse(end).getTime() - parse(start).getTime()) / 86400000) + 1
  const items = itemsIn(s, start, end)
  const paid = items.filter((t) => t.paid)
  const income = sum(items.filter((t) => t.type === 'income').map((t) => t.amount))
  const received = sum(paid.filter((t) => t.type === 'income').map((t) => t.amount))
  const spent = sum(paid.filter((t) => t.type === 'expense').map((t) => t.amount))
  const everyday = sum(paid.filter((t) => t.type === 'expense' && !t.virtual).map((t) => t.amount))
  const bills = items.filter((t) => t.virtual && t.type === 'expense')
  const billsTotal = sum(bills.map((t) => t.amount))
  const billsDue = sum(bills.filter((t) => !t.paid).map((t) => t.amount))
  const saving = sum(items.filter((t) => t.type === 'savings').map((t) => t.amount))
  const billsMonthly = sum(s.rules.filter((r) => r.type === 'expense').map(perMonth))
  const everydayPlan = Math.max(0, (totalPlan(s, THIS_MONTH) - billsMonthly) * (days / 30.44))
  const plan = everydayPlan + billsTotal
  const left = income - spent - billsDue - saving
  const isNow = TODAY >= start && TODAY <= end

  const chart = useMemo(() => {
    let a = 0
    return Array.from({ length: days }, (_, i) => {
      const d = iso(addDays(parse(start), i))
      a += sum(paid.filter((t) => t.type === 'expense' && t.date === d).map((t) => t.amount))
      return { day: fmtDate(d), spent: d <= TODAY ? Math.round(a) : null, plan: Math.round((plan * (i + 1)) / days) }
    })
  }, [days, start, paid, plan])

  const cycles: [Settings['payCycle'], string][] = [['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks'], ['semimonthly', 'Twice a month'], ['monthly', 'Monthly'], ['custom', 'Custom']]
  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <Card className="col-span-12">
        <div className="flex flex-wrap items-end gap-4">
          <div><p className="mb-1.5 text-[13.5px] font-semibold text-ink2">How often are you paid?</p>
            <Segmented label="Pay cycle" value={st.payCycle} onChange={(v) => { update((d) => { d.settings.payCycle = v }); setOffset(0) }} options={cycles} /></div>
          {st.payCycle !== 'semimonthly' && <Field label="A recent payday"><input className="field" type="date" value={st.payAnchor} onChange={(e) => e.target.value && update((d) => { d.settings.payAnchor = e.target.value })} /></Field>}
          {st.payCycle === 'custom' && <Field label="Days between paydays"><input className="field !w-28" type="number" min={1} max={62} value={st.payDays} onChange={(e) => update((d) => { d.settings.payDays = Math.max(1, Math.min(62, parseInt(e.target.value) || 14)) })} /></Field>}
          <div className="ml-auto flex items-center rounded-2xl border border-line bg-surface p-1 shadow-card">
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-surface2" onClick={() => setOffset((o) => o - 1)} aria-label="Previous pay period"><ChevronLeft size={18} /></button>
            <span className="min-w-[170px] text-center font-semibold">{fmtDate(start)} – {fmtDate(end)}</span>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-surface2" onClick={() => setOffset((o) => o + 1)} aria-label="Next pay period"><ChevronRight size={18} /></button>
            {offset !== 0 && <button type="button" className="ml-1 rounded-xl px-2.5 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent-soft" onClick={() => setOffset(0)}>Now</button>}
          </div>
        </div>
      </Card>

      <section className="hero col-span-12 rounded-[28px] p-6 shadow-card sm:p-8 xl:col-span-7">
        <p className="flex items-center gap-1 text-[13px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--hero-muted)' }}>
          {isNow ? 'Left from this paycheck' : 'Left from that paycheck'}
          <span className="normal-case tracking-normal [&_button]:text-[var(--hero-muted)]"><Explain text="Pay in this period, minus what you've spent, the bills still due before your next payday, and what you're putting aside." /></span>
        </p>
        <p className={`mt-1 font-display text-[52px] font-extrabold leading-none ${left < 0 ? 'text-[#ffb4a8]' : ''}`}><Num value={left} /></p>
        <p className="mt-3 text-[16px]">{days} days · {isNow ? `${Math.max(0, Math.round((parse(end).getTime() - parse(TODAY).getTime()) / 86400000) + 1)} days to go` : TODAY < start ? 'coming up' : 'finished'}</p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[['Pay', income, received < income ? `${money0(received)} arrived` : 'all arrived'], ['Bills', billsTotal, `${money0(billsDue)} still due`], ['Everyday spending', everyday, `plan ${money0(everydayPlan)}`], ['Put aside', saving, 'from this pay']].map(([l, v, sub]) => (
            <div key={l as string}><p className="text-[13px]" style={{ color: 'var(--hero-muted)' }}>{l}</p><p className="font-display text-[24px] font-bold"><Num value={v as number} /></p><p className="text-[12px]" style={{ color: 'var(--hero-muted)' }}>{sub}</p></div>
          ))}
        </div>
      </section>

      <Card i={1} className="col-span-12 xl:col-span-5">
        <CardHead title="Plan vs real" sub="How this pay period compares with your plan" />
        <div className="flex flex-col gap-4">
          {[['Bills', billsTotal - billsDue, billsTotal, 'var(--s4)'], ['Everyday spending', everyday, everydayPlan, 'var(--s2)'], ['Put aside', sum(paid.filter((t) => t.type === 'savings').map((t) => t.amount)), saving, 'var(--s3)']].map(([l, v, p, c]) => (
            <div key={l as string}>
              <div className="mb-1.5 flex justify-between text-[14px]"><span className="font-semibold">{l}</span><span><b className="tnum">{money0(v as number)}</b> <span className="text-muted">of {money0(p as number)}</span></span></div>
              <Bar value={(p as number) ? (v as number) / (p as number) : 0} color={(v as number) > (p as number) + 1 ? 'var(--bad)' : (c as string)} label={l as string} />
            </div>
          ))}
          <div className="flex items-center justify-between rounded-2xl bg-surface2 p-3 text-[14px]"><span>Everyday spending</span>{everyday <= everydayPlan ? <Chip tone="good">{money0(everydayPlan - everyday)} under plan</Chip> : <Chip tone="bad">{money0(everyday - everydayPlan)} over plan</Chip>}</div>
        </div>
      </Card>

      <Card i={2} className="col-span-12 xl:col-span-7">
        <CardHead title="Spending through this pay period" sub="Bills and everyday spending added up day by day" />
        <TimeChart data={chart} x="day" height={250} series={[{ key: 'plan', name: 'Plan', color: 'var(--muted)', dashed: true }, { key: 'spent', name: 'Spent', color: 'var(--s2)', area: true }]} />
      </Card>
      <Card i={3} className="col-span-12 xl:col-span-5">
        <CardHead title="Bills in this period" sub="Tick them off as they're paid" />
        {bills.length ? <div className="-mx-2">{bills.sort((a, b) => a.date.localeCompare(b.date)).map((t) => <ItemRow key={t.id} item={t} showDate />)}</div> : <Empty title="No bills in this period" />}
      </Card>
    </div>
  )
}
