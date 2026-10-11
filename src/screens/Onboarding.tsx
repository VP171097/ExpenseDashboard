import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Eye, Gauge, PiggyBank, Sparkles, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, CatIcon, celebrate, Field, Segmented, Slider } from '../components/ui'
import { balances, uid, worthNow } from '../lib/calc'
import { addDays, addMonthsDate, iso, NOW, pad, parse, THIS_MONTH, TODAY } from '../lib/dates'
import { CURRENCIES, money0, setCurrency } from '../lib/money'
import { baseCategories, emptyState, sampleState, seedHistory } from '../lib/sample'
import { replaceData } from '../lib/store'
import type { Freq, State } from '../lib/types'

const BILLS: { key: string; name: string; cat: string; hint: number }[] = [
  { key: 'rent', name: 'Rent or mortgage', cat: 'housing', hint: 1200 },
  { key: 'energy', name: 'Electricity & gas', cat: 'utilities', hint: 90 },
  { key: 'phone', name: 'Phone & internet', cat: 'utilities', hint: 60 },
  { key: 'streaming', name: 'Streaming & apps', cat: 'subs', hint: 25 },
  { key: 'gym', name: 'Gym', cat: 'subs', hint: 35 },
  { key: 'insurance', name: 'Insurance', cat: 'other', hint: 50 },
  { key: 'transport', name: 'Travel pass or car costs', cat: 'transport', hint: 80 },
  { key: 'loan', name: 'Loan or card payment', cat: 'debt', hint: 150 },
]
/* How leftover money is shared across everyday pots when building a first plan. */
const EVERYDAY: [string, number][] = [['groceries', 0.32], ['dining', 0.1], ['transport', 0.12], ['shopping', 0.1], ['health', 0.05], ['fun', 0.08], ['travel', 0.06], ['gifts', 0.03], ['other', 0.04]]

