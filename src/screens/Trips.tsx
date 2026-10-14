import { motion } from 'framer-motion'
import { ArrowRight, CalendarRange, Pencil, Plane, Plus, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ItemRow } from '../components/bits'
import { Pager, usePaged } from '../components/Pager'
import { Bar, Button, Card, CardHead, CatIcon, Chip, Empty, Explain, Num, Ring, Tilt } from '../components/ui'
import { catOf, tripPhase, tripStats, type TripPhase } from '../lib/calc'
import { fmtDate, friendlyDay, parse, TODAY } from '../lib/dates'
import { money, money0, pct } from '../lib/money'
import { EMPTY_FILTER, useData, useUI } from '../lib/store'
import type { Item, Trip } from '../lib/types'

const ORDER: Record<TripPhase, number> = { on: 0, upcoming: 1, done: 2 }
const sortTrips = (a: Trip, b: Trip) => ORDER[tripPhase(a)] - ORDER[tripPhase(b)] || (tripPhase(a) === 'upcoming' ? a.start.localeCompare(b.start) : b.start.localeCompare(a.start))
export const tripDates = (t: Trip) => {
  const sameYear = t.start.slice(0, 4) === t.end.slice(0, 4)
  if (t.start === t.end) return fmtDate(t.start, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmtDate(t.start, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })} – ${fmtDate(t.end, { day: 'numeric', month: 'short', year: 'numeric' })}`
}
const daysUntil = (d: string) => Math.round((parse(d).getTime() - parse(TODAY).getTime()) / 864e5)

function phaseChip(t: Trip, st: ReturnType<typeof tripStats>) {
  if (st.phase === 'on') return <Chip tone="good">On now · day {st.dayNo} of {st.days}</Chip>
  if (st.phase === 'upcoming') { const n = Math.max(1, daysUntil(t.start)); return <Chip tone="accent">Starts in {n} day{n === 1 ? '' : 's'}</Chip> }
  return <Chip>Finished</Chip>
}
function budgetTone(t: Trip, st: ReturnType<typeof tripStats>) {
  if (!(t.budget > 0)) return 'var(--accent)'
  return st.used > 1 ? 'var(--bad)' : st.used > 0.85 ? 'var(--warn)' : 'var(--good)'
}

export default function Trips() {
  const s = useData()
  const open = useUI((u) => u.open)
  const trips = useMemo(() => [...(s.trips ?? [])].sort(sortTrips), [s.trips])
  const [pick, setPick] = useState<string>('')
  // a trip that was just created opens straight away
  const known = useRef(new Set(trips.map((t) => t.id)))
  useEffect(() => {
    const fresh = trips.find((t) => !known.current.has(t.id))
    known.current = new Set(trips.map((t) => t.id))
    if (fresh) setPick(fresh.id)
  }, [trips])
  const sel = trips.find((t) => t.id === pick) ?? trips[0]

  if (!trips.length) return (
    <div className="grid grid-cols-12"><Card className="col-span-12">
      <Empty icon={<Plane />} title="Plan your first trip"
        text="Create a trip or holiday, set a budget if you like, and tag what you spend on it. Each expense still shows in Activity and your monthly plan, with the trip's name next to it."
        action={<Button variant="primary" onClick={() => open({ type: 'trip' })}><Plus size={16} />Create a trip</Button>} />
    </Card></div>
  )

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <div className="no-scrollbar col-span-12 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Your trips">
        {trips.map((t, i) => <TripChip key={t.id} t={t} i={i} on={t.id === sel?.id} onPick={() => setPick(t.id)} />)}
        <motion.button type="button" onClick={() => open({ type: 'trip' })} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          className="flex min-w-[150px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[20px] border-2 border-dashed border-line2 p-4 text-[14px] font-semibold text-ink2 hover:border-accent hover:text-ink">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Plus size={20} /></span>New trip
        </motion.button>
      </div>
      {sel && <TripDetail key={sel.id} t={sel} />}
    </div>
  )
}

function TripChip({ t, i, on, onPick }: { t: Trip; i: number; on: boolean; onPick: () => void }) {
  const s = useData()
  const st = tripStats(s, t)
  return (
    <motion.button type="button" role="tab" aria-selected={on} onClick={onPick} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
      className={`card flex min-w-[220px] max-w-[260px] shrink-0 flex-col gap-2 p-4 text-left ${on ? '!border-accent ring-2 ring-[var(--accent)]' : ''}`}>
      <span className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2 text-[22px]" aria-hidden>{t.icon}</span>
        <span className="min-w-0"><b className="block truncate">{t.name}</b><span className="block text-[12.5px] text-muted">{tripDates(t)}</span></span>
      </span>
      <span className="flex items-baseline justify-between text-[13px]"><b className="tnum text-[15px]">{money0(st.net)}</b><span className="text-muted">{t.budget > 0 ? `of ${money0(t.budget)}` : `${st.count} entries`}</span></span>
      {t.budget > 0 && <Bar value={Math.min(1, st.used)} height={6} color={budgetTone(t, st)} label={`${t.name} budget used`} />}
    </motion.button>
  )
}

function TripDetail({ t }: { t: Trip }) {
  const s = useData()
  const { open, setFilter, go } = useUI()
  const st = tripStats(s, t)
  const tone = budgetTone(t, st)
  const add = () => open({ type: 'quick', kind: 'expense', trip: t.id, date: st.phase === 'on' ? undefined : st.phase === 'done' ? t.end : undefined })
  const list = useMemo(() => st.entries.map((x) => ({ ...x, paid: true }) as Item).sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount), [st.entries])
  const pg = usePaged(list, t.id, 10)
  const maxDay = Math.max(1, st.before, ...st.daily.map((d) => d.amount))
  const people = st.byPerson.length > 1 || (s.people.length > 1 && st.byPerson.length)
  const share = s.people.length > 1 ? st.spent / s.people.length : 0

  return (
    <>
      <Card className="col-span-12 lg:col-span-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Tilt max={6}>
            <div className="relative grid place-items-center">
              <Ring value={t.budget > 0 ? Math.min(1, st.used) : st.count ? 1 : 0} size={150} stroke={14} color={tone}>
                <span className="flex flex-col items-center"><span className="text-[40px] leading-none" aria-hidden>{t.icon}</span>
                <span className="mt-1 text-[12.5px] font-semibold text-ink2">{t.budget > 0 ? `${pct(st.used)} used` : 'No budget'}</span></span>
              </Ring>
            </div>
          </Tilt>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[24px] font-extrabold leading-tight">{t.name}</h2>
                <p className="flex items-center gap-1.5 text-[14px] text-ink2"><CalendarRange size={15} />{tripDates(t)} · {st.days} day{st.days === 1 ? '' : 's'}</p>
              </div>
              <button type="button" onClick={() => open({ type: 'trip', id: t.id })} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label={`Edit ${t.name}`}><Pencil size={16} /></button>
            </div>
            <div className="mt-2">{phaseChip(t, st)}</div>
            {t.note && <p className="mt-2 text-[14px] text-ink2">{t.note}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Tile label="Spent" value={<Num value={st.net} />} sub={st.back > 0 ? `after ${money0(st.back)} back` : `${st.count} entr${st.count === 1 ? 'y' : 'ies'}`} />
              {t.budget > 0
                ? <Tile label={st.left >= 0 ? 'Left in budget' : 'Over budget'} value={<span style={{ color: st.left < 0 ? 'var(--bad)' : undefined }}>{money0(Math.abs(st.left))}</span>} sub={`of ${money0(t.budget)}`} />
                : <Tile label="Budget" value={<span className="text-muted">Not set</span>} sub={<button type="button" className="font-semibold text-accent" onClick={() => open({ type: 'trip', id: t.id })}>Set one</button>} />}
              {st.phase !== 'upcoming' && st.dayNo > 0
                ? <Tile label="Average a day" value={money0(st.perDay)} sub={st.before > 0 ? `plus ${money0(st.before)} booked before` : 'while away'} />
                : <Tile label="Booked so far" value={money0(st.before)} sub="before you go" />}
            </div>
            {t.budget > 0 && st.phase !== 'done' && (
              <p className="mt-3 rounded-2xl bg-accent-soft p-3 text-[14.5px]">
                {st.left <= 0 ? <>The budget is used up. Anything more comes from your everyday money.</>
                  : <>You can spend about <b className="tnum">{money0(st.perDayLeft)}</b> a day for {st.phase === 'on' ? `the ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left` : `each of the ${st.days} days`} and stay on budget.</>}
              </p>
            )}
            {st.phase === 'done' && t.budget > 0 && <p className={`mt-3 rounded-2xl p-3 text-[14.5px] ${st.left >= 0 ? 'bg-good-soft' : 'bg-bad-soft'}`}>{st.left >= 0 ? <>Came in <b>{money0(st.left)}</b> under budget. Nice work.</> : <>Went <b>{money0(-st.left)}</b> over budget. Worth remembering for the next one.</>}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={add}><Plus size={16} />Add trip expense</Button>
              <Button variant="plain" onClick={() => { setFilter({ ...EMPTY_FILTER, trip: t.id, scope: 'all' }); go('activity') }}>See in Activity <ArrowRight size={15} /></Button>
            </div>
          </div>
        </div>
      </Card>

      <Card i={1} className="col-span-12 lg:col-span-4">
        <CardHead title="Where it went" help="Trip spending by category. These amounts also count in your normal monthly categories." />
        {st.byCat.length ? (
          <div className="flex flex-col gap-3">
            {st.byCat.map(([id, v]) => { const c = catOf(s, id); return (
              <div key={id} className="flex items-center gap-3">
                <CatIcon cat={c} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between gap-2 text-[14px]"><span className="truncate font-semibold">{c?.name ?? 'Other'}</span><b className="tnum">{money(v)}</b></div>
                  <Bar value={v / st.byCat[0][1]} height={6} label={c?.name} />
                </div>
              </div>) })}
          </div>
        ) : <p className="text-[14px] text-ink2">Nothing spent yet. Add bookings, meals and tickets as they happen.</p>}
      </Card>

      <Card i={2} className={`col-span-12 ${people ? 'lg:col-span-8' : ''}`}>
        <CardHead title="Day by day" sub={st.before > 0 ? 'Including what you booked before leaving' : undefined} />
        <div className="no-scrollbar -mx-1 flex h-[180px] items-end gap-1.5 overflow-x-auto px-1 pb-1" role="list" aria-label="Spending per day">
          {st.before > 0 && <DayBar label="Before" title={`Booked before: ${money(st.before)}`} value={st.before} max={maxDay} color="var(--s7)" i={0} />}
          {st.daily.map((d, i) => <DayBar key={d.date} label={fmtDate(d.date, st.days > 10 ? { day: 'numeric' } : { weekday: 'short' })} title={`${friendlyDay(d.date)}: ${money(d.amount)}`} value={d.amount} max={maxDay} color={d.date > TODAY ? 'var(--line2)' : 'var(--accent)'} i={i + 1} />)}
        </div>
      </Card>

      {people ? (
        <Card i={3} className="col-span-12 lg:col-span-4">
          <CardHead title={<span className="flex items-center gap-2"><Users size={17} />Who paid</span>} help="Split evenly between everyone in the household. Change who paid on any entry by tapping it." />
          <div className="flex flex-col gap-2.5">
            {s.people.map((p) => { const v = st.byPerson.find(([n]) => n === p)?.[1] ?? 0, diff = v - share; return (
              <div key={p} className="rounded-2xl bg-surface2 p-3 text-[14px]">
                <div className="flex justify-between"><b>{p}</b><b className="tnum">{money(v)}</b></div>
                <p className="text-[12.5px] text-ink2">{Math.abs(diff) < 0.5 ? 'Paid their even share' : diff > 0 ? `Paid ${money(diff)} more than an even share` : `Paid ${money(-diff)} less than an even share`}</p>
              </div>) })}
            <p className="flex items-center gap-1 text-[12.5px] text-muted">Even share: {money(share)} each <Explain text="The trip's spending divided by the number of people in the household. Money back from refunds isn't included." /></p>
          </div>
        </Card>
      ) : null}

      <div className="card col-span-12 p-3 sm:p-5" style={{ background: 'var(--surface)', backdropFilter: 'none' }}>
        <div className="px-2"><CardHead title="Trip entries" sub="Every one of these also appears in Activity with the trip's name" right={<Button size="sm" onClick={add}><Plus size={15} />Add</Button>} /></div>
        {pg.rows.length ? pg.rows.map((x) => <ItemRow key={x.id} item={x} showDate />) : <Empty title="No entries yet" text="Tap Add, or choose this trip when you add any expense." />}
        <Pager {...pg} noun="entries" />
      </div>
    </>
  )
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface2 p-3">
      <p className="text-[12.5px] font-semibold text-ink2">{label}</p>
      <p className="font-display text-[22px] font-bold leading-tight tnum">{value}</p>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </div>
  )
}

function DayBar({ label, title, value, max, color, i }: { label: string; title: string; value: number; max: number; color: string; i: number }) {
  return (
    <div role="listitem" className="flex h-full min-w-[30px] flex-1 flex-col items-center gap-1" title={title} aria-label={title}>
      <div className="flex w-full flex-1 items-end justify-center">
        <motion.div className="w-full max-w-[34px] rounded-t-lg" style={{ background: color, opacity: value > 0 ? 1 : 0.35 }}
          initial={{ height: 0 }} animate={{ height: `${Math.max(value > 0 ? 3 : 1.5, (value / max) * 100)}%` }} transition={{ delay: 0.15 + i * 0.03, duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <span className="whitespace-nowrap text-[11px] font-semibold text-muted">{label}</span>
    </div>
  )
}
