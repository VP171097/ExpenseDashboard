import { motion } from 'framer-motion'
import { Minus, Pencil, Plus, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { statusOf } from '../components/bits'
import { Bar, Button, Card, CardHead, CatIcon, Chip, Explain, Num, Segmented, Slider, Switch } from '../components/ui'
import { monthPicture, monthStats, perMonth, planFor, spendCats, sum } from '../lib/calc'
import { addMonths, monthName } from '../lib/dates'
import { money0 } from '../lib/money'
import { toast, update, useData, useUI } from '../lib/store'
import type { Category, Settings } from '../lib/types'

const GROUP_WORD = { essentials: 'Essential', extras: 'Extra', future: 'Future' } as const

export default function Plan() {
  const s = useData()
  const { month: k, open } = useUI()
  const P = monthPicture(s, k)
  const m = P.m
  const cats = spendCats(s)
  const savePlanned = sum(s.rules.filter((r) => r.type === 'savings').map(perMonth))
  const expectedPay = sum(s.rules.filter((r) => r.type === 'income').map(perMonth))
  const income = Math.max(P.moneyIn, expectedPay)
  const free = income - P.plan - savePlanned
  const [r0, r1, r2] = s.settings.ratios
  const ess = sum(cats.filter((c) => c.group === 'essentials').map((c) => planFor(s, c, k)))
  const ext = sum(cats.filter((c) => c.group !== 'essentials').map((c) => planFor(s, c, k)))
  const cyc = s.settings.payCycle
  const per = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1 }[cyc]

  const split = [
    { label: 'Essentials', v: ess, color: 'var(--s1)', target: r0, help: 'Things you need: home, food shopping, energy, getting to work, loan payments.' },
    { label: 'Extras', v: ext, color: 'var(--s5)', target: r1, help: 'Nice-to-haves: eating out, shopping, fun, trips, subscriptions.' },
    { label: 'Future you', v: savePlanned, color: 'var(--s3)', target: r2, help: 'Savings and investing. Paying yourself first is the most reliable way to build up money.' },
  ]

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <Card className="col-span-12 xl:col-span-7">
        <CardHead title={`Your plan for ${monthName(k)}`} sub="Give every bit of income a job, so nothing slips away unnoticed."
          help="A plan (also called a budget) is how much you decide in advance to spend on each thing. You don't have to be exact. It's a guide, not a rule." />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Coming in', income, 'text-ink'],
            ['Planned spending', P.plan, 'text-ink'],
            ['Put aside', savePlanned, 'text-ink'],
            [free >= 0 ? 'Not planned yet' : 'Over-planned', Math.abs(free), free >= 0 ? 'text-good' : 'text-bad'],
          ].map(([l, v, c]) => (
            <div key={l as string}><p className="label">{l}</p><p className={`font-display text-[26px] font-bold ${c}`}><Num value={v as number} /></p></div>
          ))}
        </div>
        <p className="mt-3 rounded-2xl bg-surface2 p-3.5 text-[14px] leading-relaxed">
          {free > 50 ? <>You have <b>{money0(free)}</b> that isn't planned for anything yet. Consider giving it a job, like a savings goal, so it doesn't quietly disappear.</>
            : free >= -50 ? <>Every bit of your income has a job. That's exactly how a plan should look.</>
              : <>Your plan is <b>{money0(-free)}</b> more than you earn. Lower a few of the extras below until this turns green.</>}
        </p>
        <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-line p-4">
          <div>
            <p className="font-semibold">Carry leftovers into next month</p>
            <p className="text-[13.5px] text-ink2">If you spend less than planned, the rest is added to next month's plan. Overspending is taken off.</p>
          </div>
          <Switch checked={s.settings.rollover} label="Carry leftovers into next month" onChange={(v) => { update((d) => { d.settings.rollover = v }); toast(v ? 'Leftovers will now carry over' : 'Each month now starts fresh') }} />
        </div>
      </Card>

      <div className="col-span-12 grid gap-4 md:grid-cols-2 lg:gap-5 xl:col-span-5 xl:grid-cols-1">
      <Card i={1}>
        <CardHead title="Healthy balance" sub={`A popular guide: ${r0}% essentials, ${r1}% extras, ${r2}% for the future.`}
          help="This is known as the 50/30/20 rule. It's a simple starting point, not a law. You can change the numbers in Settings." />
        <div className="flex flex-col gap-4">
          {split.map((x) => {
            const share = income ? x.v / income : 0
            const ok = x.label === 'Future you' ? share * 100 >= x.target - 0.5 : share * 100 <= x.target + 0.5
            return (
              <div key={x.label}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[14px]">
                  <span className="flex items-center gap-1 font-semibold">{x.label}<Explain text={x.help} /></span>
                  <span className="flex items-center gap-2"><b className="tnum">{Math.round(share * 100)}%</b><span className="text-muted">aim {x.target}%</span><Chip tone={ok ? 'good' : 'warn'}>{ok ? 'Good' : x.label === 'Future you' ? 'A bit low' : 'A bit high'}</Chip></span>
                </div>
                <Bar value={share} marker={x.target / 100} color={x.color} label={x.label} />
              </div>
            )
          })}
        </div>
      </Card>

      <Card i={2}>
        <CardHead title="Per paycheck" sub="The same plan, split by how often you're paid" />
        <Segmented label="How often you're paid" value={cyc} onChange={(v: Settings['payCycle']) => update((d) => { d.settings.payCycle = v })}
          options={[['weekly', 'Weekly'], ['biweekly', '2 weeks'], ['semimonthly', 'Twice a month'], ['monthly', 'Monthly']]} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[['Each paycheck', income / per], ['Spending', P.plan / per], ['Put aside', savePlanned / per], ['Left over', free / per]].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl bg-surface2 p-3.5"><p className="label">{l}</p><p className={`font-display text-[22px] font-bold ${(v as number) < 0 ? 'text-bad' : ''}`}><Num value={v as number} /></p></div>
          ))}
        </div>
      </Card>
      </div>

      <div className="col-span-12 flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h2 className="text-[22px] font-bold">Spending pots</h2>
          <p className="text-[14px] text-ink2">Drag a slider to change a plan. "Usually" shows your average over the last 3 months.</p>
        </div>
        <Button onClick={() => open({ type: 'category' })}><Plus size={16} />New pot</Button>
      </div>

      {cats.map((c, i) => <Pot key={c.id} c={c} i={i} spent={m.byCat[c.id] || 0} plan={planFor(s, c, k)} usual={sum([1, 2, 3].map((n) => monthStats(s, addMonths(k, -n)).byCat[c.id] || 0)) / 3} />)}
    </div>
  )
}

