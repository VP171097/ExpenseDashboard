import { motion } from 'framer-motion'
import { CalendarClock, ChevronRight, Plus } from 'lucide-react'
import { ItemRow } from '../components/bits'
import { Bar, Button, Card, CardHead, CatIcon, Chip, Empty, Num, Ring } from '../components/ui'
import { catOf, earliestMonth, FREQ, itemsIn, monthItems, nextDue, perMonth, sum } from '../lib/calc'
import { Pager, usePaged } from '../components/Pager'
import { useMemo, useState } from 'react'
import { fmtDate, monthName, ordinal, parse, TODAY } from '../lib/dates'
import { money } from '../lib/money'
import { useData, useUI } from '../lib/store'
import type { Rule } from '../lib/types'

export function ruleWhen(r: Rule) {
  const d = parse(r.start)
  switch (r.freq) {
    case 'monthly': return `Every month on the ${ordinal(d.getDate())}`
    case 'weekly': return `Every ${d.toLocaleDateString(undefined, { weekday: 'long' })}`
    case 'biweekly': return `Every other ${d.toLocaleDateString(undefined, { weekday: 'long' })}`
    case 'yearly': return `Every year on ${fmtDate(r.start, { day: 'numeric', month: 'long' })}`
    default: return FREQ[r.freq].label
  }
}

export default function Bills() {
  const s = useData()
  const { month: k, open } = useUI()
  const list = monthItems(s, k).filter((t) => t.virtual).sort((a, b) => a.date.localeCompare(b.date))
  const out = list.filter((t) => t.type !== 'income')
  const paidN = out.filter((t) => t.paid).length
  const leftAmt = sum(out.filter((t) => !t.paid).map((t) => t.amount))
  const bills = s.rules.filter((r) => r.type === 'expense')
  const pay = s.rules.filter((r) => r.type === 'income')
  const save = s.rules.filter((r) => r.type === 'savings')
  const subs = bills.filter((r) => r.cat === 'subs')

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      {[
        ['Bills each month', sum(bills.map(perMonth)), `${bills.length} regular bills`],
        ['Subscriptions a year', sum(subs.map(perMonth)) * 12, `${subs.length} services`],
        ['Pay each month', sum(pay.map(perMonth)), `${pay.length} source${pay.length === 1 ? '' : 's'}`],
        ['Saved automatically', sum(save.map(perMonth)), 'every month'],
      ].map(([l, v, sub], i) => (
        <Card key={l as string} i={i} className="col-span-6 lg:col-span-3">
          <p className="label">{l}</p>
          <p className="font-display text-[28px] font-bold"><Num value={v as number} /></p>
          <p className="text-[13px] text-ink2">{sub}</p>
        </Card>
      ))}

      <Card i={4} className="col-span-12 lg:col-span-6">
        <CardHead title={`${monthName(k)} checklist`} sub="Tick each one when it leaves (or lands in) your account" />
        <div className="mb-4 flex items-center gap-4 rounded-2xl bg-surface2 p-4">
          <Ring value={out.length ? paidN / out.length : 0} size={70} stroke={8}><b className="text-[15px]">{paidN}/{out.length}</b></Ring>
          <div>
            <p className="font-display text-[19px] font-bold">{paidN === out.length && out.length ? 'Everything is paid' : `${out.length - paidN} still to go`}</p>
            <p className="text-[13.5px] text-ink2">{leftAmt ? `${money(leftAmt)} will still go out this month.` : 'Nothing else is due this month.'}</p>
          </div>
        </div>
        {list.length ? <div className="-mx-2">{list.map((t) => <ItemRow key={t.id} item={t} showDate />)}</div>
          : <Empty icon={<CalendarClock />} title="Nothing regular this month" text="Add rent, phone, subscriptions and pay once, and they'll show up every month by themselves." />}
      </Card>

      <Card i={5} className="col-span-12 lg:col-span-6">
        <CardHead title="Your regular items" sub="Set once. Tally adds them to every month for you." right={<Button variant="primary" onClick={() => open({ type: 'bill' })}><Plus size={16} />Add</Button>} />
        {s.rules.length === 0 ? (
          <Empty title="No regular items yet" text="Start with your rent or mortgage and your pay." action={<Button variant="primary" onClick={() => open({ type: 'bill' })}>Add your first one</Button>} />
        ) : (
          <div className="flex flex-col gap-5">
            {([['Bills', bills], ['Pay', pay], ['Saving', save]] as const).filter(([, l]) => l.length).map(([title, l]) => (
              <div key={title}>
                <div className="mb-1 flex items-center justify-between"><p className="label">{title}</p><span className="text-[12.5px] text-muted">{money(sum(l.map(perMonth)))} a month</span></div>
                {l.map((r, i) => {
                  const nd = nextDue(s, r)
                  return (
                    <motion.button key={r.id} type="button" onClick={() => open({ type: 'bill', id: r.id })} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-surface2">
                      <CatIcon cat={catOf(s, r.cat)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{r.name}</span>
                        <span className="block text-[12.5px] text-muted">{ruleWhen(r)}{nd ? ` · next ${fmtDate(nd)}` : ' · ended'}</span>
                      </span>
                      <span className={`tnum font-bold ${r.type === 'income' ? 'text-good' : ''}`}>{money(r.amount)}</span>
                      <ChevronRight size={16} className="text-muted" />
                    </motion.button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </Card>

      <PaymentHistory />

      {subs.length > 0 && (
        <Card i={6} className="col-span-12">
          <CardHead title="Subscriptions check-up" sub="Small monthly costs add up. Here's what each one costs you in a year." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subs.map((r) => {
              const y = perMonth(r) * 12, max = Math.max(...subs.map((x) => perMonth(x) * 12))
              return (
                <div key={r.id} className="rounded-2xl border border-line p-3.5">
                  <div className="flex justify-between gap-2"><b>{r.name}</b><Chip>{money(y)} a year</Chip></div>
                  <div className="mt-2"><Bar value={y / max} color="var(--s6)" height={7} label={`${r.name} yearly cost`} /></div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

/** Every past payment of every regular item, newest first, a page at a time. */
function PaymentHistory() {
  const s = useData()
  const [who, setWho] = useState('')
  const list = useMemo(() => itemsIn(s, `${earliestMonth(s)}-01`, TODAY).filter((t) => t.virtual && (!who || t.ruleId === who)).sort((a, b) => b.date.localeCompare(a.date)), [s, who])
  const pg = usePaged(list, who, 10)
  const missed = list.filter((t) => !t.paid && t.type !== 'income').length
  return (
    <Card i={7} className="col-span-12">
      <CardHead title="Payment history" sub="Every regular payment so far. Tap one to change it, skip it or mark it paid."
        right={<select className="field !w-auto !py-1.5" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Show payments for"><option value="">All regular items</option>{s.rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>} />
      {missed > 0 && <p className="mb-2 text-[13.5px] text-warn">{missed} past payment{missed === 1 ? ' is' : 's are'} not ticked off.</p>}
      {list.length ? <div className="-mx-2">{pg.rows.map((t) => <ItemRow key={t.id} item={t} showDate />)}</div> : <Empty title="No payments yet" />}
      <Pager {...pg} noun="payments" />
    </Card>
  )
}
