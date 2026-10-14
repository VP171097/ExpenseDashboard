import { ChevronRight, Compass, Database, Eraser, FileSpreadsheet, FileText, Moon, Plus, RotateCcw, ShieldCheck, Sparkles, Sun, SunMoon, Trash2, Upload, Download } from 'lucide-react'
import { saveFile, workbook } from '../lib/files'
import { addMonthsDate, fmtDate, iso, monthName, NOW, paydaysBetween, THIS_MONTH, TODAY, WEEKDAYS } from '../lib/dates'
import { useLegal } from '../lib/entry'
import { useEffect, useState } from 'react'
import { storageEstimate } from '../lib/storage'
import { Button, Card, CardHead, CatIcon, Field, Segmented, Switch } from '../components/ui'
import { changePayday, monthItems, ruleKey, worthNow } from '../lib/calc'
import { CURRENCIES, money0 } from '../lib/money'
import { emptyState, sampleState, seedHistory } from '../lib/sample'
import { replaceData, toast, update, useData, useUI } from '../lib/store'
import type { Payday, Settings as S } from '../lib/types'
import { AccountCard, AiCard } from '../components/CloudSettings'
import { useAuth } from '../lib/cloud/auth'
import { useAi } from '../lib/ai/ask'

export default function Settings() {
  const s = useData()
  const [est, setEst] = useState<{ used: number; quota: number } | null>(null)
  useEffect(() => { storageEstimate().then(setEst) }, [s.tx.length])
  const open = useUI((u) => u.open)
  const go = useUI((u) => u.go)
  const [people, setPeople] = useState(s.people.join(', '))
  const set = (fn: (x: S) => void) => update((d) => fn(d.settings))
  const signedIn = useAuth((a) => a.status === 'signed-in')
  const aiOn = useAi((a) => a.enabled) && signedIn
  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <Card className="col-span-12 lg:col-span-6">
        <CardHead title="You & look" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your first name"><input className="field" value={s.settings.name} onChange={(e) => set((x) => { x.name = e.target.value })} placeholder="e.g. Sam" /></Field>
          <Field label="Currency"><select className="field" value={s.settings.currency} onChange={(e) => set((x) => { x.currency = e.target.value })}>{CURRENCIES.map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}</select></Field>
          <Field label="People sharing this budget" hint="Separate names with commas. Up to 6." className="sm:col-span-2">
            <input className="field" value={people} onChange={(e) => setPeople(e.target.value)}
              onBlur={() => { const p = [...new Set(people.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 6); if (p.length) { update((d) => { d.people = p }); setPeople(p.join(', ')) } }} />
          </Field>
        </div>
        <div className="mt-5">
          <p className="mb-2 text-[13.5px] font-semibold text-ink2">Look</p>
          <Segmented label="Theme" value={s.settings.theme} onChange={(v) => set((x) => { x.theme = v })}
            options={[['light', <><Sun size={15} />Light</>], ['dark', <><Moon size={15} />Dark</>], ['system', <><SunMoon size={15} />Match device</>]]} />
          <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-line p-4">
            <div><p className="font-semibold text-ink">Reduced effects</p><p className="text-[13.5px] text-ink2">Turns off 3D scenes, card tilt, floating coins and confetti. Numbers and actions stay the same. Tally also does this automatically if your device asks for less motion.</p></div>
            <Switch checked={s.settings.effects === 'reduced'} label="Reduced effects" onChange={(v) => set((x) => { x.effects = v ? 'reduced' : 'full' })} />
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Week starts on"><select className="field" value={s.settings.weekStart} onChange={(e) => set((x) => { x.weekStart = +e.target.value })}>{[1, 0, 6].map((v) => <option key={v} value={v}>{new Date(2024, 0, 7 + v).toLocaleDateString(undefined, { weekday: 'long' })}</option>)}</select></Field>
        </div>
        <div className="mt-5">
          <p className="mb-2 text-[13.5px] font-semibold text-ink2">Healthy balance aim (essentials / extras / future)</p>
          <div className="flex gap-2">
            {s.settings.ratios.map((r, i) => (
              <input key={i} className="field !w-24" type="number" min={0} max={100} value={r} aria-label={['Essentials', 'Extras', 'Future'][i] + ' percent'}
                onChange={(e) => set((x) => { x.ratios[i] = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })} />
            ))}
          </div>
          {s.settings.ratios.reduce((a, b) => a + b, 0) !== 100 && <p className="mt-1 text-[13px] text-warn">These add up to {s.settings.ratios.reduce((a, b) => a + b, 0)}%. They usually add up to 100%.</p>}
        </div>
      </Card>

      <PaydayCard />
      <ResetMonthCard />

      <Card i={1} className="col-span-12 lg:col-span-6">
        <CardHead title="Bank accounts" sub="Set what was in each account when you started" right={<Button size="sm" onClick={() => open({ type: 'account' })}><Plus size={15} />Add</Button>} />
        {s.accounts.map((a) => (
          <button key={a.id} type="button" onClick={() => open({ type: 'account', id: a.id })} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-surface2">
            <span className="flex-1"><span className="block font-semibold">{a.name}</span><span className="text-[12.5px] text-muted">Started with {money0(a.start)}</span></span><ChevronRight size={16} className="text-muted" />
          </button>
        ))}
      </Card>

      <Card i={2} className="col-span-12 lg:col-span-6">
        <CardHead title="Categories" sub="Rename them, change icons, or add your own" right={<Button size="sm" onClick={() => open({ type: 'category' })}><Plus size={15} />Add</Button>} />
        <div className="grid gap-1 sm:grid-cols-2">
          {s.categories.map((c) => (
            <button key={c.id} type="button" onClick={() => open({ type: 'category', id: c.id })} className="flex items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-surface2">
              <CatIcon cat={c} size={34} /><span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card i={3} className="col-span-12 lg:col-span-6">
        <CardHead title="Your data" sub={signedIn ? 'Saved in this browser and synced to your account.' : aiOn ? 'Saved in this browser. Ask Tally sends a summary only when you ask.' : 'Everything stays in this browser on this device. Nothing is sent anywhere.'} />
        <div className="mb-4 rounded-2xl bg-surface2 p-3.5 text-[13.5px] leading-relaxed text-ink2">
          <p>Tally keeps your data in this browser's own storage. It is <b className="text-ink">private but not encrypted</b>, and it can be lost if you clear your browsing data, use a private window, or lose this device. Download a full backup now and then.</p>
          <p className="mt-1.5 font-semibold text-ink">{s.settings.lastBackup ? `Last backup: ${new Date(s.settings.lastBackup).toLocaleDateString()}` : 'No backup downloaded yet.'}{est ? ` · Using ${(est.used / 1048576).toFixed(1)} MB of storage` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={async () => { const r = await saveFile(`tally-${THIS_MONTH.slice(0, 4)}.xlsx`, await workbook(s, +THIS_MONTH.slice(0, 4))); toast(r === 'saved' ? 'Your Excel workbook is ready' : r === 'declined' ? 'Download cancelled' : 'Could not save the file here') }}><FileSpreadsheet size={16} />Download Excel workbook</Button>
          <Button onClick={() => open({ type: 'backup' })}><Download size={16} />Back up or export</Button>
          <Button onClick={() => { go('home'); setTimeout(() => useUI.getState().setTour(true), 300) }}><Compass size={16} />Take the tour again</Button>
          <Button onClick={() => open({ type: 'csv' })}><Upload size={16} />Import from my bank</Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
          <Button onClick={() => open({ type: 'confirm', title: 'Load the example?', text: 'This replaces everything with the example household so you can explore. Back up first if you want to keep your own numbers.', label: 'Load example', run: () => { const x = sampleState(); seedHistory(x, worthNow(x)); replaceData(x); toast('Example data loaded') } })}><Sparkles size={16} />Load example data</Button>
          <Button onClick={() => open({ type: 'confirm', title: 'Run the setup again?', text: 'You will go through the short setup again. Your current data will be replaced when you finish.', label: 'Start setup', run: () => replaceData(null) })}><RotateCcw size={16} />Redo setup</Button>
          <Button variant="danger" onClick={() => open({ type: 'confirm', title: 'Erase everything?', text: 'All your activity, bills, goals and debts will be deleted from this device. This cannot be undone.', label: 'Erase', run: () => { replaceData(emptyState(s.settings.currency)); toast('Everything erased. Fresh start!') } })}><Trash2 size={16} />Erase all</Button>
        </div>
        <p className="mt-4 flex items-center gap-2 text-[12.5px] text-muted"><Database size={14} />{s.tx.length} entries · {s.rules.length} regular items · {s.goals.length} goals</p>
      </Card>
      <AccountCard />
      <AiCard />
      <Card i={4} className="col-span-12">
        <CardHead title="Legal" sub="How Tally handles your information, and the terms for using it" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => useLegal.getState().open('privacy')}><ShieldCheck size={16} />Privacy policy</Button>
          <Button onClick={() => useLegal.getState().open('terms')}><FileText size={16} />Terms & conditions</Button>
        </div>
      </Card>
    </div>
  )
}

/* ---------- payday and working days ---------- */
function PaydayCard() {
  const s = useData()
  const go = useUI((u) => u.go)
  const st = s.settings
  const p: Payday = st.payday ?? { rule: 'last', day: 1, shift: 'before' }
  const off = st.offDays ?? [0, 6]
  const monthly = st.payCycle === 'monthly'
  const setP = (patch: Partial<Payday>) => update((d) => changePayday(d, { payday: { ...p, ...patch } }))
  const toggleOff = (day: number) => update((d) => changePayday(d, { offDays: off.includes(day) ? off.filter((x) => x !== day) : [...off, day].sort() }))
  const pays = s.rules.filter((r) => r.type === 'income' && r.freq === 'monthly')
  const upcomingPaydays = monthly ? paydaysBetween(TODAY, iso(addMonthsDate(NOW, 3)), p, off).slice(0, 3) : []
  const days = [...WEEKDAYS.slice(st.weekStart), ...WEEKDAYS.slice(0, st.weekStart)]
  return (
    <Card i={1} className="col-span-12 lg:col-span-6">
      <CardHead title="Payday & working days" sub="When your salary arrives. Pay periods and the calendar follow it." />
      <div className="flex flex-col gap-5">
        <Field label="How often you're paid" hint={<button type="button" className="font-semibold text-accent" onClick={() => go('paycheck')}>Open paycheck view</button>}>
          <select className="field" value={st.payCycle} onChange={(e) => update((d) => changePayday(d, { payCycle: e.target.value as S['payCycle'] }))}><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="semimonthly">Twice a month</option><option value="custom">Custom</option></select>
        </Field>
        {monthly ? (
          <>
            <div>
              <p className="mb-2 text-[13.5px] font-semibold text-ink2">When does your salary come in?</p>
              <Segmented label="Payday" value={p.rule} onChange={(v) => setP({ rule: v })} options={[['last', 'Last working day'], ['first', 'First working day'], ['date', 'A specific date']]} />
            </div>
            {p.rule === 'date' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Day of the month" hint={p.day > 28 ? 'In shorter months it comes on the last day of the month.' : undefined}><input className="field" type="number" min={1} max={31} value={p.day} onChange={(e) => setP({ day: Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) })} /></Field>
                <Field label="If that's a day off"><select className="field" value={p.shift} onChange={(e) => setP({ shift: e.target.value as Payday['shift'] })}><option value="before">Paid the working day before</option><option value="after">Paid the working day after</option></select></Field>
              </div>
            )}
          </>
        ) : <p className="rounded-2xl bg-surface2 p-3 text-[13.5px] text-ink2">For pay that isn't monthly, set a recent payday on the Paycheck page. Working days below still mark days off on your calendar.</p>}
        <div>
          <p className="mb-2 text-[13.5px] font-semibold text-ink2">Which days don't you work?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Days off">
            {days.map((w) => {
              const on = off.includes(w.d)
              return <button key={w.d} type="button" aria-pressed={on} onClick={() => toggleOff(w.d)} title={w.long} className={`min-w-[52px] rounded-xl border-2 px-3 py-2 text-[13.5px] font-semibold transition-colors ${on ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink2 hover:border-line2'}`}>{w.short}</button>
            })}
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">{off.length ? `Days off: ${off.map((d) => WEEKDAYS[d].long).join(', ')}.` : 'You work every day of the week.'}</p>
        </div>
        {monthly && (
          <>
            <div className="rounded-2xl bg-accent-soft p-3.5 text-[14px]">
              <p className="font-semibold">Your next paydays</p>
              <p className="mt-1">{upcomingPaydays.map((d) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })).join(' · ')}</p>
            </div>
            {pays.length > 0 && (
              <div>
                <p className="mb-1 text-[13.5px] font-semibold text-ink2">Which regular money in lands on payday?</p>
                {pays.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                    <span><span className="block font-semibold">{r.name}</span><span className="text-[12.5px] text-muted">{money0(r.amount)} a month{r.payday ? ' · on payday' : ` · on day ${+r.start.slice(8)}`}</span></span>
                    <Switch checked={!!r.payday} label={`${r.name} lands on payday`} onChange={(v) => update((d) => changePayday(d, { payday: p }, { [r.id]: v }))} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

/* ---------- reset one month ---------- */
function ResetMonthCard() {
  const s = useData()
  const open = useUI((u) => u.open)
  const [k, setK] = useState(THIS_MONTH)
  const valid = /^\d{4}-\d{2}$/.test(k)
  const items = valid ? monthItems(s, k) : []
  const regular = items.filter((t) => t.virtual)
  const oneOff = items.length - regular.length
  const moves = valid ? (s.transfers ?? []).filter((t) => t.date.startsWith(k)).length : 0
  const total = items.length + moves
  const reset = () => open({
    type: 'confirm', title: `Reset ${monthName(k)} to zero?`, label: 'Reset month',
    text: `This removes ${oneOff} entr${oneOff === 1 ? 'y' : 'ies'} and ${moves} transfer${moves === 1 ? '' : 's'} from ${monthName(k)} and skips ${regular.length} regular payment${regular.length === 1 ? '' : 's'} that month, so its totals start from zero. Account balances change to match. Other months are not touched. You can undo straight after; download a backup first if you might want them later.`,
    run: () => {
      const prev = update((d) => {
        d.tx = d.tx.filter((t) => !t.date.startsWith(k))
        d.transfers = (d.transfers ?? []).filter((t) => !t.date.startsWith(k))
        for (const t of regular) d.skip[ruleKey(t.ruleId!, t.occ!)] = true
      })
      toast(`${monthName(k)} reset to zero`, prev)
    },
  })
  return (
    <Card i={2} className="col-span-12 lg:col-span-6">
      <CardHead title="Reset a month to zero" sub="Start a month again from a clean slate" />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Month"><input className="field" type="month" value={k} onChange={(e) => setK(e.target.value)} /></Field>
        <Button variant="danger" disabled={!valid || !total} onClick={reset}><Eraser size={16} />Reset to zero</Button>
      </div>
      <p className="mt-3 text-[13.5px] text-ink2">{!valid ? 'Pick a month.' : total ? `${monthName(k)} has ${oneOff} entr${oneOff === 1 ? 'y' : 'ies'}, ${regular.length} regular payment${regular.length === 1 ? '' : 's'} and ${moves} transfer${moves === 1 ? '' : 's'}.` : `${monthName(k)} is already empty.`} Regular bills and pay carry on as normal in other months.</p>
    </Card>
  )
}
