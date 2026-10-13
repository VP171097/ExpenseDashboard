import { motion } from 'framer-motion'
import { AlertTriangle, Check, Repeat } from 'lucide-react'
import { useId } from 'react'
import { catOf, isPaid, ruleKey, tripOf } from '../lib/calc'
import { fmtDate } from '../lib/dates'
import { money } from '../lib/money'
import { toast, update, useData, useUI } from '../lib/store'
import type { Item } from '../lib/types'
import { CatIcon, Chip } from './ui'

export function statusOf(spent: number, plan: number): { tone: 'good' | 'warn' | 'bad' | 'plain'; word: string; color: string } {
  if (plan <= 0) return spent > 0 ? { tone: 'warn', word: 'No plan set', color: 'var(--warn)' } : { tone: 'plain', word: 'Nothing yet', color: 'var(--sother)' }
  const r = spent / plan
  if (r > 1) return { tone: 'bad', word: `Over by ${money(spent - plan)}`, color: 'var(--bad)' }
  if (r > 0.995) return { tone: 'warn', word: 'All used', color: 'var(--warn)' }
  if (r > 0.85) return { tone: 'warn', word: 'Getting close', color: 'var(--warn)' }
  return { tone: 'good', word: 'Plenty left', color: 'var(--good)' }
}
export const StatusChip = ({ spent, plan }: { spent: number; plan: number }) => {
  const s = statusOf(spent, plan)
  return <Chip tone={s.tone}>{s.word}</Chip>
}

