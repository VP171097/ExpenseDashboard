import { ChevronLeft, ChevronRight, FileSpreadsheet, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MonthBars, TimeChart } from '../components/charts'
import { Button, Card, CardHead, CatIcon, Chip, Num } from '../components/ui'
import { catOf, spendCats, totalPlan, yearStats } from '../lib/calc'
import { daysIn, monthName, NOW, pad, THIS_MONTH, TODAY } from '../lib/dates'
import { workbook, saveFile } from '../lib/files'
import { money0, pct } from '../lib/money'
import { toast, update, useData, useUI } from '../lib/store'

export default function Year() {
  const s = useData()
  const { setMonth, go } = useUI()
  const [year, setYear] = useState(+THIS_MONTH.slice(0, 4))
  const y = yearStats(s, year)
  const active = y.months.filter((k) => k <= THIS_MONTH)
  const nActive = Math.max(1, active.length)
  const left = y.income - y.spent - y.saved
  const cats = spendCats(s).filter((c) => (y.byCat[c.id] || 0) > 0 || c.plan > 0).sort((a, b) => (y.byCat[b.id] || 0) - (y.byCat[a.id] || 0))

  const cumulative = useMemo(() => { let c = 0; return y.months.map((k, i) => ({ label: monthName(k, false), saved: k <= THIS_MONTH ? Math.round((c += y.ms[i].saved)) : null })) }, [y])

  const facts = useMemo(() => {
    const done = y.months.map((k, i) => ({ k, m: y.ms[i] })).filter((x) => x.k <= THIS_MONTH && (x.m.income || x.m.spent))
    if (!done.length) return []
    const best = [...done].sort((a, b) => (b.m.income - b.m.spent - b.m.saved) - (a.m.income - a.m.spent - a.m.saved))[0]
    const tough = [...done].sort((a, b) => b.m.spent - a.m.spent)[0]
    const top = cats[0]
    let noSpend = 0
    done.forEach(({ k, m }) => { const last = k === THIS_MONTH ? NOW.getDate() : daysIn(k); for (let d = 1; d <= last; d++) if (`${k}-${pad(d)}` <= TODAY && !m.extrasDay[d]) noSpend++ })
    return [
      `You put aside ${money0(y.saved)}, which is ${pct(y.income ? y.saved / y.income : 0)} of everything that came in.`,
      `Your best month was ${monthName(best.k)}, with ${money0(best.m.income - best.m.spent - best.m.saved)} left over.`,
      `You spent the most in ${monthName(tough.k)} (${money0(tough.m.spent)}).`,
      top ? `${top.name} was your biggest cost at ${money0(y.byCat[top.id] || 0)}, about ${money0((y.byCat[top.id] || 0) / nActive)} a month.` : '',
      `You had ${noSpend} days with no spending on extras.`,
      s.goals.filter((g) => g.saved >= g.target).length ? `You fully saved for ${s.goals.filter((g) => g.saved >= g.target).map((g) => g.name).join(', ')}.` : '',
    ].filter(Boolean)
  }, [y, cats, nActive, s.goals])

  const [notes, setNotes] = useState(s.reflections[year] ?? '')
  useEffect(() => setNotes(s.reflections[year] ?? ''), [year, s.reflections])
  useEffect(() => {
    if (notes === (s.reflections[year] ?? '')) return
    const t = setTimeout(() => update((d) => { d.reflections[year] = notes }), 500)
    return () => clearTimeout(t)
  }, [notes, year, s.reflections])

  const exportXlsx = async () => {
    const r = await saveFile(`tally-${year}.xlsx`, workbook(s, year))
    toast(r === 'saved' ? 'Your Excel workbook is ready' : r === 'declined' ? 'Download cancelled' : 'Could not save the file here')
  }

  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <div className="col-span-12 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-2xl border border-line bg-surface p-1 shadow-card">
          <button type="button" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-surface2" onClick={() => setYear((v) => v - 1)} aria-label="Previous year"><ChevronLeft size={18} /></button>
          <span className="min-w-[70px] text-center font-display text-[20px] font-bold">{year}</span>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-surface2" onClick={() => setYear((v) => v + 1)} aria-label="Next year"><ChevronRight size={18} /></button>
        </div>
        <p className="text-[14px] text-ink2">Your plan works for any year. Start in any month and come back next year.</p>
        <Button className="ml-auto" onClick={exportXlsx}><FileSpreadsheet size={16} />Download Excel workbook</Button>
      </div>

      {[
        ['Money in', y.income, 'text-ink'], ['Money out', y.spent, 'text-ink'], ['Put aside', y.saved, 'text-ink'], ['Left over', left, left < 0 ? 'text-bad' : 'text-good'],
      ].map(([l, v, c], i) => (
        <Card key={l as string} i={i} className="col-span-6 lg:col-span-3">
          <p className="label">{l}</p><p className={`font-display text-[30px] font-bold ${c}`}><Num value={v as number} /></p>
          <p className="text-[13px] text-ink2">about {money0((v as number) / nActive)} a month</p>
        </Card>
      ))}

      <Card i={4} className="col-span-12 xl:col-span-8">
        <CardHead title="Every month of the year" sub="Tap a month to open it on the Home page" />
        <MonthBars data={y.months.map((k, i) => ({ label: monthName(k, false), in: Math.round(y.ms[i].income), out: Math.round(y.ms[i].spent), aside: Math.round(y.ms[i].saved) }))}
          series={[{ key: 'in', name: 'Money in', color: 'var(--s1)' }, { key: 'out', name: 'Money out', color: 'var(--s2)' }, { key: 'aside', name: 'Put aside', color: 'var(--s3)' }]}
          onSelect={(i) => { setMonth(y.months[i]); go('home') }} height={260} />
      </Card>
      <Card i={5} className="col-span-12 xl:col-span-4">
        <CardHead title="Savings over the year" sub="Everything put aside, added up" />
        <TimeChart data={cumulative} x="label" height={260} series={[{ key: 'saved', name: 'Put aside so far', color: 'var(--s3)', area: true }]} />
      </Card>

      <Card i={6} className="col-span-12">
        <CardHead title="Month by month" sub="The whole year at a glance" />
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead><tr className="label text-left">{['Month', 'Money in', 'Money out', 'Put aside', 'Left over', 'Against plan'].map((h, i) => <th key={h} className={`border-b border-line px-2 py-2 font-bold ${i ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody>
              {y.months.map((k, i) => {
                const m = y.ms[i], lo = m.income - m.spent - m.saved, plan = totalPlan(s, k), future = k > THIS_MONTH
                return (
                  <tr key={k} className={`cursor-pointer hover:bg-surface2 ${future ? 'opacity-50' : ''}`} onClick={() => { setMonth(k); go('home') }}>
                    <td className="border-b border-line px-2 py-2 font-semibold">{monthName(k)}</td>
                    <td className="tnum border-b border-line px-2 py-2 text-right">{money0(m.income)}</td>
                    <td className="tnum border-b border-line px-2 py-2 text-right">{money0(m.spent)}</td>
                    <td className="tnum border-b border-line px-2 py-2 text-right">{money0(m.saved)}</td>
                    <td className={`tnum border-b border-line px-2 py-2 text-right font-bold ${lo < 0 ? 'text-bad' : ''}`}>{money0(lo)}</td>
                    <td className="border-b border-line px-2 py-2 text-right">{future || !m.spent ? <span className="text-muted">—</span> : k === THIS_MONTH ? <Chip>In progress</Chip> : <Chip tone={m.spent <= plan ? 'good' : 'bad'}>{m.spent <= plan ? `${money0(plan - m.spent)} under` : `${money0(m.spent - plan)} over`}</Chip>}</td>
                  </tr>
                )
              })}
              <tr className="font-bold"><td className="px-2 py-2.5">Total</td><td className="tnum px-2 text-right">{money0(y.income)}</td><td className="tnum px-2 text-right">{money0(y.spent)}</td><td className="tnum px-2 text-right">{money0(y.saved)}</td><td className="tnum px-2 text-right">{money0(left)}</td><td /></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card i={7} className="col-span-12">
        <CardHead title="Spending by category" sub="Darker squares mean more was spent that month" />
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead><tr className="label">{['Category', ...y.months.map((k) => monthName(k, false)), 'Year', 'Per month'].map((h, i) => <th key={h} className={`px-1 py-2 font-bold ${i ? 'text-center' : 'text-left'}`}>{h}</th>)}</tr></thead>
            <tbody>
              {cats.map((c) => {
                const row = y.ms.map((m) => m.byCat[c.id] || 0), mx = Math.max(1, ...row, c.plan)
                return (
                  <tr key={c.id}>
                    <td className="py-1 pr-2"><span className="flex items-center gap-2 font-semibold"><CatIcon cat={catOf(s, c.id)} size={26} />{c.name}</span></td>
                    {row.map((v, i) => (
                      <td key={i} className="p-0.5"><div className="tnum grid h-8 place-items-center rounded-lg text-[11.5px]" title={`${c.name}, ${monthName(y.months[i])}: ${money0(v)}`}
                        style={{ background: v ? `color-mix(in srgb, ${c.plan && v > c.plan ? 'var(--bad)' : 'var(--s1)'} ${Math.round(10 + (v / mx) * 45)}%, var(--surface))` : 'var(--surface2)' }}>{v ? money0(v) : ''}</div></td>
                    ))}
                    <td className="tnum px-2 text-center font-bold">{money0(y.byCat[c.id] || 0)}</td>
                    <td className="tnum px-2 text-center text-ink2">{money0((y.byCat[c.id] || 0) / nActive)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12.5px] text-muted">Red squares went over that month's plan.</p>
      </Card>

      <Card i={8} className="col-span-12">
        <CardHead title={`Looking back on ${year}`} sub="A few facts from your year, and space for your own thoughts" right={<span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent"><Sparkles size={18} /></span>} />
        <div className="grid gap-5 lg:grid-cols-2">
          <ul className="flex flex-col gap-2.5">{facts.length ? facts.map((f) => <li key={f} className="rounded-2xl bg-surface2 p-3 text-[14.5px] leading-relaxed">{f}</li>) : <li className="text-ink2">Nothing recorded for this year yet.</li>}</ul>
          <label className="flex flex-col gap-2 text-[14px] font-semibold text-ink2">What went well? What would you change next year?
            <textarea className="field min-h-[180px] text-[15px] font-normal text-ink" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Eating out crept up in summer. Next year: set a trips goal in January." />
          </label>
        </div>
      </Card>
    </div>
  )
}

