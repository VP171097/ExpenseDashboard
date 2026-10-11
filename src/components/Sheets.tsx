import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, CalendarClock, ChevronDown, Copy, Delete, Download, Goal, HelpCircle, Landmark, Scale, Settings as Cog, Trash2, Upload,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { catOf, FREQ, monthsUntil, uid } from '../lib/calc'
import { addDays, addMonthsDate, iso, NOW, TODAY } from '../lib/dates'
import { importCsv, toCsv } from '../lib/io'
import { money, symbol } from '../lib/money'
import { replaceData, toast, update, useData, useStore, useUI, type SheetSpec, type View } from '../lib/store'
import type { Category, Freq, Kind, State } from '../lib/types'
import { Button, CatIcon, Field, ICONS, Segmented, Sheet } from './ui'

const KIND_WORD: Record<Kind, string> = { expense: 'Money out', income: 'Money in', savings: 'Put aside' }

/** Keeps the last spec while a sheet animates closed. */
export default function Sheets() {
  const sheet = useUI((u) => u.sheet)
  const close = useUI((u) => u.close)
  const last = useRef<SheetSpec | null>(sheet)
  if (sheet) last.current = sheet
  const spec = last.current
  const is = (t: SheetSpec['type']) => sheet?.type === t
  const key = JSON.stringify(spec, (k, v) => (k === 'run' ? undefined : v))
  const titles: Record<SheetSpec['type'], string> = {
    quick: spec?.type === 'quick' && spec.edit ? 'Edit entry' : 'Add money in or out', bill: spec?.type === 'bill' && spec.id ? 'Edit regular item' : 'New regular item',
    goal: spec?.type === 'goal' && spec.id ? 'Edit goal' : 'New savings goal', debt: spec?.type === 'debt' && spec.id ? 'Edit loan or card' : 'Add a loan or card',
    holding: spec?.type === 'holding' && spec.id ? 'Edit' : spec?.type === 'holding' && spec.kind === 'owe' ? 'Add something you owe' : 'Add something you own',
    account: spec?.type === 'account' && spec.id ? 'Edit account' : 'Add account', category: spec?.type === 'category' && spec.id ? 'Edit category' : 'New category',
    help: 'Help & simple answers', more: 'More', csv: 'Import from your bank', backup: 'Back up & export', confirm: spec?.type === 'confirm' ? spec.title : '',
  }
  return (
    <>
      {(['quick', 'bill', 'goal', 'debt', 'holding', 'account', 'category', 'help', 'more', 'csv', 'backup', 'confirm'] as const).map((t) => (
        <Sheet key={t} open={is(t)} onClose={close} title={titles[t]} wide={t === 'help' || t === 'backup'}>
          {spec?.type === t && <Body key={key} spec={spec} />}
        </Sheet>
      ))}
    </>
  )
}

function Body({ spec }: { spec: SheetSpec }) {
  switch (spec.type) {
    case 'quick': return <QuickAdd spec={spec} />
    case 'bill': return <BillForm id={spec.id} />
    case 'goal': return <GoalForm id={spec.id} />
    case 'debt': return <DebtForm id={spec.id} />
    case 'holding': return <HoldingForm id={spec.id} kind={spec.kind} />
    case 'account': return <AccountForm id={spec.id} />
    case 'category': return <CategoryForm id={spec.id} />
    case 'help': return <Help />
    case 'more': return <More />
    case 'csv': return <CsvImport />
    case 'backup': return <Backup />
    case 'confirm': return <Confirm spec={spec} />
  }
}

const done = (msg: string, prev?: State | null) => { useUI.getState().close(); toast(msg, prev) }
const Err = ({ msg }: { msg: string }) => <AnimatePresence>{msg && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] font-semibold text-bad" role="alert">{msg}</motion.p>}</AnimatePresence>
const Foot = ({ children }: { children: ReactNode }) => <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{children}</div>

