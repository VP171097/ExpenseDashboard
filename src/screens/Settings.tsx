import { ChevronRight, Database, Moon, Plus, RotateCcw, Sparkles, Sun, SunMoon, Trash2, Upload, Download } from 'lucide-react'
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
          <Button onClick={() => open({ type: 'backup' })}><Download size={16} />Back up or export</Button>
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