const PER: Record<string, number> = { monthly: 1, biweekly: 26 / 12, weekly: 52 / 12 }

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [name, setName] = useState('')
  const [partner, setPartner] = useState('')
  const [currency, setCur] = useState(() => {
    try {
      const loc = Intl.NumberFormat().resolvedOptions().locale
      const guess: Record<string, string> = { US: 'USD', GB: 'GBP', IN: 'INR', CA: 'CAD', AU: 'AUD', CH: 'CHF', JP: 'JPY', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', SG: 'SGD', AE: 'AED', ZA: 'ZAR', BR: 'BRL', MX: 'MXN', NZ: 'NZD' }
      return guess[loc.split('-')[1] ?? ''] ?? 'EUR'
    } catch { return 'EUR' }
  })
  const [pay, setPay] = useState('')
  const [cycle, setCycle] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly')
  const [payday, setPayday] = useState(iso(addDays(NOW, 7)))
  const [bank, setBank] = useState('')
  const [bills, setBills] = useState<Record<string, { on: boolean; amount: string; day: string }>>({})
  const [goal, setGoal] = useState<'rainy' | 'holiday' | 'big' | 'none'>('rainy')
  const [goalAmt, setGoalAmt] = useState('')
  const [goalMonths, setGoalMonths] = useState(12)
  setCurrency(currency)

  const monthlyPay = (parseFloat(pay) || 0) * PER[cycle]
  const billTotal = Object.values(bills).filter((b) => b.on).reduce((a, b) => a + (parseFloat(b.amount) || 0), 0)
  const goalTarget = parseFloat(goalAmt) || (goal === 'rainy' ? Math.round(billTotal * 3 || monthlyPay * 2) : 0)
  const saveMonthly = goal === 'none' ? Math.round(monthlyPay * 0.1) : Math.min(Math.round(goalTarget / goalMonths), Math.round(monthlyPay * 0.25))
  const everyday = Math.max(0, monthlyPay - billTotal - saveMonthly)
  const buffer = Math.round(everyday * 0.1)

  const next = () => { setDir(1); setStep((x) => x + 1) }
  const back = () => { setDir(-1); setStep((x) => x - 1) }

  const example = () => { const s = sampleState(); seedHistory(s, worthNow(s)); setCurrency(s.settings.currency); replaceData(s) }

  const build = () => {
    const s: State = emptyState(currency)
    s.settings.name = name.trim()
    s.settings.payCycle = cycle
    s.settings.payAnchor = payday
    s.people = [name.trim() || 'Me', ...(partner.trim() ? [partner.trim()] : [])]
    s.categories = baseCategories().map((c) => ({ ...c, plan: 0 }))
    const plan = (id: string, v: number) => { const c = s.categories.find((x) => x.id === id); if (c) c.plan = Math.round((c.plan + v) / 5) * 5 }
    // pay: start at the last payday so this month's pay is counted
    if (monthlyPay > 0) {
      const next = parse(payday)
      const freq: Freq = cycle
      let last = cycle === 'monthly' ? addMonthsDate(next, -1) : addDays(next, cycle === 'weekly' ? -7 : -14)
      if (iso(last) > TODAY) last = next
      s.rules.push({ id: uid(), name: 'My pay', type: 'income', cat: 'salary', amount: parseFloat(pay), freq, start: iso(last), account: 'chk', person: s.people[0], paidThrough: TODAY })
    }
    for (const b of BILLS) {
      const v = bills[b.key]
      if (!v?.on || !(parseFloat(v.amount) > 0)) continue
      const day = Math.min(28, Math.max(1, parseInt(v.day) || 1))
      s.rules.push({ id: uid(), name: b.name, type: 'expense', cat: b.cat, amount: parseFloat(v.amount), freq: 'monthly', start: `${THIS_MONTH}-${pad(day)}`, account: 'chk', person: s.people[0], paidThrough: TODAY })
      plan(b.cat, parseFloat(v.amount))
    }
    const spread = everyday - buffer
    for (const [id, share] of EVERYDAY) plan(id, spread * share)
    if (saveMonthly > 0) {
      const day = Math.min(28, parse(payday).getDate() + 1)
      s.rules.push({ id: uid(), name: 'Pay myself first', type: 'savings', cat: 'savings', amount: saveMonthly, freq: 'monthly', start: `${THIS_MONTH}-${pad(day)}`, account: 'chk', to: 'sav', person: s.people[0], paidThrough: TODAY })
    }
    if (goal !== 'none' && goalTarget > 0)
      s.goals.push({ id: uid(), name: goal === 'rainy' ? 'Rainy day fund' : goal === 'holiday' ? 'Holiday' : 'Something big', target: goalTarget, saved: 0, due: iso(addMonthsDate(NOW, goalMonths)) })
    const bankNow = parseFloat(bank)
    if (isFinite(bankNow)) { const b = balances(s).chk || 0; s.accounts[0].start = Math.round((bankNow - b) * 100) / 100 }
    celebrate(null, true)
    replaceData(s)
  }

  const canNext = [true, true, monthlyPay > 0, true, true, true][step]
  const steps = ['Welcome', 'About you', 'Money in', 'Bills', 'Saving', 'Your plan']

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8" style={{ background: 'radial-gradient(90% 70% at 50% 0%, color-mix(in srgb, var(--accent) 16%, var(--bg)), var(--bg))' }}>
      <div className="mb-6 flex items-center gap-2.5 font-display text-[26px] font-extrabold">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cover text-cover-ink"><Wallet size={20} /></span>Tally
      </div>
      <div className="card relative w-full max-w-xl overflow-hidden p-6 sm:p-9">
        {step > 0 && (
          <div className="mb-6 flex items-center gap-1.5" aria-label={`Step ${step} of ${steps.length - 1}`}>
            {steps.slice(1).map((l, i) => (
              <motion.span key={l} className="h-1.5 flex-1 rounded-full" animate={{ background: i < step ? 'var(--accent)' : 'var(--line)' }} />
            ))}
          </div>
        )}
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            {step === 0 && (
              <div className="flex flex-col gap-5">
                <h1 className="text-[34px] font-extrabold leading-tight sm:text-[40px]">Money, made simple.</h1>
                <p className="text-[17px] text-ink2">Tally shows you what's safe to spend, keeps track of your bills and helps you save. No money knowledge needed.</p>
                <ul className="flex flex-col gap-3">
                  {[[Eye, 'See exactly what you can spend today'], [Gauge, 'Know if you are on track at a glance'], [PiggyBank, 'Save up for the things you care about']].map(([I, t], i) => {
                    const Icon = I as typeof Eye
                    return <motion.li key={t as string} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className="flex items-center gap-3 text-[15.5px] font-medium"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={20} /></span>{t as string}</motion.li>
                  })}
                </ul>
                <div className="mt-2 flex flex-col gap-2.5">
                  <Button variant="primary" size="lg" onClick={next}>Set up my money (2 minutes) <ArrowRight size={18} /></Button>
                  <Button variant="ghost" size="lg" onClick={example}><Sparkles size={18} />Just look around with example data</Button>
                </div>
                <p className="text-center text-[12.5px] text-muted">Everything stays on this device. No sign-up, no bank login.</p>
              </div>
            )}
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <h2 className="text-[28px] font-extrabold">Nice to meet you</h2>
                <Field label="What should we call you?"><input className="field text-[17px]" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" /></Field>
                <Field label="Which money do you use?"><select className="field text-[16px]" value={currency} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}</select></Field>
                <Field label="Sharing money with someone? (optional)" hint="Add their name and you can see who spent what."><input className="field" value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Partner or housemate's name" /></Field>
              </div>
            )}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                <h2 className="text-[28px] font-extrabold">How much do you get paid?</h2>
                <p className="-mt-2 text-ink2">Use the amount that actually lands in your bank account, after tax.</p>
                <Field label="Each payment"><input className="field font-display text-[28px] font-bold" autoFocus type="number" min="0" step="any" inputMode="decimal" value={pay} onChange={(e) => setPay(e.target.value)} placeholder="0" /></Field>
                <div><p className="mb-2 text-[13.5px] font-semibold text-ink2">How often?</p><Segmented label="How often" value={cycle} onChange={setCycle} options={[['monthly', 'Every month'], ['biweekly', 'Every 2 weeks'], ['weekly', 'Every week']]} /></div>
                <Field label="When is your next payday?"><input className="field" type="date" value={payday} onChange={(e) => setPayday(e.target.value)} /></Field>
                <Field label="Money in your main bank account today (optional)" hint="Helps Tally show the right balance."><input className="field" type="number" step="any" inputMode="decimal" value={bank} onChange={(e) => setBank(e.target.value)} /></Field>
                {monthlyPay > 0 && cycle !== 'monthly' && <p className="rounded-2xl bg-accent-soft p-3 text-[14.5px]">That's about <b>{money0(monthlyPay)}</b> a month.</p>}
              </div>
            )}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-[28px] font-extrabold">Which bills do you pay?</h2>
                <p className="-mt-2 text-ink2">Tap the ones you have. Rough amounts are fine; you can change them later.</p>
                <div className="flex flex-col gap-2">
                  {BILLS.map((b) => {
                    const v = bills[b.key] ?? { on: false, amount: '', day: '1' }
                    const cat = baseCategories().find((c) => c.id === b.cat)
                    const setV = (p: Partial<typeof v>) => setBills((x) => ({ ...x, [b.key]: { ...v, ...p } }))
                    return (
                      <motion.div key={b.key} layout className={`rounded-2xl border-2 transition-colors ${v.on ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                        <button type="button" onClick={() => setV({ on: !v.on, amount: v.amount || String(b.hint) })} aria-pressed={v.on} className="flex w-full items-center gap-3 p-3 text-left">
                          <CatIcon cat={cat} size={36} />
                          <span className="flex-1 font-semibold">{b.name}</span>
                          <span className={`grid h-6 w-6 place-items-center rounded-lg border-2 ${v.on ? 'border-accent bg-accent text-accent-ink' : 'border-line2'}`}>{v.on && <Check size={14} strokeWidth={3} />}</span>
                        </button>
                        <AnimatePresence>
                          {v.on && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="grid grid-cols-2 gap-3 px-3 pb-3">
                                <Field label="Amount a month"><input className="field" type="number" min="0" step="any" inputMode="decimal" value={v.amount} onChange={(e) => setV({ amount: e.target.value })} /></Field>
                                <Field label="Day of the month"><input className="field" type="number" min="1" max="28" value={v.day} onChange={(e) => setV({ day: e.target.value })} /></Field>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="flex flex-col gap-5">
                <h2 className="text-[28px] font-extrabold">Saving for something?</h2>
                <p className="-mt-2 text-ink2">Saving a little each month adds up. Most people start with a rainy day fund for surprises.</p>
                <div className="grid grid-cols-2 gap-2">
                  {([['rainy', 'Rainy day fund', 'For surprises like a broken boiler'], ['holiday', 'A holiday', 'Something to look forward to'], ['big', 'Something big', 'A car, a deposit, a wedding'], ['none', 'Not right now', "We'll still save 10% for you"]] as const).map(([v, t, d]) => (
                    <button key={v} type="button" onClick={() => setGoal(v)} aria-pressed={goal === v} className={`rounded-2xl border-2 p-3.5 text-left transition-colors ${goal === v ? 'border-accent bg-accent-soft' : 'border-line hover:border-line2'}`}>
                      <span className="block font-bold">{t}</span><span className="block text-[13px] text-ink2">{d}</span>
                    </button>
                  ))}
                </div>
                {goal !== 'none' && (
                  <>
                    <Field label="How much do you want to save?"><input className="field text-[18px] font-bold" type="number" min="0" step="any" inputMode="decimal" value={goalAmt} onChange={(e) => setGoalAmt(e.target.value)} placeholder={goal === 'rainy' ? String(goalTarget || '') : ''} /></Field>
                    <div>
                      <div className="flex justify-between text-[14px] font-semibold"><span>In how long?</span><span>{goalMonths} months</span></div>
                      <Slider value={goalMonths} min={2} max={48} onChange={setGoalMonths} label="Months to save" />
                    </div>
                  </>
                )}
                {monthlyPay > 0 && <p className="rounded-2xl bg-accent-soft p-3.5 text-[14.5px]">Tally will put aside <b>{money0(saveMonthly)}</b> each month for you.</p>}
              </div>
            )}
            {step === 5 && (
              <div className="flex flex-col gap-5">
                <h2 className="text-[28px] font-extrabold">Here's your plan</h2>
                <p className="-mt-2 text-ink2">Every month, your {money0(monthlyPay)} is split like this. You can fine-tune it any time.</p>
                <PlanPreview rows={[['Bills', billTotal, 'var(--s1)'], ['Everyday spending', everyday - buffer, 'var(--s2)'], ['Put aside', saveMonthly, 'var(--s3)'], ['Spare, just in case', buffer, 'var(--s4)']]} total={monthlyPay} />
                {billTotal + saveMonthly > monthlyPay && <p className="rounded-2xl bg-bad-soft p-3 text-[14px] text-bad">Your bills and savings are more than you earn. You can still continue and adjust things on the Plan page.</p>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        {step > 0 && (
          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={back}><ArrowLeft size={16} />Back</Button>
            {step < 5 ? <Button variant="primary" size="lg" onClick={next} disabled={!canNext}>{step === 3 && !Object.values(bills).some((b) => b.on) ? 'Skip for now' : 'Continue'} <ArrowRight size={18} /></Button>
              : <Button variant="primary" size="lg" onClick={build}>Open my dashboard <ArrowRight size={18} /></Button>}
          </div>
        )}
      </div>
    </div>
  )
}

function PlanPreview({ rows, total }: { rows: [string, number, string][]; total: number }) {
  const t = useMemo(() => Math.max(1, total), [total])
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-5 gap-[3px] overflow-hidden rounded-full">
        {rows.filter((r) => r[1] > 0).map(([l, v, c], i) => <motion.span key={l} style={{ background: c }} initial={{ width: 0 }} animate={{ width: `${(v / t) * 100}%` }} transition={{ duration: 0.9, delay: i * 0.15 }} />)}
      </div>
      {rows.map(([l, v, c], i) => (
        <motion.div key={l} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="flex items-center gap-3 rounded-2xl bg-surface2 px-4 py-3">
          <i className="h-3 w-3 rounded" style={{ background: c }} /><span className="flex-1 font-semibold">{l}</span><b className="tnum">{money0(Math.max(0, v))}</b>
        </motion.div>
      ))}
    </div>
  )
}
