import { motion } from 'framer-motion'
import { ArrowRight, ArrowRightLeft, CreditCard, Landmark, Pencil, PiggyBank, Plus, Trash2, Wallet } from 'lucide-react'
import { Donut, Spark } from '../components/charts'
import { Button, Card, CardHead, Chip, Empty, Explain, Num } from '../components/ui'
import { accountFlows, balances, sum } from '../lib/calc'
import { addMonths, fmtDate, monthEnd, THIS_MONTH, TODAY } from '../lib/dates'
import { money, money0 } from '../lib/money'
import { EMPTY_FILTER, toast, update, useData, useUI } from '../lib/store'
import { Pager, usePaged } from '../components/Pager'
import { useMemo } from 'react'
import type { Account } from '../lib/types'

const TYPE_ICON = { everyday: Wallet, savings: PiggyBank, card: CreditCard, cash: Wallet, investment: Landmark }
const TYPE_WORD = { everyday: 'Everyday account', savings: 'Savings', card: 'Credit card', cash: 'Cash', investment: 'Investment account' }
const COLORS = ['var(--s1)', 'var(--s3)', 'var(--s7)', 'var(--s4)', 'var(--s5)', 'var(--s2)', 'var(--s6)', 'var(--s8)']

export default function Accounts() {
  const s = useData()
  const open = useUI((u) => u.open)
  const bal = balances(s)
  const positive = s.accounts.filter((a) => (bal[a.id] || 0) > 0)
  const total = sum(s.accounts.map((a) => bal[a.id] || 0))
  const owedOnCards = sum(s.accounts.filter((a) => (bal[a.id] || 0) < 0).map((a) => -(bal[a.id] || 0)))
  const months = Array.from({ length: 12 }, (_, i) => addMonths(THIS_MONTH, i - 11))
  const all = useMemo(() => [...s.transfers].sort((a, b) => b.date.localeCompare(a.date)), [s.transfers])
  const pg = usePaged(all, 'transfers', 10)
  const recent = pg.rows

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <Card className="col-span-12 lg:col-span-5">
        <CardHead title="Where your money sits" help="Each bank account, card and cash pot. Balances update automatically from what you add in Activity and Bills." />
        {positive.length ? (
          <Donut size={210} center={money0(total)} sub="across all accounts"
            items={positive.map((a) => ({ name: a.name, value: Math.round(bal[a.id]), color: COLORS[s.accounts.indexOf(a) % COLORS.length] }))} />
        ) : <Empty title="No money in accounts yet" text="Set your starting balances in each account below." />}
        <div className="mt-4 flex flex-col gap-2">
          {s.accounts.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2 text-[14px]"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLORS[i % COLORS.length] }} /><span className="flex-1">{a.name}</span><b className={`tnum ${(bal[a.id] || 0) < 0 ? 'text-bad' : ''}`}>{money(bal[a.id] || 0)}</b></div>
          ))}
        </div>
        {owedOnCards > 0 && <p className="mt-4 rounded-2xl bg-warn-soft p-3 text-[14px]">You owe <b>{money(owedOnCards)}</b> on cards. Paying it off in full each month avoids interest.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => open({ type: 'transfer' })}><ArrowRightLeft size={16} />Move money</Button>
          <Button onClick={() => open({ type: 'account' })}><Plus size={16} />Add account</Button>
        </div>
      </Card>

      <div className="col-span-12 grid gap-4 md:grid-cols-2 lg:col-span-7 lg:gap-5">
        {s.accounts.map((a, i) => <AccountCard key={a.id} a={a} i={i} color={COLORS[i % COLORS.length]} months={months} />)}
      </div>

      <Card i={4} className="col-span-12">
        <CardHead title="Money moved between accounts" sub="Transfers and card payments. These are not spending, so they don't count against your plan." right={<Button size="sm" onClick={() => open({ type: 'transfer' })}><Plus size={15} />New</Button>} />
        {recent.length ? (
          <div className="flex flex-col">
            {recent.map((t) => (
              <div key={t.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-0">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface2 text-ink2"><ArrowRightLeft size={16} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{t.note || 'Transfer'}</span><span className="text-[12.5px] text-muted">{fmtDate(t.date)} · {s.accounts.find((x) => x.id === t.from)?.name} → {s.accounts.find((x) => x.id === t.to)?.name}</span></span>
                <b className="tnum">{money(t.amount)}</b>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label="Edit transfer" onClick={() => open({ type: 'transfer', id: t.id })}><Pencil size={15} /></button>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad" aria-label="Delete transfer" onClick={() => { const prev = update((d) => { d.transfers = d.transfers.filter((x) => x.id !== t.id) }); toast('Transfer deleted', prev) }}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        ) : null}
        <Pager {...pg} noun="transfers" />
        {recent.length ? null : <Empty icon={<ArrowRightLeft />} title="No transfers yet" text="When you move money to savings or pay off a card, record it here so every balance stays right." />}
      </Card>
    </div>
  )
}

function AccountCard({ a, i, color, months }: { a: Account; i: number; color: string; months: string[] }) {
  const s = useData()
  const { open, setFilter, go } = useUI()
  const I = TYPE_ICON[a.type] ?? Wallet
  const now = balances(s)[a.id] || 0
  const month = accountFlows(s, a.id, THIS_MONTH + '-01', TODAY)
  const ever = accountFlows(s, a.id, '1900-01-01', TODAY)
  const hist = months.map((k) => balances(s, monthEnd(k) < TODAY ? monthEnd(k) : TODAY)[a.id] || 0)
  const isCard = a.type === 'card'
  const everyday = s.accounts.find((x) => x.type === 'everyday')
  return (
    <motion.article className="card flex flex-col gap-3 p-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 16%, var(--surface))`, color }}><I size={20} /></span>
        <div className="min-w-0 flex-1"><h3 className="truncate text-[17px] font-bold">{a.name}</h3><p className="text-[12.5px] text-muted">{TYPE_WORD[a.type]}</p></div>
        <button type="button" onClick={() => open({ type: 'account', id: a.id })} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label={`Edit ${a.name}`}><Pencil size={15} /></button>
      </div>
      <div>
        <p className="label flex items-center gap-1">{isCard && now < 0 ? 'You owe' : 'Balance now'}{isCard && <Explain text="A credit card balance below zero is money you owe the bank. Use 'Pay off card' when you pay the bill." />}</p>
        <p className={`font-display text-[30px] font-bold leading-tight ${now < 0 ? 'text-bad' : ''}`}><Num value={isCard && now < 0 ? -now : now} /></p>
        <p className="text-[13px] text-ink2">Started at {money(a.start)} · {now - a.start >= 0 ? 'up' : 'down'} {money0(Math.abs(now - a.start))}</p>
      </div>
      <Spark values={hist} color={color} height={46} />
      <div className="grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-xl bg-surface2 p-2.5"><p className="text-muted">In this month</p><b className="tnum text-good">+{money0(month.received)}</b><p className="text-[11.5px] text-muted">{money0(ever.received)} in total</p></div>
        <div className="rounded-xl bg-surface2 p-2.5"><p className="text-muted">Out this month</p><b className="tnum">−{money0(month.withdrawn)}</b><p className="text-[11.5px] text-muted">{money0(ever.withdrawn)} in total</p></div>
      </div>
      {isCard && now < 0 && everyday && (
        <Button variant="primary" onClick={() => open({ type: 'transfer', from: everyday.id, to: a.id })}><CreditCard size={16} />Pay off card</Button>
      )}
      {isCard && now >= 0 && <Chip tone="good">Nothing owed</Chip>}
      <Button variant="plain" onClick={() => { setFilter({ ...EMPTY_FILTER, account: a.id, scope: 'all' }); go('activity') }}>See all activity <ArrowRight size={15} /></Button>
    </motion.article>
  )
}
