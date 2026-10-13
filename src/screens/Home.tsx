import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Check, ChevronDown, Info, Lightbulb, PartyPopper } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Donut, MonthBars, Spark, TimeChart } from '../components/charts'
import { AllocationRing3D } from '../components/three'
import { ItemRow, Jar, statusOf } from '../components/bits'
import { Bar, Button, Card, CardHead, CatIcon, Chip, Empty, Explain, Num, Ring, Tilt } from '../components/ui'
import { currentTrip, health, monthItems, tripStats, yearStats, monthPicture, monthStats, planFor, spendCats, sum, tips, upcoming } from '../lib/calc'
import { addMonths, daysIn, fmtDate, monthName, pad, TODAY } from '../lib/dates'
import { money0, pct } from '../lib/money'
import { useData, useUI, type View } from '../lib/store'

const JAR_COLORS = ['var(--s3)', 'var(--s1)', 'var(--s7)', 'var(--s5)', 'var(--s4)']

export default function Home() {
  const s = useData()
  const { month: k, go, setFilter, setMonth, open } = useUI()
  const P = useMemo(() => monthPicture(s, k), [s, k])
  const m = P.m
  const prevK = addMonths(k, -1)
  const pm = monthStats(s, prevK)
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => addMonths(k, i - 11)), [k])
  const hist = useMemo(() => months.map((x) => monthStats(s, x)), [s, months])
  const H = health(s, k)
  const tipList = tips(s, k)
  const bills = P.isCur ? upcoming(s, 14) : []
  const yr = yearStats(s, +k.slice(0, 4))
  const monthItemsK = monthItems(s, k)

  // compare with the same point of last month when looking at the current month
  const upTo = (a: number[]) => sum(a.slice(1, (P.isCur ? P.elapsed : 99) + 1))
  const cmp = { income: upTo(pm.inDay), spent: upTo(pm.byDay), saved: upTo(pm.savedDay) }

  const segs = [
    { key: 'spent', label: 'Spent', v: m.spent, color: 'var(--s2)' },
    { key: 'bills', label: 'Bills still to pay', v: m.billsDue - m.savingDue, color: 'var(--s4)' },
    { key: 'saved', label: 'Put aside', v: m.saved + m.savingDue, color: 'var(--s3)' },
    { key: 'safe', label: 'Safe to spend', v: Math.max(0, P.safe), color: 'var(--hero-ink)' },
  ]
  const segTotal = Math.max(1, sum(segs.map((x) => Math.max(0, x.v))))

  const cats = spendCats(s)
    .map((c) => ({ c, spent: m.byCat[c.id] || 0, plan: planFor(s, c, k) }))
    .filter((x) => x.spent > 0 || x.plan > 0)
    .sort((a, b) => b.spent - a.spent)
  const [showAllCats, setShowAllCats] = useState(false)
  const [how, setHow] = useState(false)

  const dim = daysIn(k)
  const pace = useMemo(() => {
    let a = 0, b = 0
    return Array.from({ length: dim }, (_, i) => {
      a += m.byDay[i + 1] || 0
      b += pm.byDay[i + 1] || 0
      return { day: i + 1, now: i < P.elapsed ? Math.round(a) : null, last: Math.round(b), plan: Math.round((P.plan * (i + 1)) / dim) }
    })
  }, [m, pm, P.elapsed, P.plan, dim])

  const goTo = (v: string) => go(v as View)
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })()

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      {/* ---------- hero ---------- */}
      <Tilt className="col-span-12 xl:col-span-8" max={2.5}>
      <motion.section data-tour="safe" className="hero relative h-full overflow-hidden rounded-[28px] p-6 sm:p-8"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, var(--hero-ink), transparent 65%)' }} />
        <div className="relative grid items-center gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0">
        <p className="text-[15px]" style={{ color: 'var(--hero-muted)' }}>{greeting}{s.settings.name ? `, ${s.settings.name}` : ''}</p>
        <div className="mt-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--hero-muted)' }}>
          Safe to spend {P.isCur ? 'this month' : `in ${monthName(k, false)}`}
          <span className="normal-case tracking-normal [&_button]:text-[var(--hero-muted)] [&_button:hover]:bg-white/10">
            <Explain text="This is the money that is really free. It's what comes in this month, minus what you've already spent, what you've put aside, and the bills that still have to go out." />
          </span>
        </div>
        <div className={`mt-1 font-display text-[52px] font-extrabold leading-none tracking-tight sm:text-[68px] ${P.safe < 0 ? 'text-[#ffb4a8]' : ''}`}>
          <Num value={P.safe} />
        </div>
        <p className="mt-3 max-w-xl text-[16px]" style={{ color: 'var(--hero-ink)' }}>
          {P.safe < 0
            ? `Your plans for this month add up to ${money0(-P.safe)} more than is coming in. Try trimming the extras on your plan.`
            : P.isCur
              ? <>That's about <b>{money0(P.perDay)} a day</b> for the next {P.daysLeft} day{P.daysLeft === 1 ? '' : 's'}, after all your bills.</>
              : P.isFuture ? 'Based on the pay and bills you expect.' : `This is what was left over at the end of ${monthName(k)}.`}
        </p>
        <button type="button" onClick={() => setHow((v) => !v)} aria-expanded={how} className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold hover:bg-white/15" style={{ color: 'var(--hero-ink)' }}>
          How is this worked out? <motion.span animate={{ rotate: how ? 180 : 0 }}><ChevronDown size={14} /></motion.span>
        </button>
        <AnimatePresence initial={false}>
          {how && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <dl className="mt-3 max-w-md rounded-2xl bg-black/15 p-4 text-[14px] tnum">
                {([
                  ['Money coming in this month', P.moneyIn, `${money0(m.income)} arrived${m.expectedIn ? `, ${money0(m.expectedIn)} still expected` : ''}`],
                  ['Already spent', -m.spent, 'everything paid out so far, bills included'],
                  ['Put aside', -(m.saved + m.savingDue), `${money0(m.saved)} done${m.savingDue ? `, ${money0(m.savingDue)} planned` : ''}`],
                  ['Bills still to pay', -(m.billsDue - m.savingDue), `${m.nDue - (m.savingDue ? 1 : 0) > 0 ? 'regular bills not ticked off yet' : 'none left'}`],
                ] as [string, number, string][]).map(([l, v, sub]) => (
                  <div key={l} className="flex items-baseline justify-between gap-3 py-1">
                    <dt><span style={{ color: 'var(--hero-ink)' }}>{l}</span><span className="block text-[12px]" style={{ color: 'var(--hero-muted)' }}>{sub}</span></dt>
                    <dd className="font-bold" style={{ color: 'var(--hero-ink)' }}>{v < 0 ? '−' : '+'}{money0(Math.abs(v))}</dd>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t border-white/20 pt-2 font-bold" style={{ color: 'var(--hero-ink)' }}><dt>Safe to spend</dt><dd>{money0(P.safe)}</dd></div>
              </dl>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        <AllocationRing3D className="mx-auto hidden aspect-square w-full max-w-[260px] md:block"
          segs={segs.map((x) => ({ value: Math.max(0, x.v), color: x.color, label: x.label }))}
          fallback={<div className="grid h-full place-items-center"><Donut size={220} center={money0(P.safe)} sub="safe to spend" items={segs.filter((x) => x.v > 0).map((x) => ({ name: x.label, value: Math.round(x.v), color: x.color }))} /></div>} />
        </div>
        <div className="mt-6">
          <div className="sheen relative flex h-4 overflow-hidden rounded-full bg-white/10" role="img" aria-label="How this month's money is split">
            {segs.filter((x) => x.v > 0).map((x, i) => (
              <motion.span key={x.key} className="h-full" style={{ background: x.color, marginLeft: i ? 3 : 0 }}
                initial={{ width: 0 }} animate={{ width: `${(x.v / segTotal) * 100}%` }} transition={{ duration: 1, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px]">
            <span style={{ color: 'var(--hero-muted)' }}>Coming in: <b style={{ color: 'var(--hero-ink)' }}>{money0(P.moneyIn)}</b></span>
            {segs.map((x) => (
              <span key={x.key} className="inline-flex items-center gap-1.5" style={{ color: 'var(--hero-muted)' }}>
                <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: x.color }} />{x.label} <b style={{ color: 'var(--hero-ink)' }}>{money0(Math.max(0, x.v))}</b>
              </span>
            ))}
          </div>
        </div>
      </motion.section>
      </Tilt>

      {/* ---------- a trip happening now or soon ---------- */}
      <TripBanner />

      {/* ---------- money health ---------- */}
      <Card i={1} tour="health" className="col-span-12 md:col-span-6 xl:col-span-4">
        <CardHead title="Money health" help="A simple score out of 100 based on four habits: staying within your plan, saving regularly, paying bills on time and keeping a safety cushion." />
        <div className="flex items-center gap-4">
          <Ring value={H.score / 100} size={104} stroke={11} color={`var(--${H.tone})`}>
            <div><div className="font-display text-[30px] font-extrabold leading-none"><Num value={H.score} format={(v) => String(Math.round(v))} /></div><div className="text-[11px] text-muted">out of 100</div></div>
          </Ring>
          <div>
            <p className="font-display text-[22px] font-bold leading-tight">{H.label}</p>
            <p className="mt-1 text-[13.5px] text-ink2">Tap a line below to see why.</p>
          </div>
        </div>
        <ul className="mt-4 flex flex-col gap-1">
          {H.checks.map((c) => <CheckRow key={c.title} c={c} />)}
        </ul>
      </Card>

      {/* ---------- three simple numbers ---------- */}
      {[
        { key: 'in', label: 'Money in', v: m.income, prev: cmp.income, spark: hist.map((h) => h.income), color: 'var(--s1)', upGood: true, extra: m.expectedIn ? `${money0(m.expectedIn)} more on the way` : undefined, help: 'Pay and any other money that arrived in your accounts this month.' },
        { key: 'out', label: 'Money out', v: m.spent, prev: cmp.spent, spark: hist.map((h) => h.spent), color: 'var(--s2)', upGood: false, extra: P.plan ? `${Math.round((m.spent / P.plan) * 100)}% of your ${money0(P.plan)} plan` : undefined, help: 'Everything you spent this month, including bills that have been paid.' },
        { key: 'aside', label: 'Put aside', v: m.saved, prev: cmp.saved, spark: hist.map((h) => h.saved), color: 'var(--s3)', upGood: true, extra: m.savingDue ? `${money0(m.savingDue)} more planned` : undefined, help: 'Money moved to savings or investments. This is money for future you, so it is not counted as spending.' },
      ].map((x, i) => {
        const d = x.v - x.prev
        const good = x.upGood ? d >= 0 : d <= 0
        return (
          <Card key={x.key} i={2 + i} className="col-span-12 flex flex-col sm:col-span-4 md:col-span-6 xl:col-span-4">
            <div className="flex items-center justify-between gap-2"><span className="label flex items-center gap-1">{x.label}<Explain text={x.help} /></span>
              {x.prev > 0 && Math.abs(d) >= 1 && <Chip tone={good ? 'good' : 'bad'}>{money0(Math.abs(d))} {d > 0 ? 'more' : 'less'}</Chip>}</div>
            <div className="mt-1 font-display text-[34px] font-bold leading-tight"><Num value={x.v} /></div>
            <p className="text-[13.5px] text-ink2">{x.extra ?? (x.prev > 0 ? `than at this point last month` : ' ')}</p>
            <div className="mt-auto pt-2"><Spark values={x.spark} color={x.color} /></div>
          </Card>
        )
      })}

      {/* ---------- pace ---------- */}
      <Card i={5} className="col-span-12 flex flex-col xl:col-span-8">
        <CardHead title="How your spending is going" sub="Keep the orange line under the dashed plan line and you're fine."
          right={P.plan > 0 && !P.isFuture ? (
            <Chip tone={P.forecast > P.plan * 1.02 ? 'bad' : P.forecast > P.plan * 0.92 ? 'warn' : 'good'}>
              {P.forecast > P.plan * 1.02 ? <AlertTriangle size={13} /> : <Check size={13} />}
              {P.isCur ? `Heading for ${money0(P.forecast)}` : `Ended at ${money0(P.forecast)}`}
            </Chip>) : undefined} />
        <div className="min-h-[250px] flex-1"><TimeChart data={pace} x="day" height="100%" title={(l) => fmtDate(`${k}-${pad(+l)}`, { weekday: 'long', day: 'numeric', month: 'long' })}
          xTicks={[1, 5, 10, 15, 20, 25, dim]}
          series={[
            { key: 'plan', name: 'Your plan', color: 'var(--muted)', dashed: true },
            { key: 'last', name: `${monthName(prevK, false)} (last month)`, color: 'var(--sother)', dashed: true },
            { key: 'now', name: 'Spent so far', color: 'var(--s2)', area: true },
          ]} /></div>
        <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-ink2">
          <span className="inline-flex items-center gap-2"><i className="h-[3px] w-4 rounded" style={{ background: 'var(--s2)' }} />This month</span>
          <span className="inline-flex items-center gap-2"><i className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--muted)' }} />Your plan</span>
          <span className="inline-flex items-center gap-2"><i className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--sother)' }} />Last month</span>
        </div>
      </Card>

      {/* ---------- categories ---------- */}
      <Card i={6} className="col-span-12 md:col-span-6 xl:col-span-4">
        <CardHead title="Where your money went" sub="Tap one to see every payment" />
        {cats.filter((x) => x.spent > 0).length === 0 ? (
          <Empty title="Nothing spent yet" text="When you add spending, you'll see where it goes here." action={<Button variant="primary" onClick={() => open({ type: 'quick' })}>Add spending</Button>} />
        ) : (
          <div className="flex flex-col gap-1">
            {(showAllCats ? cats : cats.slice(0, 6)).map(({ c, spent, plan }) => {
              const st = statusOf(spent, plan)
              return (
                <button key={c.id} type="button" onClick={() => { setFilter({ cat: c.id, type: '', q: '' }); go('activity') }}
                  className="flex items-center gap-3 rounded-2xl px-1.5 py-2 text-left transition-colors hover:bg-surface2">
                  <CatIcon cat={c} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2"><span className="truncate font-semibold">{c.name}</span><b className="tnum">{money0(spent)}</b></span>
                    <span className="mt-1.5 block"><Bar value={plan ? spent / plan : spent ? 1 : 0} color={st.color} height={7} label={`${c.name} ${st.word}`} /></span>
                    <span className="mt-1 block text-[12px] text-muted">{plan ? `${st.word} · plan ${money0(plan)}` : 'No plan set'}</span>
                  </span>
                </button>
              )
            })}
            {cats.length > 6 && <Button variant="ghost" size="sm" onClick={() => setShowAllCats((v) => !v)} className="mt-1 self-start">{showAllCats ? 'Show less' : `Show all ${cats.length}`}</Button>}
          </div>
        )}
      </Card>

      {/* ---------- bills ---------- */}
      <Card i={7} tour="bills" className="col-span-12 md:col-span-6 xl:col-span-4">
        <CardHead title="Bills coming up" sub="Next two weeks. Tick them off once paid." right={bills.length ? <Chip tone="accent">{money0(sum(bills.map((b) => b.amount)))}</Chip> : undefined} />
        {bills.length ? (
          <div className="-mx-2 flex flex-col">
            <AnimatePresence initial={false}>{bills.slice(0, 6).map((b) => <ItemRow key={b.id} item={b} showDate />)}</AnimatePresence>
          </div>
        ) : <Empty icon={<PartyPopper />} title={P.isCur ? 'All clear' : 'Only shown for this month'} text={P.isCur ? 'No bills are due in the next two weeks.' : 'Switch back to this month to see upcoming bills.'} />}
        <Button variant="plain" onClick={() => go('bills')} className="mt-2">All bills <ArrowRight size={15} /></Button>
      </Card>

      {/* ---------- tips ---------- */}
      <Card i={8} className="col-span-12 md:col-span-6 xl:col-span-4">
        <CardHead title="Tips for you" sub="Based on your own numbers" right={<span className="grid h-9 w-9 place-items-center rounded-xl bg-warn-soft text-warn"><Lightbulb size={18} /></span>} />
        {tipList.length ? (
          <ul className="flex flex-col gap-3">
            {tipList.map((t, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
                className="rounded-2xl border border-line bg-surface2 p-3.5">
                <div className="flex gap-2.5">
                  <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ${t.tone === 'good' ? 'bg-good-soft text-good' : t.tone === 'bad' ? 'bg-bad-soft text-bad' : t.tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent'}`}>
                    {t.tone === 'good' ? <Check size={14} /> : t.tone === 'info' ? <Info size={14} /> : <AlertTriangle size={14} />}
                  </span>
                  <div className="text-[14px] leading-relaxed">{t.text}{t.action && <><br /><Button variant="plain" size="sm" onClick={() => goTo(t.action!.view)}>{t.action.label} <ArrowRight size={14} /></Button></>}</div>
                </div>
              </motion.li>
            ))}
          </ul>
        ) : <Empty title="No tips right now" text="Add a few weeks of spending and tips will appear here." />}
      </Card>

      {/* ---------- goals ---------- */}
      <Card i={9} className="col-span-12 md:col-span-6 xl:col-span-4">
        <CardHead title="Saving up for" right={<Button variant="plain" onClick={() => go('goals')}>All goals <ArrowRight size={15} /></Button>} />
        {s.goals.length ? (
          <div className="grid grid-cols-3 gap-2">
            {s.goals.slice(0, 3).map((g, i) => (
              <button key={g.id} type="button" onClick={() => go('goals')} className="flex flex-col items-center gap-1 rounded-2xl p-2 text-center transition-colors hover:bg-surface2">
                <Jar value={g.saved / g.target} color={JAR_COLORS[i % JAR_COLORS.length]} size={64} />
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight">{g.name}</span>
                <span className="text-[12px] text-muted">{Math.round((g.saved / g.target) * 100)}%</span>
              </button>
            ))}
          </div>
        ) : <Empty title="No goals yet" text="Saving for a trip, a car or a rainy day? Give it a jar." action={<Button variant="primary" onClick={() => open({ type: 'goal' })}>Start a goal</Button>} />}
      </Card>

      {/* ---------- this month at a glance + year so far ---------- */}
      <Card i={10} className="col-span-12 xl:col-span-8">
        <CardHead title="This month at a glance" sub="Each square is a day. Darker means more spent." right={<Button variant="plain" onClick={() => go('calendar')}>Open calendar <ArrowRight size={15} /></Button>} />
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(16,minmax(0,1fr))]">
          {Array.from({ length: dim }, (_, i) => {
            const d = i + 1, sp = m.byDay[d], mx = Math.max(1, ...m.byDay), ds = `${k}-${pad(d)}`
            const bill = monthItemsK.some((t) => t.virtual && t.date === ds && t.type !== 'income')
            return (
              <button key={d} type="button" onClick={() => go('calendar')} title={`${fmtDate(ds)}: ${money0(sp)}`}
                className={`relative grid aspect-square place-items-center rounded-lg text-[11.5px] font-bold ${ds === TODAY ? 'ring-2 ring-accent' : ''}`}
                style={{ background: sp ? `color-mix(in srgb, var(--s2) ${Math.round(8 + (sp / mx) * 55)}%, var(--surface))` : 'var(--surface2)', color: ds > TODAY ? 'var(--muted)' : 'var(--ink)' }}>
                {d}{bill && <i className="absolute bottom-1 h-1 w-1 rounded-full bg-s4" />}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[12.5px] text-muted">A small yellow dot marks a bill day.</p>
      </Card>
      <Card i={11} className="col-span-12 md:col-span-6 xl:col-span-4">
        <CardHead title={`${k.slice(0, 4)} so far`} right={<Button variant="plain" onClick={() => go('year')}>My year <ArrowRight size={15} /></Button>} />
        <div className="grid grid-cols-2 gap-3">
          {[['Money in', yr.income, 'text-good'], ['Money out', yr.spent, ''], ['Put aside', yr.saved, 'text-accent'], ['Left over', yr.income - yr.spent - yr.saved, yr.income - yr.spent - yr.saved < 0 ? 'text-bad' : '']].map(([l, v, c]) => (
            <div key={l as string} className="rounded-2xl bg-surface2 p-3"><p className="text-[12.5px] text-muted">{l}</p><p className={`font-display text-[20px] font-bold ${c}`}><Num value={v as number} /></p></div>
          ))}
        </div>
        <p className="mt-3 text-[13.5px] text-ink2">You've put aside <b className="text-ink">{pct(yr.income ? yr.saved / yr.income : 0)}</b> of everything that came in this year.</p>
      </Card>

      {/* ---------- month by month ---------- */}
      <Card i={12} className="col-span-12">
        <CardHead title="Month by month" sub="Tap a month to look at it in detail" right={
          <div className="flex flex-wrap gap-4 text-[13px] text-ink2">
            {[['Money in', 'var(--s1)'], ['Money out', 'var(--s2)'], ['Put aside', 'var(--s3)']].map(([l, c]) => <span key={l} className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />{l}</span>)}
          </div>} />
        <MonthBars data={months.map((x, i) => ({ label: monthName(x, false), in: Math.round(hist[i].income), out: Math.round(hist[i].spent), aside: Math.round(hist[i].saved) }))}
          series={[{ key: 'in', name: 'Money in', color: 'var(--s1)' }, { key: 'out', name: 'Money out', color: 'var(--s2)' }, { key: 'aside', name: 'Put aside', color: 'var(--s3)' }]}
          selected={11} onSelect={(i) => setMonth(months[i])} title={(l) => String(l)} height={250} />
      </Card>
    </div>
  )
}

function TripBanner() {
  const s = useData()
  const { go, open } = useUI()
  const t = currentTrip(s)
  if (!t) return null
  const st = tripStats(s, t)
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card col-span-12 flex flex-wrap items-center gap-3 p-4" aria-label="Current trip">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-[26px]" aria-hidden>{t.icon}</span>
      <div className="min-w-[180px] flex-1">
        <p className="font-bold">{st.phase === 'on' ? `You're on ${t.name}` : `${t.name} is coming up`} <span className="font-normal text-ink2">· {st.phase === 'on' ? `day ${st.dayNo} of ${st.days}` : `starts ${fmtDate(t.start, { weekday: 'short', day: 'numeric', month: 'short' })}`}</span></p>
        <p className="text-[14px] text-ink2">Spent <b className="tnum text-ink">{money0(st.net)}</b>{t.budget > 0 ? <> of {money0(t.budget)}{st.left > 0 && st.perDayLeft > 0 ? <> · about <b className="tnum text-ink">{money0(st.perDayLeft)}</b> a day left</> : st.left <= 0 ? <> · <b className="text-bad">over budget</b></> : null}</> : null}</p>
      </div>
      {t.budget > 0 && <div className="hidden w-40 sm:block"><Bar value={Math.min(1, st.used)} height={8} color={st.used > 1 ? 'var(--bad)' : st.used > 0.85 ? 'var(--warn)' : 'var(--good)'} label={`${t.name} budget used`} /></div>}
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={() => open({ type: 'quick', kind: 'expense', trip: t.id })}>Add trip expense</Button>
        <Button size="sm" variant="plain" onClick={() => go('trips')}>Open <ArrowRight size={14} /></Button>
      </div>
    </motion.section>
  )
}
function CheckRow({ c }: { c: { ok: boolean | 'half'; title: string; detail: string } }) {
  const [open, setOpen] = useState(false)
  const tone = c.ok === true ? 'good' : c.ok === 'half' ? 'warn' : 'bad'
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-2 text-left text-[14px] transition-colors hover:bg-surface2">
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-${tone}-soft text-${tone}`}>{c.ok === true ? <Check size={14} /> : <AlertTriangle size={13} />}</span>
        <span className="flex-1 font-medium">{c.title}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-muted"><ChevronDown size={16} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-10 pr-2 text-[13.5px] leading-relaxed text-ink2">
            <span className="block pb-2">{c.detail}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </li>
  )
}

