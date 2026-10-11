import { motion } from 'framer-motion'
import { Flame, Pencil, Plus, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Jar } from '../components/bits'
import { Button, Card, CardHead, celebrate, Chip, Explain, Num } from '../components/ui'
import { monthStats, monthsUntil, uid } from '../lib/calc'
import { daysIn, fmtDate, monthName, NOW, pad, THIS_MONTH, TODAY } from '../lib/dates'
import { money0 } from '../lib/money'
import { toast, update, useData, useUI } from '../lib/store'
import type { Goal } from '../lib/types'

const COLORS = ['var(--s3)', 'var(--s1)', 'var(--s7)', 'var(--s5)', 'var(--s4)', 'var(--s2)']

export default function Goals() {
  const s = useData()
  const open = useUI((u) => u.open)
  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      {s.goals.map((g, i) => <GoalCard key={g.id} g={g} i={i} color={COLORS[i % COLORS.length]} />)}
      <motion.button type="button" onClick={() => open({ type: 'goal' })} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
        className="col-span-12 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-line2 p-6 text-center text-ink2 transition-colors hover:border-accent hover:text-ink sm:col-span-6 xl:col-span-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><Plus size={26} /></span>
        <span className="font-display text-[19px] font-bold text-ink">Start a new goal</span>
        <span className="max-w-[260px] text-[14px]">A holiday, a car, a rainy day fund. Tell Tally the amount and the date, and it works out how much to put aside each month.</span>
      </motion.button>
      <Challenge />
    </div>
  )
}

function GoalCard({ g, i, color }: { g: Goal; i: number; color: string }) {
  const open = useUI((u) => u.open)
  const s = useData()
  const [amt, setAmt] = useState('')
  const p = g.target ? g.saved / g.target : 0
  const done = g.saved >= g.target
  const months = monthsUntil(g.due)
  const need = Math.max(0, (g.target - g.saved) / months)
  const late = !done && g.due < TODAY
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const a = parseFloat(amt)
    if (!(a > 0)) return
    const willFinish = g.saved + a >= g.target
    update((d) => {
      const x = d.goals.find((y) => y.id === g.id)!
      x.saved = Math.round((x.saved + a) * 100) / 100
      d.tx.push({ id: uid(), date: TODAY, type: 'savings', cat: d.categories.find((c) => c.kind === 'savings')?.id ?? 'savings', amount: a, account: 'chk', to: d.accounts.find((c) => c.type === 'savings')?.id, person: d.people[0], note: `For ${g.name}` })
    })
    setAmt('')
    const r = (document.getElementById(`goal-${g.id}`) as HTMLElement)?.getBoundingClientRect()
    celebrate(r ? { clientX: r.left + r.width / 2, clientY: r.top + 60 } : null, willFinish)
    toast(willFinish ? `You did it! ${g.name} is fully saved.` : `Added ${money0(a)} to ${g.name}`, null, 'good')
  }
  return (
    <motion.article id={`goal-${g.id}`} className="card col-span-12 flex flex-col gap-4 p-5 sm:col-span-6 xl:col-span-4"
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
      <div className="flex items-start gap-4">
        <Jar value={p} color={color} size={84} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[19px] font-bold leading-tight">{g.name}</h3>
            <button type="button" onClick={() => open({ type: 'goal', id: g.id })} className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label={`Edit ${g.name}`}><Pencil size={15} /></button>
          </div>
          <p className="mt-1 font-display text-[30px] font-bold leading-none"><Num value={g.saved} /></p>
          <p className="mt-1 text-[13.5px] text-ink2">saved of {money0(g.target)} · {Math.round(p * 100)}%</p>
          <div className="mt-2">
            {done ? <Chip tone="good"><Trophy size={13} />Goal reached</Chip>
              : late ? <Chip tone="bad">Target date has passed</Chip>
                : <Chip tone="accent">Put aside {money0(need)} a month</Chip>}
          </div>
        </div>
      </div>
      <p className="text-[13.5px] text-ink2">{done ? 'Time to enjoy it, or set a new goal.' : `${money0(g.target - g.saved)} to go by ${fmtDate(g.due, { month: 'long', year: 'numeric' })} (${months} month${months === 1 ? '' : 's'}).`}</p>
      {!done && (
        <form onSubmit={add} className="mt-auto flex gap-2">
          <input className="field" type="number" min="0" step="any" inputMode="decimal" placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} aria-label={`Amount to add to ${g.name}`} />
          <Button type="submit" variant="primary">Add money</Button>
        </form>
      )}
      {s.sample && i === 0 && !done && <p className="-mt-2 text-[12px] text-muted">Adding money also records it as "put aside" in your activity.</p>}
    </motion.article>
  )
}

function Challenge() {
  const s = useData()
  const k = useUI((u) => u.month)
  const m = monthStats(s, k)
  const dim = daysIn(k)
  const last = k === THIS_MONTH ? NOW.getDate() : k < THIS_MONTH ? dim : 0
  const target = s.settings.challengeTarget
  let done = 0, run = 0, best = 0
  const days = Array.from({ length: dim }, (_, i) => {
    const d = i + 1, past = d <= last, ok = past && !m.extrasDay[d]
    if (past) { if (ok) { done++; run++; best = Math.max(best, run) } else run = 0 }
    return { d, st: !past ? 'future' : ok ? 'yes' : 'no' }
  })
  return (
    <Card i={6} className="col-span-12">
      <CardHead title={<>No-spend challenge · {monthName(k)}</>} sub="Try to have days where you spend nothing on extras like eating out, shopping or fun."
        help="Bills and essentials like groceries don't count. It's only about the nice-to-haves. Each green day is money kept in your pocket."
        right={<label className="flex items-center gap-2 text-[13.5px] font-semibold text-ink2">Aim for
          <input className="field !w-20 !py-1.5" type="number" min={1} max={31} value={target} onChange={(e) => update((d) => { d.settings.challengeTarget = Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) })} aria-label="Target no-spend days" /> days</label>} />
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><p className="label">No-spend days</p><p className="font-display text-[30px] font-bold">{done}<span className="text-[15px] font-medium text-muted"> of {target}</span></p></div>
        <div><p className="label">Current streak</p><p className="flex items-center gap-1.5 font-display text-[30px] font-bold">{run}{run >= 2 && <Flame className="text-s2" size={24} />}</p></div>
        <div><p className="label">Best streak</p><p className="font-display text-[30px] font-bold">{best}</p></div>
        <div><p className="label">How it's going</p><div className="mt-2">{done >= target ? <Chip tone="good"><Trophy size={13} />Challenge complete</Chip> : <Chip tone="accent">{target - done} more to go</Chip>}</div></div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(16,minmax(0,1fr))]">
        {days.map((x, i) => (
          <motion.div key={x.d} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.012 }}
            title={`${fmtDate(`${k}-${pad(x.d)}`)}${x.st === 'yes' ? ': no extras' : x.st === 'no' ? ': spent on extras' : ''}`}
            className={`grid aspect-square place-items-center rounded-xl text-[12.5px] font-bold ${x.st === 'yes' ? 'bg-good-soft text-good' : x.st === 'no' ? 'bg-bad-soft text-bad' : 'border border-line bg-surface2 text-muted'}`}>
            {x.d}
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[12.5px] text-ink2">
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-good-soft" />No extras <Explain text="Nothing was spent on extras that day." /></span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-bad-soft" />Spent on extras</span>
      </div>
    </Card>
  )
}