function Pot({ c, i, spent, plan, usual }: { c: Category; i: number; spent: number; plan: number; usual: number }) {
  const open = useUI((u) => u.open)
  const rollover = useData().settings.rollover
  const [val, setVal] = useState(c.plan)
  const t = useRef<number>()
  useEffect(() => setVal(c.plan), [c.plan])
  const commit = (v: number) => {
    setVal(v)
    clearTimeout(t.current)
    t.current = window.setTimeout(() => update((d) => { const x = d.categories.find((y) => y.id === c.id); if (x) x.plan = Math.max(0, Math.round(v)) }), 300)
  }
  const effective = plan + (val - c.plan)
  const st = statusOf(spent, effective)
  const left = effective - spent
  const max = Math.max(500, Math.ceil((Math.max(c.plan, usual, spent) * 2) / 50) * 50)
  return (
    <motion.article className="card col-span-12 flex flex-col gap-3 p-5 sm:col-span-6 xl:col-span-4"
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.035 }}>
      <div className="flex items-center gap-3">
        <CatIcon cat={c} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-bold">{c.name}</h3>
          <p className="text-[12.5px] text-muted">{GROUP_WORD[c.group]}</p>
        </div>
        <button type="button" onClick={() => open({ type: 'category', id: c.id })} className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface2 hover:text-ink" aria-label={`Edit ${c.name}`}><Pencil size={16} /></button>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className={`font-display text-[28px] font-bold leading-none ${left < 0 ? 'text-bad' : ''}`}><Num value={Math.abs(left)} /></p>
          <p className="mt-1 text-[13px] text-ink2">{left >= 0 ? 'left to spend' : 'over the plan'}</p>
        </div>
        <Chip tone={st.tone}>{st.word}</Chip>
      </div>
      <Bar value={effective ? spent / effective : spent ? 1 : 0} color={st.color} label={`${c.name}: spent ${money0(spent)} of ${money0(effective)}`} />
      <p className="text-[13px] text-ink2">Spent <b className="text-ink">{money0(spent)}</b> of <b className="text-ink">{money0(effective)}</b>{rollover && Math.round(plan - c.plan) !== 0 ? ` (includes ${money0(plan - c.plan)} carried over)` : ''}</p>
      <div className="rounded-2xl bg-surface2 p-3">
        <div className="flex items-center justify-between gap-2 text-[13.5px]">
          <span className="font-semibold">Monthly plan</span>
          <span className="flex items-center gap-1">
            <button type="button" className="grid h-7 w-7 place-items-center rounded-lg border border-line2 bg-surface hover:border-accent" onClick={() => commit(Math.max(0, val - 10))} aria-label={`Lower ${c.name} plan`}><Minus size={14} /></button>
            <b className="tnum min-w-[64px] text-center text-[15px]">{money0(val)}</b>
            <button type="button" className="grid h-7 w-7 place-items-center rounded-lg border border-line2 bg-surface hover:border-accent" onClick={() => commit(val + 10)} aria-label={`Raise ${c.name} plan`}><Plus size={14} /></button>
          </span>
        </div>
        <Slider value={val} min={0} max={max} step={5} onChange={commit} label={`${c.name} monthly plan`} />
        {usual > 0 && (
          <div className="flex items-center justify-between gap-2 text-[12.5px] text-muted">
            <span>Usually about {money0(usual)}</span>
            {Math.abs(usual - val) > 10 && <button type="button" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline" onClick={() => commit(Math.round(usual / 5) * 5)}><Wand2 size={13} />Use this</button>}
          </div>
        )}
      </div>
    </motion.article>
  )
}