/** Tick a generated bill/pay occurrence as paid or not. */
export function PayToggle({ item, compact = false }: { item: Item; compact?: boolean }) {
  const s = useData()
  const r = s.rules.find((x) => x.id === item.ruleId)
  if (!r) return null
  const occ = item.occ ?? item.date
  const paid = isPaid(s, r, occ)
  const word = item.type === 'income' ? (paid ? 'Received' : 'Expected') : paid ? 'Paid' : compact ? 'Pay' : 'Mark paid'
  return (
    <motion.button type="button" whileTap={{ scale: 0.92 }} aria-pressed={paid}
      title={paid ? 'Tap to mark as not paid' : item.type === 'income' ? 'Tap when this money arrives' : 'Tap when this has been paid'}
      onClick={() => {
        const prev = update((d) => { d.paid[ruleKey(r.id, occ)] = !paid })
        if (!paid) toast(`${r.name} ${item.type === 'income' ? 'marked as received' : 'marked as paid'}`, prev, 'good')
      }}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1.5 pl-1.5 pr-3 text-[13px] font-semibold transition-colors ${paid ? 'border-transparent bg-accent-soft text-accent' : 'border-line2 bg-surface text-ink2 hover:border-accent hover:text-ink'}`}>
      <span className={`grid h-[18px] w-[18px] place-items-center rounded-md border-2 transition-colors ${paid ? 'border-accent bg-accent text-accent-ink' : 'border-line2'}`}>
        {paid && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={12} strokeWidth={3.5} /></motion.span>}
      </span>
      {word}
    </motion.button>
  )
}

export function Amount({ item, className = '' }: { item: Pick<Item, 'type' | 'amount'>; className?: string }) {
  const sign = item.type === 'income' ? '+' : item.type === 'savings' ? '' : '−'
  const col = item.type === 'income' ? 'text-good' : item.type === 'savings' ? 'text-accent' : 'text-ink'
  return <span className={`tnum whitespace-nowrap font-bold ${col} ${className}`}>{sign}{money(item.amount)}</span>
}

/** One row in activity lists. Clicking opens it for editing. */
export function ItemRow({ item, showDate = false, dup = false }: { item: Item; showDate?: boolean; dup?: boolean }) {
  const s = useData()
  const open = useUI((u) => u.open)
  const c = catOf(s, item.cat)
  const trip = tripOf(s, item.trip)
  const openIt = () => {
    if (item.virtual) open({ type: 'occ', ruleId: item.ruleId!, date: item.occ ?? item.date })
    else { const t = s.tx.find((x) => x.id === item.id); if (t) open({ type: 'quick', edit: t }) }
  }
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
      className={`flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-surface2 ${item.paid ? '' : 'opacity-80'}`}>
      <button type="button" onClick={openIt} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Edit ${item.note || c?.name}`}>
        <CatIcon cat={c} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold ${item.paid ? '' : 'italic'}`}>{item.note || c?.name}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted">
            {showDate && <span>{fmtDate(item.date)}</span>}
            <span>{c?.name}{item.sub ? ` · ${item.sub}` : ''}</span>
            {trip && <span title={`Part of the trip ${trip.name}`} className="inline-flex max-w-[170px] items-center gap-1 rounded-full bg-accent-soft px-2 py-[1px] text-[11.5px] font-semibold text-accent"><span aria-hidden>{trip.icon}</span><span className="truncate">{trip.name}</span></span>}
            {dup && <span className="inline-flex items-center gap-0.5 font-semibold text-warn"><AlertTriangle size={11} /> twice?</span>}
            {item.changed && <span className="font-semibold text-accent">changed</span>}
            {item.virtual && <span className="inline-flex items-center gap-0.5" title="Repeats regularly"><Repeat size={11} />{showDate ? '' : ' regular'}</span>}
            {!showDate && item.person && s.people.length > 1 && <span>· {item.person}</span>}
          </span>
        </span>
        <Amount item={item} className="text-[15px]" />
      </button>
      {item.virtual && <PayToggle item={item} compact />}
    </motion.div>
  )
}

/** A glass savings jar: liquid rises to the real progress, with a gentle wave and bubbles. */
export function Jar({ value, color, size = 92, done = false }: { value: number; color: string; size?: number; done?: boolean }) {
  const id = useId().replace(/:/g, '')
  const p = Math.max(0, Math.min(1, value))
  const body = 'M14,24 h52 a8,8 0 0 1 8,8 v54 a12,12 0 0 1 -12,12 h-44 a12,12 0 0 1 -12,-12 v-54 a8,8 0 0 1 8,-8 z'
  const wave = (y: number) => {
    let d = `M0,${y}`
    for (let x = 0; x < 160; x += 20) d += ` q10,${(x / 20) % 2 ? 4 : -4} 20,0`
    return d + ' V140 H0 Z'
  }
  const level = 24 + (1 - p) * 74
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 80 100" aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <clipPath id={`j${id}`}><path d={body} /></clipPath>
        <linearGradient id={`l${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".95" /><stop offset="1" stopColor={color} stopOpacity=".7" /></linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".35" stopColor="#fff" stopOpacity=".05" /><stop offset=".8" stopColor="#fff" stopOpacity=".02" /><stop offset="1" stopColor="#fff" stopOpacity=".18" /></linearGradient>
        <radialGradient id={`s${id}`}><stop offset="0" stopColor="#000" stopOpacity=".28" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="40" cy="99" rx="30" ry="4" fill={`url(#s${id})`} />
      <path d={body} fill="var(--surface2)" opacity=".7" />
      <g clipPath={`url(#j${id})`}>
        <motion.g initial={{ y: 76 }} animate={{ y: (1 - p) * 74 }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}>
          <g className="wave slow"><path d={wave(24)} fill={color} /></g>
          <g className="wave"><path d={wave(26)} fill={`url(#l${id})`} /></g>
        </motion.g>
        {p > 0.08 && [18, 32, 50, 61].map((x, i) => (
          <circle key={x} className="bubble" cx={x} cy={96} r={1.2 + (i % 2)} fill="#fff" opacity=".55" style={{ animationDelay: `${i * 0.9}s`, ['--rise' as string]: `${-(96 - level - 4)}px` }} />
        ))}
      </g>
      <path d={body} fill={`url(#g${id})`} />
      <path d={body} fill="none" stroke={done ? color : 'var(--line2)'} strokeWidth="2" />
      <rect x="20" y="10" width="40" height="12" rx="4" fill={done ? color : 'var(--line2)'} />
      <rect x="22" y="12" width="36" height="3" rx="1.5" fill="#fff" opacity=".25" />
      <rect x="21" y="36" width="4" height="40" rx="2" fill="#fff" opacity=".4" />
      <rect x="27" y="40" width="2" height="18" rx="1" fill="#fff" opacity=".25" />
    </svg>
  )
}