function CatGrid({ cats, value, onPick, small = false }: { cats: Category[]; value?: string; onPick: (id: string) => void; small?: boolean }) {
  return (
    <div className={`grid gap-2 ${small ? 'grid-cols-4 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-4'}`}>
      {cats.map((c, i) => (
        <motion.button key={c.id} type="button" onClick={() => onPick(c.id)} aria-pressed={value === c.id}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} whileTap={{ scale: 0.94 }} whileHover={{ y: -2 }}
          className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1 py-3 text-center text-[12.5px] font-semibold leading-tight transition-colors ${value === c.id ? 'border-accent bg-accent-soft' : 'border-transparent bg-surface2 hover:border-line2'}`}>
          <CatIcon cat={c} size={small ? 34 : 42} />
          <span className="line-clamp-2">{c.name}</span>
        </motion.button>
      ))}
    </div>
  )
}

/* ---------------- quick add: pick a category, type the amount, done ---------------- */
function QuickAdd({ spec }: { spec: Extract<SheetSpec, { type: 'quick' }> }) {
  const s = useData()
  const edit = spec.edit
  const [kind, setKind] = useState<Kind>(edit?.type ?? spec.kind ?? 'expense')
  const [step, setStep] = useState<'cat' | 'amount'>(edit ? 'amount' : 'cat')
  const [cat, setCat] = useState(edit?.cat ?? '')
  const [amt, setAmt] = useState(edit ? String(edit.amount) : '')
  const [note, setNote] = useState(edit?.note ?? '')
  const [date, setDate] = useState(edit?.date ?? spec.date ?? TODAY)
  const [more, setMore] = useState(false)
  const [account, setAccount] = useState(edit?.account ?? s.accounts[0]?.id)
  const [to, setTo] = useState(edit?.to ?? s.accounts.find((a) => a.type === 'savings')?.id ?? '')
  const [person, setPerson] = useState(edit?.person ?? s.people[0])
  const [repeat, setRepeat] = useState<Freq | ''>('')
  const [shake, setShake] = useState(0)
  const cats = s.categories.filter((c) => c.kind === kind)
  const c = catOf(s, cat)
  const yesterday = iso(addDays(NOW, -1))

  const press = (k: string) => setAmt((v) => {
    if (k === 'del') return v.slice(0, -1)
    if (k === '.') return v.includes('.') ? v : (v || '0') + '.'
    if (/\.\d{2}$/.test(v) || v.replace('.', '').length >= 9) return v
    return v === '0' ? k : v + k
  })
  useEffect(() => {
    if (step !== 'amount') return
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input,select,textarea')) return
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === '.' || e.key === ',') press('.')
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Enter') save()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const save = () => {
    const a = Math.round(parseFloat(amt) * 100) / 100
    if (!(a > 0)) { setShake((x) => x + 1); return }
    const fields = { type: kind, amount: a, cat, date, note: note.trim(), account, to: kind === 'savings' ? to : undefined, person }
    if (repeat) {
      const prev = update((d) => { d.rules.push({ id: uid(), name: note.trim() || c?.name || 'Regular item', freq: repeat, start: date, paidThrough: date <= TODAY ? TODAY : '', ...fields }) })
      return done(`Added. It will now show up ${FREQ[repeat].short}.`, prev)
    }
    if (edit) {
      const prev = update((d) => { const t = d.tx.find((x) => x.id === edit.id); if (t) Object.assign(t, fields) })
      return done('Saved', prev)
    }
    const prev = update((d) => { d.tx.push({ id: uid(), ...fields }) })
    done(`Added ${money(a)}${kind === 'expense' ? ` for ${c?.name}` : kind === 'income' ? ' coming in' : ' put aside'}`, prev)
  }

  if (step === 'cat') return (
    <div className="flex flex-col gap-4">
      <Segmented label="Type" value={kind} onChange={(k) => { setKind(k); setCat('') }} className="self-start"
        options={[['expense', 'I spent money'], ['income', 'I got money'], ['savings', 'I put money aside']]} />
      <p className="text-[15px] text-ink2">{kind === 'expense' ? 'What did you spend it on?' : kind === 'income' ? 'Where did it come from?' : 'Where did it go?'}</p>
      <CatGrid cats={cats} value={cat} onPick={(id) => { setCat(id); setStep('amount') }} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {!edit && <button type="button" onClick={() => setStep('cat')} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-surface2" aria-label="Back to categories"><ArrowLeft size={18} /></button>}
        <button type="button" onClick={() => setStep('cat')} className="flex items-center gap-2 rounded-2xl bg-surface2 py-1.5 pl-1.5 pr-3 font-semibold">
          <CatIcon cat={c} size={32} />{c?.name ?? 'Pick a category'}<span className="text-[12px] font-normal text-muted">{KIND_WORD[kind]}</span>
        </button>
      </div>
      <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}
        className="flex items-baseline justify-center gap-1 py-2 font-display font-extrabold" aria-live="polite">
        <span className="text-[30px] text-muted">{symbol()}</span>
        <motion.span key={amt} initial={{ scale: 0.92, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className={`tnum text-[60px] leading-none ${amt ? '' : 'text-line2'}`}>{amt || '0'}</motion.span>
      </motion.div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
          <motion.button key={k} type="button" whileTap={{ scale: 0.92 }} onClick={() => press(k)} aria-label={k === 'del' ? 'Delete digit' : k === '.' ? 'Decimal point' : k}
            className="grid h-14 place-items-center rounded-2xl bg-surface2 font-display text-[24px] font-bold transition-colors hover:bg-line">
            {k === 'del' ? <Delete size={22} /> : k}
          </motion.button>
        ))}
      </div>
      <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'expense' ? 'What was it? (optional)' : 'Note (optional)'} aria-label="Note" maxLength={80} />
      <div className="flex flex-wrap gap-2">
        {[[TODAY, 'Today'], [yesterday, 'Yesterday']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setDate(v)} aria-pressed={date === v} className={`rounded-full border px-4 py-1.5 text-[14px] font-semibold ${date === v ? 'border-accent bg-accent-soft text-accent' : 'border-line2'}`}>{l}</button>
        ))}
        <input type="date" className={`field !w-auto !rounded-full !py-1.5 ${date !== TODAY && date !== yesterday ? '!border-accent' : ''}`} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Pick a date" />
      </div>
      <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1 self-start text-[14px] font-semibold text-ink2 hover:text-ink" aria-expanded={more}>
        More options <motion.span animate={{ rotate: more ? 180 : 0 }}><ChevronDown size={16} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {more && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-3 pb-1 sm:grid-cols-2">
              <Field label={kind === 'savings' ? 'From account' : 'Account'}><select className="field" value={account} onChange={(e) => setAccount(e.target.value)}>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
              {kind === 'savings' && <Field label="Moved to"><select className="field" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Somewhere else (e.g. investments)</option>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
              {s.people.length > 1 && <Field label="Who"><select className="field" value={person} onChange={(e) => setPerson(e.target.value)}>{s.people.map((p) => <option key={p}>{p}</option>)}</select></Field>}
              {!edit && <Field label="Happens regularly?"><select className="field" value={repeat} onChange={(e) => setRepeat(e.target.value as Freq | '')}><option value="">No, just once</option>{Object.entries(FREQ).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></Field>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-1 flex gap-2">
        {edit && <Button variant="danger" onClick={() => { const prev = update((d) => { d.tx = d.tx.filter((x) => x.id !== edit.id) }); done('Deleted', prev) }}><Trash2 size={16} />Delete</Button>}
        <Button variant="primary" size="lg" className="flex-1" onClick={save}>{edit ? 'Save changes' : amt && +amt > 0 ? `Add ${money(+amt)}` : 'Add'}</Button>
      </div>
    </div>
  )
}

/* ---------------- regular items ---------------- */
function BillForm({ id }: { id?: string }) {
  const s = useData()
  const r = s.rules.find((x) => x.id === id)
  const [kind, setKind] = useState<Kind>(r?.type ?? 'expense')
  const [name, setName] = useState(r?.name ?? '')
  const [amount, setAmount] = useState(r ? String(r.amount) : '')
  const [cat, setCat] = useState(r?.cat ?? '')
  const [freq, setFreq] = useState<Freq>(r?.freq ?? 'monthly')
  const [start, setStart] = useState(r?.start ?? TODAY)
  const [end, setEnd] = useState(r?.end ?? '')
  const [past, setPast] = useState(r ? !!r.paidThrough : true)
  const [err, setErr] = useState('')
  const cats = s.categories.filter((c) => c.kind === kind)
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const a = parseFloat(amount)
    if (!name.trim()) return setErr('Give it a name, like "Rent" or "Netflix".')
    if (!(a > 0)) return setErr('Enter how much it is.')
    if (!cat) return setErr('Pick a category.')
    if (end && end < start) return setErr('The end date must be after the start date.')
    const v = { name: name.trim(), type: kind, amount: a, cat, freq, start, end, paidThrough: past ? TODAY : '' }
    const prev = update((d) => {
      if (r) Object.assign(d.rules.find((x) => x.id === r.id)!, v)
      else d.rules.push({ id: uid(), account: d.accounts[0].id, to: kind === 'savings' ? d.accounts.find((x) => x.type === 'savings')?.id : '', person: d.people[0], ...v })
    })
    done(r ? 'Saved' : `${v.name} added`, prev)
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Segmented label="Type" value={kind} onChange={(k) => { setKind(k); setCat('') }} options={[['expense', 'A bill'], ['income', 'Pay / money in'], ['savings', 'Regular saving']]} className="self-start" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'income' ? 'e.g. My salary' : kind === 'savings' ? 'e.g. Monthly saving' : 'e.g. Rent'} /></Field>
        <Field label="Amount"><input className="field" type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="How often"><select className="field" value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>{Object.entries(FREQ).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></Field>
        <Field label={r ? 'First date' : 'Next (or first) date'}><input className="field" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      </div>
      <div><p className="mb-2 text-[13.5px] font-semibold text-ink2">Category</p><CatGrid cats={cats} value={cat} onPick={setCat} small /></div>
      <details className="rounded-2xl border border-line p-3 text-[14px]">
        <summary className="cursor-pointer font-semibold text-ink2">More options</summary>
        <div className="mt-3 grid gap-3">
          <Field label="Stops on (optional)" hint="Leave empty if it keeps going."><input className="field" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /> Treat dates up to today as already paid</label>
        </div>
      </details>
      <Err msg={err} />
      <Foot>
        {r && <Button variant="danger" className="mr-auto" onClick={() => { const prev = update((d) => { d.rules = d.rules.filter((x) => x.id !== r.id) }); done(`${r.name} removed`, prev) }}><Trash2 size={16} />Remove</Button>}
        <Button type="submit" variant="primary">{r ? 'Save' : 'Add'}</Button>
      </Foot>
    </form>
  )
}

/* ---------------- goals ---------------- */
function GoalForm({ id }: { id?: string }) {
  const s = useData()
  const g = s.goals.find((x) => x.id === id)
  const [name, setName] = useState(g?.name ?? '')
  const [target, setTarget] = useState(g ? String(g.target) : '')
  const [saved, setSaved] = useState(g ? String(g.saved) : '0')
  const [due, setDue] = useState(g?.due ?? iso(addMonthsDate(NOW, 12)))
  const [err, setErr] = useState('')
  const months = monthsUntil(due)
  const need = Math.max(0, (parseFloat(target) - (parseFloat(saved) || 0)) / months)
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const t = parseFloat(target)
    if (!name.trim()) return setErr('What are you saving for?')
    if (!(t > 0)) return setErr('How much do you need?')
    const v = { name: name.trim(), target: t, saved: parseFloat(saved) || 0, due }
    const prev = update((d) => { if (g) Object.assign(d.goals.find((x) => x.id === g.id)!, v); else d.goals.push({ id: uid(), ...v }) })
    done(g ? 'Saved' : `Goal "${v.name}" created`, prev)
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {!g && <div className="flex flex-wrap gap-2">{['Rainy day fund', 'Holiday', 'New car', 'Home deposit', 'Wedding', 'Christmas'].map((x) => <button key={x} type="button" onClick={() => setName(x)} className="rounded-full border border-line2 px-3 py-1 text-[13.5px] font-semibold hover:border-accent">{x}</button>)}</div>}
      <Field label="What are you saving for?"><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="How much do you need?"><input className="field" type="number" min="0" step="any" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        <Field label="Already saved"><input className="field" type="number" min="0" step="any" inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} /></Field>
      </div>
      <Field label="By when?"><input className="field" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      {need > 0 && isFinite(need) && <p className="rounded-2xl bg-accent-soft p-3.5 text-[14.5px] text-ink">Put aside <b>{money(Math.ceil(need))}</b> a month and you'll get there in {months} month{months === 1 ? '' : 's'}.</p>}
      <Err msg={err} />
      <Foot>
        {g && <Button variant="danger" className="mr-auto" onClick={() => { const prev = update((d) => { d.goals = d.goals.filter((x) => x.id !== g.id) }); done('Goal removed', prev) }}><Trash2 size={16} />Remove</Button>}
        <Button type="submit" variant="primary">{g ? 'Save' : 'Create goal'}</Button>
      </Foot>
    </form>
  )
}

/* ---------------- debts ---------------- */
function DebtForm({ id }: { id?: string }) {
  const s = useData()
  const x = s.debts.find((d) => d.id === id)
  const [name, setName] = useState(x?.name ?? '')
  const [balance, setBalance] = useState(x ? String(x.balance) : '')
  const [rate, setRate] = useState(x ? String(x.rate) : '')
  const [min, setMin] = useState(x ? String(x.min) : '')
  const [err, setErr] = useState('')
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const v = { name: name.trim(), balance: parseFloat(balance), rate: parseFloat(rate) || 0, min: parseFloat(min) }
    if (!v.name) return setErr('Give it a name, like "Car loan".')
    if (!(v.balance >= 0)) return setErr('How much do you still owe?')
    if (!(v.min > 0)) return setErr('What is the smallest payment you must make each month?')
    const prev = update((d) => { if (x) Object.assign(d.debts.find((y) => y.id === x.id)!, v); else d.debts.push({ id: uid(), ...v }) })
    done(x ? 'Saved' : `${v.name} added`, prev)
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Credit card" /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Still owed"><input className="field" type="number" min="0" step="any" value={balance} onChange={(e) => setBalance(e.target.value)} /></Field>
        <Field label="Interest per year (%)" hint="On your statement, often called APR"><input className="field" type="number" min="0" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        <Field label="Minimum each month"><input className="field" type="number" min="0" step="any" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
      </div>
      <Err msg={err} />
      <Foot>
        {x && <Button variant="danger" className="mr-auto" onClick={() => { const prev = update((d) => { d.debts = d.debts.filter((y) => y.id !== x.id) }); done('Removed', prev) }}><Trash2 size={16} />Remove</Button>}
        <Button type="submit" variant="primary">{x ? 'Save' : 'Add'}</Button>
      </Foot>
    </form>
  )
}

function HoldingForm({ id, kind }: { id?: string; kind?: 'own' | 'owe' }) {
  const s = useData()
  const h = s.holdings.find((x) => x.id === id)
  const [k, setK] = useState<'own' | 'owe'>(h?.kind ?? kind ?? 'own')
  const [name, setName] = useState(h?.name ?? '')
  const [group, setGroup] = useState(h?.group ?? (k === 'own' ? 'Investments' : 'Personal'))
  const [value, setValue] = useState(h ? String(h.value) : '')
  const [err, setErr] = useState('')
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const v = { name: name.trim(), kind: k, group, value: parseFloat(value) }
    if (!v.name) return setErr('Give it a name.')
    if (!(v.value >= 0)) return setErr('Enter a value.')
    const prev = update((d) => { if (h) Object.assign(d.holdings.find((y) => y.id === h.id)!, v); else d.holdings.push({ id: uid(), ...v }) })
    done('Saved', prev)
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Segmented label="Own or owe" value={k} onChange={setK} options={[['own', 'Something I own'], ['owe', 'Something I owe']]} className="self-start" />
      <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={k === 'own' ? 'e.g. Pension, Car, Shares' : 'e.g. Money borrowed from a friend'} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Group"><select className="field" value={group} onChange={(e) => setGroup(e.target.value)}>{['Investments', 'Things', 'Cash', 'Property', 'Personal', 'Other'].map((g) => <option key={g}>{g}</option>)}</select></Field>
        <Field label="Value today"><input className="field" type="number" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
      </div>
      <Err msg={err} />
      <Foot>
        {h && <Button variant="danger" className="mr-auto" onClick={() => { const prev = update((d) => { d.holdings = d.holdings.filter((y) => y.id !== h.id) }); done('Removed', prev) }}><Trash2 size={16} />Remove</Button>}
        <Button type="submit" variant="primary">Save</Button>
      </Foot>
    </form>
  )
}

function AccountForm({ id }: { id?: string }) {
  const s = useData()
  const a = s.accounts.find((x) => x.id === id)
  const [name, setName] = useState(a?.name ?? '')
  const [type, setType] = useState(a?.type ?? 'everyday')
  const [start, setStart] = useState(a ? String(a.start) : '0')
  const [err, setErr] = useState('')
  const used = a && (s.tx.some((t) => t.account === a.id || t.to === a.id) || s.rules.some((r) => r.account === a.id || r.to === a.id))
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Give the account a name.')
    const v = { name: name.trim(), type, start: parseFloat(start) || 0 }
    const prev = update((d) => { if (a) Object.assign(d.accounts.find((y) => y.id === a.id)!, v); else d.accounts.push({ id: 'a' + uid(), ...v }) })
    done('Saved', prev)
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main bank account" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type"><select className="field" value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="everyday">Everyday</option><option value="savings">Savings</option><option value="card">Credit card</option><option value="cash">Cash</option><option value="investment">Investment</option></select></Field>
        <Field label="Balance when you started" hint="Use a minus for money owed on a card"><input className="field" type="number" step="any" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      </div>
      <Err msg={err} />
      <Foot>
        {a && !used && s.accounts.length > 1 && <Button variant="danger" className="mr-auto" onClick={() => { const prev = update((d) => { d.accounts = d.accounts.filter((y) => y.id !== a.id) }); done('Account removed', prev) }}><Trash2 size={16} />Remove</Button>}
        <Button type="submit" variant="primary">Save</Button>
      </Foot>
    </form>
  )
}

function CategoryForm({ id }: { id?: string }) {
  const s = useData()
  const c = s.categories.find((x) => x.id === id)
  const [name, setName] = useState(c?.name ?? '')
  const [kind, setKind] = useState<Kind>(c?.kind ?? 'expense')
  const [group, setGroup] = useState(c?.group ?? 'extras')
  const [plan, setPlan] = useState(c ? String(c.plan) : '0')
  const [icon, setIcon] = useState(c?.icon ?? 'box')
  const [err, setErr] = useState('')
  const used = c && (s.tx.some((t) => t.cat === c.id) || s.rules.some((r) => r.cat === c.id))
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Give it a name.')
    const v = { name: name.trim(), kind, group: kind === 'savings' ? ('future' as const) : group, plan: parseFloat(plan) || 0, icon }
    const prev = update((d) => {
      if (c) { Object.assign(d.categories.find((y) => y.id === c.id)!, v); return }
      const usedSlots = new Set(d.categories.map((y) => y.slot))
      const slot = kind === 'expense' ? [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !usedSlots.has(i)) ?? null : null
      d.categories.push({ id: 'c' + uid(), slot, ...v })
    })
    done(c ? 'Saved' : `${v.name} added`, prev)
  }
  const preview = { id: 'p', name, kind, group, plan: 0, slot: c?.slot ?? 0, icon } as Category
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex items-end gap-3"><CatIcon cat={preview} size={52} /><Field label="Name" className="flex-1"><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
      <Segmented label="Type" value={kind} onChange={setKind} options={[['expense', 'Spending'], ['income', 'Money in'], ['savings', 'Saving']]} className="self-start" />
      {kind === 'expense' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Is it essential?"><select className="field" value={group} onChange={(e) => setGroup(e.target.value as typeof group)}><option value="essentials">Essential (a need)</option><option value="extras">Extra (a nice-to-have)</option></select></Field>
          <Field label="Monthly plan"><input className="field" type="number" min="0" step="any" value={plan} onChange={(e) => setPlan(e.target.value)} /></Field>
        </div>
      )}
      <div><p className="mb-2 text-[13.5px] font-semibold text-ink2">Icon</p>
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">{Object.entries(ICONS).map(([k, I]) => (
          <button key={k} type="button" onClick={() => setIcon(k)} aria-label={k} aria-pressed={icon === k} className={`grid aspect-square place-items-center rounded-xl border-2 ${icon === k ? 'border-accent bg-accent-soft text-accent' : 'border-transparent bg-surface2 text-ink2 hover:text-ink'}`}><I size={18} /></button>
        ))}</div>
      </div>
      <Err msg={err} />
      <Foot>
        {c && !used && <Button variant="danger" className="mr-auto" onClick={() => { const prev = update((d) => { d.categories = d.categories.filter((y) => y.id !== c.id) }); done('Category removed', prev) }}><Trash2 size={16} />Remove</Button>}
        {c && used && <span className="mr-auto text-[12.5px] text-muted">In use, so it can't be removed.</span>}
        <Button type="submit" variant="primary">Save</Button>
      </Foot>
    </form>
  )
}

/* ---------------- help ---------------- */
const FAQ: [string, string][] = [
  ['What is "Safe to spend"?', "It's the money that's really free this month. Tally takes everything coming in, then subtracts what you've spent, what you've put aside and the bills that still have to go out. If you only spend from this number, your bills are always covered."],
  ['How do I add something I bought?', 'Tap the big + button. Pick what it was (like Groceries), type the amount, and tap Add. That\'s it. You can press N on a keyboard too.'],
  ['What are regular items?', 'Things that repeat, like rent, your phone bill, subscriptions and your pay. Add them once under Bills and they appear every month by themselves. When one is paid, tap its tick box.'],
  ['What is a plan (budget)?', "A plan is how much you'd like to spend on each thing in a month. Tally shows how much is left in each 'pot' so you can slow down before you run out. Not sure what to plan? Tap 'Use this' to copy what you usually spend."],
  ['Essentials, extras and future you?', 'Essentials are needs (home, food shopping, energy). Extras are nice-to-haves (eating out, shopping, fun). Future you is money you save or invest. A common guide is 50% / 30% / 20%.'],
  ['What does the money health score mean?', 'A quick score out of 100 based on four good habits: staying within your plan, saving regularly, paying bills on time and having a safety cushion of about three months of essentials.'],
  ['Cheapest way or quick wins for debts?', 'Both pay the minimum on every debt. "Cheapest way" puts extra money on the debt with the highest interest, so you pay least overall. "Quick wins" clears the smallest debt first, which feels great and keeps you motivated.'],
  ['Where is my data kept?', 'Only in this browser, on this device. Nothing is sent to a server. Use Settings → Back up to save a copy or move it to another device.'],
]
function Help() {
  const [open, setOpen] = useState(0)
  return (
    <div className="flex flex-col gap-2">
      {FAQ.map(([q, a], i) => (
        <div key={q} className="rounded-2xl border border-line">
          <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex w-full items-center gap-3 p-4 text-left font-semibold">
            <HelpCircle size={18} className="shrink-0 text-accent" /><span className="flex-1">{q}</span><motion.span animate={{ rotate: open === i ? 180 : 0 }}><ChevronDown size={18} /></motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 text-[14.5px] leading-relaxed text-ink2"><span className="block pb-4 pl-[30px]">{a}</span></motion.p>}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

function More() {
  const go = useUI((u) => u.go), open = useUI((u) => u.open), close = useUI((u) => u.close)
  const items: [View | 'help', string, string, typeof Goal][] = [
    ['bills', 'Bills & pay', 'Things that repeat', CalendarClock], ['goals', 'Goals', 'Save up for things', Goal], ['debts', 'Debts', 'Get debt-free faster', Scale],
    ['worth', 'What I\'m worth', 'Own minus owe', Landmark], ['settings', 'Settings', 'Names, currency, data', Cog], ['help', 'Help', 'Simple answers', HelpCircle],
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(([v, t, d, I], i) => (
        <motion.button key={v} type="button" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.96 }}
          onClick={() => { if (v === 'help') open({ type: 'help' }); else { close(); go(v) } }}
          className="flex flex-col items-start gap-2 rounded-2xl bg-surface2 p-4 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><I size={20} /></span>
          <span className="font-bold">{t}</span><span className="-mt-1.5 text-[13px] text-ink2">{d}</span>
        </motion.button>
      ))}
    </div>
  )
}

/* ---------------- import / export ---------------- */
function CsvImport() {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const run = () => {
    if (!text.trim()) return setErr('Choose a file or paste the text first.')
    let res: number | string = 0
    const prev = update((d) => { res = importCsv(d, text) })
    if (typeof res === 'string') { replaceData(prev); return setErr(res) }
    done(`Imported ${res} item${res === 1 ? '' : 's'}`, prev)
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14.5px] text-ink2">Most banks let you download your transactions as a CSV file. Choose that file here. Tally reads the date, description and amount. Negative amounts count as money out.</p>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line2 p-6 text-center hover:border-accent">
        <Upload className="text-accent" /><span className="font-semibold">Choose a CSV file</span><span className="text-[13px] text-muted">or paste the text below</span>
        <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setText(String(r.result)); r.readAsText(f) }} />
      </label>
      <textarea className="field min-h-[140px] font-mono text-[12.5px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Date,Description,Amount\n2026-10-02,Supermarket,-54.20'} aria-label="CSV text" />
      <Err msg={err} />
      <Foot><Button variant="primary" onClick={run}>Import</Button></Foot>
    </div>
  )
}
function Backup() {
  const s = useData()
  const [tab, setTab] = useState<'csv' | 'json' | 'restore'>('csv')
  const [paste, setPaste] = useState('')
  const [err, setErr] = useState('')
  const text = tab === 'csv' ? toCsv(s) : JSON.stringify(s)
  const ref = useRef<HTMLTextAreaElement>(null)
  const copy = () => navigator.clipboard?.writeText(text).then(() => toast('Copied'), () => { ref.current?.select(); toast('Press Ctrl+C (or ⌘C) to copy') }) ?? (ref.current?.select(), toast('Press Ctrl+C (or ⌘C) to copy'))
  const download = () => {
    try {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
      a.download = tab === 'csv' ? 'tally-activity.csv' : 'tally-backup.json'
      document.body.append(a); a.click(); a.remove()
    } catch { toast('Downloads are blocked here. Use Copy instead.') }
  }
  const restore = () => {
    try {
      const x = JSON.parse(paste) as State
      if (!x || x.v !== 2 || !Array.isArray(x.tx)) return setErr("That doesn't look like a Tally backup.")
      const before = useStore.getState().data
      replaceData(x)
      done('Backup restored', before)
    } catch { setErr('That text could not be read. Paste the whole backup.') }
  }
  return (
    <div className="flex flex-col gap-4">
      <Segmented label="What" value={tab} onChange={setTab} options={[['csv', 'Spreadsheet (CSV)'], ['json', 'Full backup'], ['restore', 'Restore a backup']]} className="self-start" />
      {tab === 'restore' ? (
        <>
          <p className="text-[14.5px] text-ink2">Paste a full backup here. It replaces what's in Tally now.</p>
          <textarea className="field min-h-[160px] font-mono text-[12px]" value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Backup text" />
          <Err msg={err} />
          <Foot><Button variant="primary" onClick={restore}>Restore</Button></Foot>
        </>
      ) : (
        <>
          <p className="text-[14.5px] text-ink2">{tab === 'csv' ? 'Everything you have paid or received, ready for Excel or Google Sheets.' : 'A complete copy of your Tally. Keep it somewhere safe, or use it to move to another device.'}</p>
          <textarea ref={ref} readOnly className="field min-h-[160px] font-mono text-[12px]" value={text} aria-label="Export text" />
          <Foot><Button onClick={download}><Download size={16} />Download</Button><Button variant="primary" onClick={copy}><Copy size={16} />Copy</Button></Foot>
        </>
      )}
    </div>
  )
}

function Confirm({ spec }: { spec: Extract<SheetSpec, { type: 'confirm' }> }) {
  const close = useUI((u) => u.close)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-ink2">{spec.text}</p>
      <Foot><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="danger" onClick={() => { close(); spec.run() }}>{spec.label}</Button></Foot>
    </div>
  )
}

