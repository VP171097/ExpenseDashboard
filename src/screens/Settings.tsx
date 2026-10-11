import { ChevronRight, Compass, Database, FileSpreadsheet, Moon, Plus, RotateCcw, Sparkles, Sun, SunMoon, Trash2, Upload, Download } from 'lucide-react'
import { saveFile, workbook } from '../lib/files'
import { THIS_MONTH } from '../lib/dates'
import { useState } from 'react'
import { Button, Card, CardHead, CatIcon, Field, Segmented } from '../components/ui'
import { worthNow } from '../lib/calc'
import { CURRENCIES, money0 } from '../lib/money'
import { emptyState, sampleState, seedHistory } from '../lib/sample'
import { replaceData, toast, update, useData, useUI } from '../lib/store'
import type { Settings as S } from '../lib/types'

export default function Settings() {
  const s = useData()
  const open = useUI((u) => u.open)
  const go = useUI((u) => u.go)
  const [people, setPeople] = useState(s.people.join(', '))
  const set = (fn: (x: S) => void) => update((d) => fn(d.settings))
  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-5">
      <Card className="col-span-12 lg:col-span-6">
        <CardHead title="You" />
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
            options={[['system', <><SunMoon size={15} />Match device</>], ['light', <><Sun size={15} />Light</>], ['dark', <><Moon size={15} />Dark</>]]} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Week starts on"><select className="field" value={s.settings.weekStart} onChange={(e) => set((x) => { x.weekStart = +e.target.value })}>{[1, 0, 6].map((v) => <option key={v} value={v}>{new Date(2024, 0, 7 + v).toLocaleDateString(undefined, { weekday: 'long' })}</option>)}</select></Field>
          <Field label="How often you're paid" hint={<button type="button" className="font-semibold text-accent" onClick={() => go('paycheck')}>Open paycheck view</button>}>
            <select className="field" value={s.settings.payCycle} onChange={(e) => set((x) => { x.payCycle = e.target.value as S['payCycle'] })}><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="semimonthly">Twice a month</option><option value="monthly">Monthly</option><option value="custom">Custom</option></select>
          </Field>
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
        <CardHead title="Your data" sub="Everything stays in this browser on this device. Nothing is sent anywhere." />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={async () => { const r = await saveFile(`tally-${THIS_MONTH.slice(0, 4)}.xlsx`, workbook(s, +THIS_MONTH.slice(0, 4))); toast(r === 'saved' ? 'Your Excel workbook is ready' : r === 'declined' ? 'Download cancelled' : 'Could not save the file here') }}><FileSpreadsheet size={16} />Download Excel workbook</Button>
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
    </div>
  )
}
