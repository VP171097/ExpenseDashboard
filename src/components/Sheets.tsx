import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, Banknote, BarChart3, CalendarClock, CalendarDays, ChevronDown, Compass, Plane, Copy, Delete, Download, FileSpreadsheet, FileText, Goal, HelpCircle, Landmark, Repeat, Scale, Settings as Cog, Trash2, Upload, Users, Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { catOf, cents, findDuplicate, FREQ, isPaid, itemsIn, monthsUntil, ruleKey, tripDays, uid } from '../lib/calc'
import { saveFile, workbook } from '../lib/files'
import { emiRule, emiStatus } from '../lib/emi'
import { addDays, addMonthsDate, fmtDate, iso, monthEnd, monthName, NOW, THIS_MONTH, TODAY } from '../lib/dates'
import { balances } from '../lib/calc'
import { checkBackup, commitImport, prepareImport, toCsv, toCsvRange, type ImportPlan } from '../lib/io'
import { money, money2, symbol } from '../lib/money'
import { replaceData, toast, update, useData, useStore, useUI, type SheetSpec, type View } from '../lib/store'
import type { Category, Emi, Freq, Kind, State } from '../lib/types'
import { Button, CatIcon, celebrate, Field, ICONS, Segmented, Sheet } from './ui'

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
    goal: spec?.type === 'goal' && spec.id ? 'Edit goal' : 'New savings goal', trip: spec?.type === 'trip' && spec.id ? 'Edit trip' : 'New trip', debt: spec?.type === 'debt' && spec.id ? 'Edit loan or card' : 'Add a loan or card',
    emi: spec?.type === 'emi' && spec.id ? 'Edit loan or EMI' : spec?.type === 'emi' && spec.kind === 'card' ? 'Add a card EMI' : 'Add a loan',
    holding: spec?.type === 'holding' && spec.id ? 'Edit' : spec?.type === 'holding' && spec.kind === 'owe' ? 'Add something you owe' : 'Add something you own',
    account: spec?.type === 'account' && spec.id ? 'Edit account' : 'Add account', category: spec?.type === 'category' && spec.id ? 'Edit category' : 'New category',
    help: 'Help & simple answers', more: 'Everything in SpendCop', csv: 'Import from your bank', backup: 'Back up & export', export: 'Export', confirm: spec?.type === 'confirm' ? spec.title : '',
    occ: 'This payment', transfer: spec?.type === 'transfer' && spec.id ? 'Edit transfer' : 'Move money between accounts',
  }
  return (
    <>
      {(['quick', 'bill', 'goal', 'trip', 'debt', 'emi', 'holding', 'account', 'category', 'help', 'more', 'csv', 'backup', 'export', 'confirm', 'occ', 'transfer'] as const).map((t) => (
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
    case 'trip': return <TripForm id={spec.id} />
    case 'debt': return <DebtForm id={spec.id} />
    case 'emi': return <EmiForm id={spec.id} kind={spec.kind} />
    case 'holding': return <HoldingForm id={spec.id} kind={spec.kind} />
    case 'account': return <AccountForm id={spec.id} />
    case 'category': return <CategoryForm id={spec.id} />
    case 'help': return <Help />
    case 'more': return <More />
    case 'csv': return <CsvImport />
    case 'backup': return <Backup />
    case 'export': return <Export month={spec.month} />
    case 'confirm': return <Confirm spec={spec} />
    case 'occ': return <OccForm ruleId={spec.ruleId} date={spec.date} />
    case 'transfer': return <TransferForm id={spec.id} from={spec.from} to={spec.to} />
  }
}

const done = (msg: string, prev?: State | null) => { useUI.getState().close(); toast(msg, prev, 'good') }
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
  const [sub, setSub] = useState(edit?.sub ?? '')
  const [newSub, setNewSub] = useState('')
  const [dupOk, setDupOk] = useState(false)
  const [goal, setGoal] = useState('')
  const [trip, setTrip] = useState(edit?.trip ?? spec.trip ?? '')
  // trips worth offering: not long finished, plus whichever one is already chosen
  const recentEnd = iso(addDays(NOW, -45))
  const trips = (s.trips ?? []).filter((t) => t.id === trip || t.end >= recentEnd).sort((a, b) => a.start.localeCompare(b.start))
  const onTrip = trips.find((t) => date >= t.start && date <= t.end)
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

  const saving = useRef(false)
  const save = () => {
    if (saving.current) return // a second click while saving does nothing
    const a = Math.round(parseFloat(amt) * 100) / 100
    if (!(a > 0)) { setShake((x) => x + 1); return }
    if (!repeat && !dupOk && findDuplicate(s, { id: edit?.id, date, amount: a, cat })) { setDupOk(true); return }
    saving.current = true
    const subName = newSub.trim() || sub
    const fields = { type: kind, amount: a, cat, date, note: note.trim() || (goal ? `For ${s.goals.find((g) => g.id === goal)?.name}` : ''), account, to: kind === 'savings' ? to : undefined, person, sub: subName || undefined }
    // one change, so one Undo reverses all of it
    const prev = update((d) => {
      if (newSub.trim()) { const x = d.categories.find((y) => y.id === cat); if (x && !(x.subs ?? []).includes(subName)) x.subs = [...(x.subs ?? []), subName] }
      if (repeat) { d.rules.push({ id: uid(), name: note.trim() || c?.name || 'Regular item', freq: repeat, start: date, paidThrough: date <= TODAY ? TODAY : '', ...fields }); return }
      const tripId = kind !== 'savings' && trip && d.trips.some((x) => x.id === trip) ? trip : undefined
      if (edit) { const t = d.tx.find((x) => x.id === edit.id); if (t) { Object.assign(t, fields); if (tripId) t.trip = tripId; else delete t.trip } return }
      d.tx.push({ id: uid(), ...fields, ...(tripId ? { trip: tripId } : {}) })
      if (kind === 'savings' && goal) { const g = d.goals.find((x) => x.id === goal); if (g) { g.saved = (cents(g.saved) + cents(a)) / 100; g.history = [...(g.history ?? []), { date, amount: a }] } }
    })
    if (repeat) return done(`Added. It will now show up ${FREQ[repeat].short}.`, prev)
    if (edit) return done('Saved', prev)
    const g = goal ? s.goals.find((x) => x.id === goal) : null
    if (g && g.saved < g.target && g.saved + a >= g.target) celebrate(null, true)
    const tr = kind !== 'savings' && trip ? s.trips.find((x) => x.id === trip) : null
    done(`Added ${money(a)}${kind === 'expense' ? ` for ${c?.name}` : kind === 'income' ? ' coming in' : g ? ` to ${g.name}` : ' put aside'}${tr ? ` · ${tr.name}` : ''}`, prev)
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
      {kind === 'expense' && c && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[13px] font-semibold text-ink2">Type of {c.name.toLowerCase()}:</span>
          {(c.subs ?? []).map((x) => <button key={x} type="button" aria-pressed={sub === x} onClick={() => { setSub(sub === x ? '' : x); setNewSub('') }} className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${sub === x ? 'border-accent bg-accent-soft text-accent' : 'border-line2 text-ink2'}`}>{x}</button>)}
          <input className="field !w-32 !rounded-full !py-1 text-[13px]" value={newSub} onChange={(e) => { setNewSub(e.target.value); setSub('') }} placeholder="+ new type" aria-label="New sub-category" maxLength={30} />
        </div>
      )}
      {kind !== 'savings' && trips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Trip">
          <span className="mr-1 flex items-center gap-1 text-[13px] font-semibold text-ink2"><Plane size={14} />{kind === 'income' ? 'Money back for a trip?' : 'Part of a trip?'}</span>
          <button type="button" aria-pressed={!trip} onClick={() => setTrip('')} className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${!trip ? 'border-accent bg-accent-soft text-accent' : 'border-line2 text-ink2'}`}>No</button>
          {trips.map((t) => (
            <button key={t.id} type="button" aria-pressed={trip === t.id} onClick={() => setTrip(trip === t.id ? '' : t.id)}
              className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${trip === t.id ? 'border-accent bg-accent-soft text-accent' : 'border-line2 text-ink2'}`}>
              <span aria-hidden>{t.icon}</span> {t.name}{t === onTrip && trip !== t.id ? <span className="ml-1 text-[11px] font-bold text-good">on now</span> : null}
            </button>
          ))}
        </div>
      )}
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
              {kind === 'savings' && s.goals.some((g) => g.saved < g.target) && <Field label="For a goal (optional)"><select className="field" value={goal} onChange={(e) => setGoal(e.target.value)}><option value="">No particular goal</option>{s.goals.filter((g) => g.saved < g.target).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>}
              {kind === 'savings' && <Field label="Moved to"><select className="field" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Somewhere else (e.g. investments)</option>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
              {s.people.length > 1 && <Field label="Who"><select className="field" value={person} onChange={(e) => setPerson(e.target.value)}>{s.people.map((p) => <option key={p}>{p}</option>)}</select></Field>}
              {!edit && <Field label="Happens regularly?"><select className="field" value={repeat} onChange={(e) => setRepeat(e.target.value as Freq | '')}><option value="">No, just once</option>{Object.entries(FREQ).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select></Field>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{dupOk && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl bg-warn-soft p-3 text-[14px]" role="alert">
          You already have <b>{money(+amt)}</b> for {c?.name} around this date. Added it twice? Tap the button again if this is a new one.
        </motion.p>)}</AnimatePresence>
      <div className="mt-1 flex gap-2">
        {edit && <Button variant="danger" onClick={() => { const prev = update((d) => { d.tx = d.tx.filter((x) => x.id !== edit.id) }); done('Deleted', prev) }}><Trash2 size={16} />Delete</Button>}
        <Button variant="primary" size="lg" className="flex-1" onClick={save}>{dupOk ? 'Yes, add it anyway' : edit ? 'Save changes' : amt && +amt > 0 ? `Add ${money(+amt)}` : 'Add'}</Button>
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

/* ---------------- trips ---------------- */
const TRIP_ICONS = ['✈️', '🏖️', '🏔️', '🏙️', '🚗', '🏕️', '🚆', '🚢', '🎢', '🎿', '💍', '🌴']
function TripForm({ id }: { id?: string }) {
  const s = useData()
  const { go, close } = useUI()
  const t = (s.trips ?? []).find((x) => x.id === id)
  const [name, setName] = useState(t?.name ?? '')
  const [icon, setIcon] = useState(t?.icon ?? TRIP_ICONS[0])
  const [start, setStart] = useState(t?.start ?? TODAY)
  const [end, setEnd] = useState(t?.end ?? iso(addDays(NOW, 6)))
  const [budget, setBudget] = useState(t && t.budget > 0 ? String(t.budget) : '')
  const [note, setNote] = useState(t?.note ?? '')
  const [err, setErr] = useState('')
  const used = t ? s.tx.filter((x) => x.trip === t.id).length : 0
  const days = start && end && end >= start ? tripDays({ start, end }) : 0
  const b = parseFloat(budget)
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Give the trip a name, like "Summer in Spain".')
    if (!start || !end) return setErr('Pick the first and last day.')
    if (end < start) return setErr('The last day must be on or after the first day.')
    if (budget && !(b >= 0)) return setErr('The budget should be a number, or leave it empty.')
    const v = { name: name.trim(), icon, start, end, budget: b > 0 ? Math.round(b * 100) / 100 : 0, note: note.trim() || undefined }
    const prev = update((d) => { if (t) Object.assign(d.trips.find((x) => x.id === t.id)!, v); else d.trips.push({ id: uid(), ...v }) })
    done(t ? 'Trip saved' : `${v.icon} ${v.name} created. Add expenses to it from any "Add" button.`, prev)
    if (!t && useUI.getState().view !== 'trips') go('trips')
  }
  const remove = () => {
    const prev = update((d) => { d.trips = d.trips.filter((x) => x.id !== t!.id); for (const x of d.tx) if (x.trip === t!.id) delete x.trip })
    close(); toast(used ? `${t!.name} deleted. Its ${used} entries are kept in Activity without the trip tag.` : `${t!.name} deleted`, prev)
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {!t && <div className="flex flex-wrap gap-2">{['Summer holiday', 'Weekend away', 'Visiting family', 'Work trip', 'Wedding'].map((x) => <button key={x} type="button" onClick={() => setName(x)} className="rounded-full border border-line2 px-3 py-1 text-[13.5px] font-semibold hover:border-accent">{x}</button>)}</div>}
      <Field label="Trip name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer in Spain" maxLength={40} /></Field>
      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-ink2">Picture</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Trip picture">
          {TRIP_ICONS.map((x) => <button key={x} type="button" role="radio" aria-checked={icon === x} aria-label={`Picture ${x}`} onClick={() => setIcon(x)} className={`grid h-11 w-11 place-items-center rounded-xl border-2 text-[22px] ${icon === x ? 'border-accent bg-accent-soft' : 'border-transparent bg-surface2'}`}>{x}</button>)}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First day"><input className="field" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value) }} /></Field>
        <Field label="Last day"><input className="field" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="Budget for the whole trip (optional)" hint="Include bookings like flights and hotels. Leave empty to just track what you spend.">
        <input className="field" type="number" min="0" step="any" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 1500" />
      </Field>
      {b > 0 && days > 0 && <p className="rounded-2xl bg-accent-soft p-3.5 text-[14.5px]">That's about <b>{money(Math.round(b / days))}</b> a day for {days} day{days === 1 ? '' : 's'}.</p>}
      <Field label="Note (optional)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="Who's going, where you're staying…" /></Field>
      <p className="text-[13px] text-ink2">Trip expenses are normal expenses with the trip's name attached, so they still count in your month, your categories and your plan.</p>
      <Err msg={err} />
      <Foot>
        {t && <Button variant="danger" className="mr-auto" onClick={remove}><Trash2 size={16} />Delete trip</Button>}
        <Button type="submit" variant="primary">{t ? 'Save' : 'Create trip'}</Button>
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

/* ---------------- a loan or card EMI: what you borrowed, the rate and how long ---------------- */
function EmiForm({ id, kind }: { id?: string; kind?: 'loan' | 'card' }) {
  const s = useData()
  const x = s.emis.find((e) => e.id === id)
  const [k, setK] = useState<'loan' | 'card'>(x?.kind ?? kind ?? 'loan')
  const [name, setName] = useState(x?.name ?? '')
  const [lender, setLender] = useState(x?.lender ?? '')
  const [principal, setPrincipal] = useState(x ? String(x.principal) : '')
  const [rate, setRate] = useState(x ? String(x.rate) : '')
  const [tenure, setTenure] = useState(x ? String(x.months % 12 === 0 && x.months >= 12 ? x.months / 12 : x.months) : '')
  const [unit, setUnit] = useState<'months' | 'years'>(x && x.months % 12 === 0 && x.months >= 12 ? 'years' : k === 'card' ? 'months' : 'years')
  const [started, setStarted] = useState<'yes' | 'no'>(x ? (x.first < TODAY ? 'yes' : 'no') : 'no')
  const [first, setFirst] = useState(x?.first ?? iso(addMonthsDate(NOW, 1)))
  const [own, setOwn] = useState(x?.emi ? String(x.emi) : '')
  const [account, setAccount] = useState(x?.account ?? s.accounts.find((a) => a.type === 'everyday')?.id ?? s.accounts[0].id)
  const [err, setErr] = useState('')
  const months = Math.round((parseFloat(tenure) || 0) * (unit === 'years' ? 12 : 1))
  const draft: Emi = { id: x?.id ?? 'new', name: name.trim(), kind: k, lender: lender.trim() || undefined, principal: parseFloat(principal) || 0, rate: parseFloat(rate) || 0, months, first, emi: parseFloat(own) > 0 ? parseFloat(own) : undefined, account, ruleId: x?.ruleId }
  const ok = draft.principal > 0 && months > 0 && months <= 600 && /^\d{4}-\d{2}-\d{2}$/.test(first)
  const st = ok ? emiStatus(draft) : null
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.name) return setErr(k === 'card' ? 'What did you buy? For example "Phone".' : 'Give it a name, like "Car loan".')
    if (!(draft.principal > 0)) return setErr('How much did you borrow?')
    if (!(draft.rate >= 0 && draft.rate <= 60)) return setErr('Enter the yearly interest rate, between 0 and 60%.')
    if (!(months > 0 && months <= 600)) return setErr('How long is it for? Between 1 month and 50 years.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(first)) return setErr('Pick the date of the first EMI.')
    if (started === 'yes' && first >= TODAY) return setErr('You said some EMIs are already paid, so the first one was before today.')
    if (started === 'no' && first < TODAY) return setErr('That date is in the past. If you have already paid some EMIs, choose "Yes" above.')
    const cat = s.categories.find((c) => c.id === 'debt')?.id ?? s.categories.find((c) => c.kind === 'expense')!.id
    const prev = update((d) => {
      const old = d.rules.find((r) => r.id === x?.ruleId)
      // instalments before you started tracking this one aren't added as past spending
      const rule = emiRule(draft, old?.start ?? TODAY, old, cat)
      const e2: Emi = { ...draft, id: x?.id ?? uid(), ruleId: rule?.id ?? old?.id }
      // a finished loan keeps the EMIs already on record
      if (rule) { d.rules = d.rules.filter((r) => r.id !== rule.id); d.rules.push(rule) }
      if (x) d.emis[d.emis.findIndex((y) => y.id === x.id)] = e2
      else d.emis.push(e2)
    })
    done(x ? 'Saved' : `${draft.name} added. Its EMIs are on your calendar.`, prev)
  }
  const remove = () => {
    const prev = update((d) => {
      d.emis = d.emis.filter((y) => y.id !== x!.id)
      // keep EMIs already on record; stop future ones
      const r = d.rules.find((y) => y.id === x!.ruleId)
      if (r) { if (r.start >= TODAY) d.rules = d.rules.filter((y) => y !== r); else r.end = iso(addDays(NOW, -1)) }
    })
    done('Removed. EMIs already on record are kept.', prev)
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {!x && <Segmented label="Type" value={k} onChange={(v) => { setK(v); if (!tenure) setUnit(v === 'card' ? 'months' : 'years') }} options={[['loan', 'Loan'], ['card', 'Card EMI']]} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={k === 'card' ? 'What did you buy?' : 'Name'}><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={k === 'card' ? 'e.g. Phone' : 'e.g. Car loan'} /></Field>
        <Field label={k === 'card' ? 'Which card? (optional)' : 'Bank or lender (optional)'}><input className="field" value={lender} onChange={(e) => setLender(e.target.value)} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={k === 'card' ? 'Amount converted to EMI' : 'Amount taken'}><input className="field" type="number" min="0" step="any" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></Field>
        <Field label="Interest per year (%)" hint={k === 'card' ? 'Use 0 for a no-cost EMI' : undefined}><input className="field" type="number" min="0" max="60" step="0.01" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        <Field label="Tenure"><div className="flex gap-2"><input className="field" type="number" min="1" step="1" inputMode="numeric" value={tenure} onChange={(e) => setTenure(e.target.value)} aria-label="Tenure" /><select className="field !w-auto" value={unit} onChange={(e) => setUnit(e.target.value as 'months' | 'years')} aria-label="Tenure in"><option value="months">months</option><option value="years">years</option></select></div></Field>
      </div>
      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-ink2">Have you already paid some EMIs?</p>
        <Segmented label="Already paid some EMIs" value={started} onChange={setStarted} options={[['no', 'No, not yet'], ['yes', 'Yes']]} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={started === 'yes' ? 'When was the first EMI paid?' : 'When is the first EMI due?'} hint="EMIs then fall on the same date each month"><input className="field" type="date" value={first} max={started === 'yes' ? iso(addDays(NOW, -1)) : undefined} min={started === 'no' ? TODAY : undefined} onChange={(e) => setFirst(e.target.value)} /></Field>
        <Field label="Paid from"><select className="field" value={account} onChange={(e) => setAccount(e.target.value)}>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      </div>
      {st && (
        <div className="rounded-2xl bg-accent-soft p-4 text-[14px]" aria-live="polite">
          <p>Your EMI: <b className="font-display text-[20px]">{money2(st.emi)}</b> a month for {months} months</p>
          <ul className="mt-2 grid gap-1 text-[13.5px] sm:grid-cols-2">
            <li>Total interest: <b>{money(st.interestTotal)}</b></li>
            <li>Total you'll pay: <b>{money(st.totalPayable)}</b></li>
            <li>EMIs paid so far: <b>{st.done} of {months}</b></li>
            <li>{st.thisMonth ? <>This month: <b>EMI {st.thisMonth.n}</b> on {fmtDate(st.thisMonth.date)}</> : st.next ? <>Next: <b>EMI {st.next.n}</b> on {fmtDate(st.next.date)}</> : <>All EMIs paid</>}</li>
            <li>Last EMI: <b>{fmtDate(st.last, { day: 'numeric', month: 'long', year: 'numeric' })}</b></li>
            <li>Still owed today: <b>{money(st.owed)}</b></li>
          </ul>
        </div>
      )}
      <Field label="EMI on your statement (optional)" hint="If your lender's EMI is slightly different, enter it here and SpendCop will use it."><input className="field" type="number" min="0" step="any" inputMode="decimal" value={own} onChange={(e) => setOwn(e.target.value)} /></Field>
      <Err msg={err} />
      <Foot>
        {x && <Button variant="danger" className="mr-auto" onClick={remove}><Trash2 size={16} />Remove</Button>}
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
  const [subs, setSubs] = useState((c?.subs ?? []).join(', '))
  const [err, setErr] = useState('')
  const used = c && (s.tx.some((t) => t.cat === c.id) || s.rules.some((r) => r.cat === c.id))
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Give it a name.')
    const v = { name: name.trim(), kind, group: kind === 'savings' ? ('future' as const) : group, plan: parseFloat(plan) || 0, icon, subs: [...new Set(subs.split(',').map((x) => x.trim()).filter(Boolean))] }
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
      <Field label="Sub-categories (optional)" hint="Separate with commas, e.g. Fuel, Parking, Train"><input className="field" value={subs} onChange={(e) => setSubs(e.target.value)} /></Field>
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
  ['What is "Safe to spend"?', "It's the money that's really free this month. SpendCop takes everything coming in, then subtracts what you've spent, what you've put aside and the bills that still have to go out. If you only spend from this number, your bills are always covered."],
  ['How do I track a trip or holiday?', 'Open Trips and create one with its dates and, if you like, a budget. Then, whenever you add an expense, tap the trip under "Part of a trip?". The expense still shows in Activity, your month and your plan as normal, with the trip\'s name next to it, and the trip page adds everything up: spent, left, per day, by category and who paid.'],
  ['How do I add something I bought?', 'Tap the big + button. Pick what it was (like Groceries), type the amount, and tap Add. That\'s it. You can press N on a keyboard too.'],
  ['What are regular items?', 'Things that repeat, like rent, your phone bill, subscriptions and your pay. Add them once under Bills and they appear every month by themselves. When one is paid, tap its tick box.'],
  ['What is a plan (budget)?', "A plan is how much you'd like to spend on each thing in a month. SpendCop shows how much is left in each 'pot' so you can slow down before you run out. Not sure what to plan? Tap 'Use this' to copy what you usually spend."],
  ['Essentials, extras and future you?', 'Essentials are needs (home, food shopping, energy). Extras are nice-to-haves (eating out, shopping, fun). Future you is money you save or invest. A common guide is 50% / 30% / 20%.'],
  ['What does the money health score mean?', 'A quick score out of 100 based on four good habits: staying within your plan, saving regularly, paying bills on time and having a safety cushion of about three months of essentials.'],
  ['Cheapest way or quick wins for debts?', 'Both pay the minimum on every debt. "Cheapest way" puts extra money on the debt with the highest interest, so you pay least overall. "Quick wins" clears the smallest debt first, which feels great and keeps you motivated.'],
  ['What is the Calendar for?', 'It shows your month day by day: what you spent, which bills are due, when pay arrives and how much is in your everyday account each day. Tap a day to see or add things.'],
  ['What is the Paycheck page?', "If you are paid weekly, every two weeks or on another schedule, it shows your money from one payday to the next: pay in, bills due before the next payday, and what's left."],
  ['Moving money or paying off a card', "Use Accounts → Move money. Moving money between your own accounts isn't spending, so it doesn't count against your plan. 'Pay off card' fills in what you owe."],
  ['One bill was different this month', 'Tap the bill in Activity, Calendar or Bills. You can change the amount or date for just that one, skip it, or mark it paid. The others stay the same.'],
  ['What are sub-categories?', 'Smaller groups inside a category, like Fuel and Parking inside Getting around. Pick one when you add spending, then see totals for each in Activity and My plan.'],
  ['I added something twice', "SpendCop warns you before you add the same amount for the same thing on nearly the same day, and marks possible doubles in Activity with 'twice?'."],
  ['Can I open my data in Excel or Google Sheets?', 'Yes. Go to My year or Settings and tap "Download Excel workbook". It has sheets for your year, categories, every transaction, bills, accounts, goals, debts and net worth. Google Sheets opens it via File → Import.'],
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
  const items: [View | 'help' | 'tour', string, string, typeof Goal][] = [
    ['calendar', 'Calendar', 'Your month day by day', CalendarDays], ['bills', 'Bills & pay', 'Things that repeat', CalendarClock],
    ['paycheck', 'Paycheck', 'Plan pay period by pay period', Banknote], ['year', 'My year', 'Totals, trends, reflection', BarChart3],
    ['trips', 'Trips', 'Holidays and their costs', Plane], ['goals', 'Goals', 'Save up for things', Goal], ['debts', 'Debts', 'Get debt-free faster', Scale], ['emis', 'Loans & EMIs', 'Instalments and what is left', Landmark],
    ['accounts', 'Accounts', 'Banks, cards and cash', Wallet], ['worth', "What I'm worth", 'Own minus owe', Landmark],
    ['household', 'Household', 'Who spends what', Users], ['settings', 'Settings', 'Names, currency, data', Cog],
    ['help', 'Help', 'Simple answers', HelpCircle], ['tour', 'Take the tour', 'A 1-minute walk-through', Compass],
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map(([v, t, d, I], i) => (
        <motion.button key={v} type="button" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.96 }}
          onClick={() => { if (v === 'help') open({ type: 'help' }); else if (v === 'tour') { close(); go('home'); setTimeout(() => useUI.getState().setTour(true), 400) } else { close(); go(v) } }}
          className="flex flex-col items-start gap-2 rounded-2xl bg-surface2 p-4 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><I size={20} /></span>
          <span className="font-bold">{t}</span><span className="-mt-1.5 text-[13px] text-ink2">{d}</span>
        </motion.button>
      ))}
    </div>
  )
}

/* ---------------- a single payment of a regular item ---------------- */
function OccForm({ ruleId, date }: { ruleId: string; date: string }) {
  const s = useData()
  const open = useUI((u) => u.open)
  const r = s.rules.find((x) => x.id === ruleId)
  const key = ruleKey(ruleId, date)
  const ov = s.overrides[key] ?? {}
  const [amount, setAmount] = useState(String(ov.amount ?? r?.amount ?? ''))
  const [when, setWhen] = useState(ov.date ?? date)
  if (!r) return <p>This item no longer exists.</p>
  const paid = isPaid(s, r, date)
  const save = () => {
    const a = parseFloat(amount)
    const prev = update((d) => {
      const o: { amount?: number; date?: string } = {}
      if (a > 0 && a !== r.amount) o.amount = a
      if (when && when !== date) o.date = when
      if (Object.keys(o).length) d.overrides[key] = o; else delete d.overrides[key]
    })
    done('Saved for this payment only', prev)
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl bg-surface2 p-3"><CatIcon cat={catOf(s, r.cat)} /><div className="flex-1"><p className="font-bold">{r.name}</p><p className="text-[13px] text-ink2">Usually {money(r.amount)} · {FREQ[r.freq].label.toLowerCase()}</p></div></div>
      <p className="text-[14.5px] text-ink2">Was this one different? Change just this payment. The others stay the same.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount this time"><input className="field" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Date this time"><input className="field" type="date" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { const prev = update((d) => { d.paid[key] = !paid }); done(paid ? 'Marked as not paid' : 'Marked as paid', prev) }}>{paid ? 'Mark as not paid' : r.type === 'income' ? 'Mark as received' : 'Mark as paid'}</Button>
        <Button onClick={() => { const prev = update((d) => { d.skip[key] = true }); done('Skipped this one', prev) }}>Skip this one</Button>
        {s.overrides[key] && <Button variant="ghost" onClick={() => { const prev = update((d) => { delete d.overrides[key] }); done('Back to the usual amount and date', prev) }}>Undo change</Button>}
      </div>
      <Foot>
        <Button variant="ghost" className="mr-auto" onClick={() => open({ type: 'bill', id: r.id })}><Repeat size={16} />Edit every payment</Button>
        <Button variant="primary" onClick={save}>Save this one</Button>
      </Foot>
    </div>
  )
}

/* ---------------- transfers ---------------- */
function TransferForm({ id, from, to }: { id?: string; from?: string; to?: string }) {
  const s = useData()
  const t = s.transfers.find((x) => x.id === id)
  const bal = balances(s)
  const [f, setF] = useState(t?.from ?? from ?? s.accounts[0]?.id)
  const [tt, setT] = useState(t?.to ?? to ?? s.accounts.find((a) => a.id !== (from ?? s.accounts[0]?.id))?.id ?? '')
  const owed = -(bal[tt] || 0)
  const [amount, setAmount] = useState(t ? String(t.amount) : to && owed > 0 ? String(Math.round(owed * 100) / 100) : '')
  const [date, setDate] = useState(t?.date ?? TODAY)
  const [note, setNote] = useState(t?.note ?? (s.accounts.find((a) => a.id === tt)?.type === 'card' ? 'Credit card payment' : ''))
  const [err, setErr] = useState('')
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const a = parseFloat(amount)
    if (!(a > 0)) return setErr('How much did you move?')
    if (f === tt) return setErr('Choose two different accounts.')
    const v = { from: f, to: tt, amount: a, date, note: note.trim() }
    const prev = update((d) => { if (t) Object.assign(d.transfers.find((x) => x.id === t.id)!, v); else d.transfers.push({ id: uid(), ...v }) })
    done(t ? 'Saved' : `Moved ${money(a)}`, prev)
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <p className="text-[14.5px] text-ink2">Moving money between your own accounts isn't spending, so it won't touch your plan. Use this for paying off a card or topping up savings by hand.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From"><select className="field" value={f} onChange={(e) => setF(e.target.value)}>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({money(bal[a.id] || 0)})</option>)}</select></Field>
        <Field label="To"><select className="field" value={tt} onChange={(e) => setT(e.target.value)}>{s.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({money(bal[a.id] || 0)})</option>)}</select></Field>
        <Field label="Amount" hint={owed > 0 ? <button type="button" className="font-semibold text-accent" onClick={() => setAmount(String(Math.round(owed * 100) / 100))}>Pay off all {money(owed)}</button> : undefined}><input className="field" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Date"><input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Note (optional)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Err msg={err} />
      <Foot>
        {t && <Button variant="danger" className="mr-auto" onClick={() => { const prev = update((d) => { d.transfers = d.transfers.filter((x) => x.id !== t.id) }); done('Transfer deleted', prev) }}><Trash2 size={16} />Delete</Button>}
        <Button type="submit" variant="primary">{t ? 'Save' : 'Move money'}</Button>
      </Foot>
    </form>
  )
}

/* ---------------- import / export ---------------- */
function CsvImport() {
  const s = useData()
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [skipDupes, setSkipDupes] = useState(true)
  const check = async () => {
    if (!text.trim()) return setErr('Choose a file or paste the text first.')
    setErr(''); setProgress(0)
    const res = await prepareImport(s, text, (d, t) => setProgress(t ? d / t : 1))
    setProgress(null)
    if (typeof res === 'string') return setErr(res)
    setPlan(res)
  }
  const commit = () => {
    if (!plan) return
    let n = 0
    const prev = update((d) => { n = commitImport(d, plan, skipDupes) })
    done(`Imported ${n.toLocaleString()} item${n === 1 ? '' : 's'}`, prev)
  }
  if (plan) {
    const adding = plan.rows.filter((r) => !(skipDupes && r.dup)).length
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-good-soft p-3"><p className="font-display text-[24px] font-bold text-good">{plan.rows.length.toLocaleString()}</p><p className="text-[12.5px] text-ink2">rows look good</p></div>
          <div className="rounded-2xl bg-warn-soft p-3"><p className="font-display text-[24px] font-bold text-warn">{plan.dupCount.toLocaleString()}</p><p className="text-[12.5px] text-ink2">may already be in SpendCop</p></div>
          <div className="rounded-2xl bg-bad-soft p-3"><p className="font-display text-[24px] font-bold text-bad">{plan.invalid.length.toLocaleString()}</p><p className="text-[12.5px] text-ink2">can't be read</p></div>
        </div>
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead><tr className="label text-left"><th className="py-1.5">Date</th><th>Description</th><th>Type</th><th className="text-right">Amount</th></tr></thead>
            <tbody>{plan.rows.slice(0, 8).map((r) => (
              <tr key={r.line} className={`border-t border-line ${r.dup ? 'opacity-60' : ''}`}><td className="py-1.5 tnum">{r.date}</td><td className="max-w-[180px] truncate">{r.note || r.catName || '—'}{r.dup && <span className="ml-1 text-warn">(already there?)</span>}</td><td>{KIND_WORD[r.type]}</td><td className="tnum text-right">{money(r.amount)}</td></tr>
            ))}</tbody>
          </table>
          {plan.rows.length > 8 && <p className="mt-1 text-[12.5px] text-muted">…and {(plan.rows.length - 8).toLocaleString()} more</p>}
        </div>
        {plan.invalid.length > 0 && <details className="rounded-2xl border border-line p-3 text-[13px]"><summary className="cursor-pointer font-semibold text-bad">Rows that will be left out ({plan.invalid.length})</summary><ul className="mt-2 max-h-32 overflow-auto text-ink2">{plan.invalid.slice(0, 50).map((x) => <li key={x.line}>Line {x.line}: {x.reason}</li>)}</ul></details>}
        {plan.newCats.length > 0 && <p className="text-[13px] text-ink2">New categories will be created: {plan.newCats.slice(0, 8).join(', ')}{plan.newCats.length > 8 ? '…' : ''}</p>}
        {plan.newTrips.length > 0 && <p className="text-[13px] text-ink2">New trips will be created from the Trip column: {plan.newTrips.slice(0, 6).join(', ')}{plan.newTrips.length > 6 ? '…' : ''}</p>}
        {plan.dupCount > 0 && <label className="flex items-center gap-2 text-[14px] font-medium"><input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /> Skip the {plan.dupCount} that may already be in SpendCop (same date and amount)</label>}
        <Foot><Button variant="ghost" className="mr-auto" onClick={() => setPlan(null)}>Back</Button><Button variant="primary" onClick={commit} disabled={!adding}>Import {adding.toLocaleString()} item{adding === 1 ? '' : 's'}</Button></Foot>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14.5px] text-ink2">Most banks let you download your transactions as a CSV file. Choose that file here. SpendCop reads the date, description and amount (and category, type or person if present). Negative amounts count as money out. You'll see a preview before anything is added.</p>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line2 p-6 text-center hover:border-accent">
        <Upload className="text-accent" /><span className="font-semibold">Choose a CSV file</span><span className="text-[13px] text-muted">or paste the text below</span>
        <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setText(String(r.result)); r.readAsText(f) }} />
      </label>
      <textarea className="field min-h-[140px] font-mono text-[12.5px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Date,Description,Amount\n2026-10-02,Supermarket,-54.20'} aria-label="CSV text" />
      {progress != null && <div className="flex items-center gap-3 text-[13px] text-ink2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2"><motion.div className="h-full bg-accent" animate={{ width: `${progress * 100}%` }} /></div>Checking rows…</div>}
      <Err msg={err} />
      <Foot><Button variant="primary" onClick={check} disabled={progress != null}>Check file</Button></Foot>
    </div>
  )
}
/* ---------------- export: a month (or more) as a PDF report or a CSV file ---------------- */
function Export({ month }: { month?: string }) {
  const s = useData()
  const [fmt, setFmt] = useState<'pdf' | 'csv'>('pdf')
  const [range, setRange] = useState<'month' | 'year' | 'all'>('month')
  const [k, setK] = useState(month ?? THIS_MONTH)
  const [busy, setBusy] = useState(false)
  const ok = /^\d{4}-\d{2}$/.test(k)
  const span = range === 'month' ? [`${k}-01`, monthEnd(k)] : range === 'year' ? [`${k.slice(0, 4)}-01-01`, `${k.slice(0, 4)}-12-31`] : ['1900-01-01', '2999-12-31']
  const n = ok ? itemsIn(s, span[0], span[1]).length : 0
  const go = async () => {
    setBusy(true)
    try {
      let r
      if (fmt === 'pdf') {
        const { monthlyReport } = await import('../lib/report')
        r = await saveFile(`spendcop-${k}.pdf`, await monthlyReport(s, k))
      } else {
        const name = range === 'month' ? k : range === 'year' ? k.slice(0, 4) : 'all'
        r = await saveFile(`spendcop-${name}.csv`, new Blob([toCsvRange(s, span[0], span[1])], { type: 'text/csv;charset=utf-8' }))
      }
      if (r === 'saved') done(fmt === 'pdf' ? `Your ${monthName(k)} report is ready` : 'Your CSV file is ready')
      else toast(r === 'declined' ? 'Download cancelled' : 'Could not save the file here')
    } catch { toast("Couldn't make the file. Try again.") } finally { setBusy(false) }
  }
  return (
    <div className="flex flex-col gap-5">
      <div><p className="mb-2 text-[13.5px] font-semibold text-ink2">Format</p>
        <Segmented label="Format" value={fmt} onChange={setFmt} options={[['pdf', <><FileText size={15} />PDF report</>], ['csv', <><FileSpreadsheet size={15} />CSV file</>]]} /></div>
      {fmt === 'csv' && <div><p className="mb-2 text-[13.5px] font-semibold text-ink2">Which entries</p>
        <Segmented label="Which entries" value={range} onChange={setRange} options={[['month', 'One month'], ['year', 'Whole year'], ['all', 'Everything']]} /></div>}
      {(fmt === 'pdf' || range !== 'all') && <Field label={fmt === 'csv' && range === 'year' ? 'Year (pick any month in it)' : 'Month'}><input className="field !w-[200px]" type="month" value={k} onChange={(e) => setK(e.target.value)} /></Field>}
      <div className="rounded-2xl bg-surface2 p-4 text-[14px] text-ink2">
        {fmt === 'pdf'
          ? <>A printable report for <b className="text-ink">{ok ? monthName(k) : '…'}</b>: the month at a glance, plan vs spending, bills and pay, loans and EMIs, goals and every entry.</>
          : <>{n.toLocaleString()} entr{n === 1 ? 'y' : 'ies'}{range === 'month' && ok ? ` in ${monthName(k)}` : range === 'year' && ok ? ` in ${k.slice(0, 4)}` : ''}, with date, description, type, category, account, person, amount and whether it's paid or still due. Opens in Excel or Google Sheets.</>}
        <span className="mt-1 block text-[12.5px] text-muted">Made on this device. Nothing is uploaded.</span>
      </div>
      <Foot><Button variant="primary" onClick={go} disabled={!ok && range !== 'all' || busy}><Download size={16} />{busy ? 'Making file…' : fmt === 'pdf' ? 'Export PDF' : 'Export CSV'}</Button></Foot>
    </div>
  )
}

function Backup() {
  const s = useData()
  const [tab, setTab] = useState<'excel' | 'csv' | 'json' | 'restore'>('excel')
  const [paste, setPaste] = useState('')
  const [err, setErr] = useState('')
  const text = useMemo(() => (tab === 'csv' ? toCsv(s) : tab === 'json' ? JSON.stringify(s) : ''), [tab, s])
  const ref = useRef<HTMLTextAreaElement>(null)
  const copy = () => navigator.clipboard?.writeText(text).then(() => { if (tab === 'json') update((d) => { d.settings.lastBackup = new Date().toISOString() }); toast('Copied') }, () => { ref.current?.select(); toast('Press Ctrl+C (or ⌘C) to copy') }) ?? (ref.current?.select(), toast('Press Ctrl+C (or ⌘C) to copy'))
  const download = async () => {
    const r = tab === 'excel' ? await saveFile(`spendcop-${THIS_MONTH.slice(0, 4)}.xlsx`, await workbook(s, +THIS_MONTH.slice(0, 4)))
      : await saveFile(tab === 'csv' ? 'spendcop-activity.csv' : 'spendcop-backup.json', text)
    if (r === 'saved' && tab === 'json') update((d) => { d.settings.lastBackup = new Date().toISOString() })
    toast(r === 'saved' ? 'File ready' : r === 'declined' ? 'Download cancelled' : 'Downloads are blocked here. Use Copy instead.')
  }
  const [found, setFound] = useState<{ state: State; summary: string } | null>(null)
  const restore = () => {
    let x: unknown
    try { x = JSON.parse(paste) } catch { return setErr('That text could not be read. Paste the whole backup.') }
    const r = checkBackup(x)
    if (!r.ok) return setErr(r.reason)
    setErr(''); setFound({ state: r.state, summary: r.summary })
  }
  const confirmRestore = () => {
    if (!found) return
    const before = useStore.getState().data
    replaceData(found.state)
    done('Backup restored. Undo brings back what you had before.', before)
  }
  return (
    <div className="flex flex-col gap-4">
      <Segmented label="What" value={tab} onChange={setTab} options={[['excel', 'Excel workbook'], ['csv', 'CSV'], ['json', 'Full backup'], ['restore', 'Restore']]} className="self-start" />
      {tab === 'excel' ? (
        <>
          <div className="flex items-start gap-3 rounded-2xl bg-surface2 p-4"><FileSpreadsheet className="shrink-0 text-good" /><p className="text-[14.5px] text-ink2">A workbook for Excel or Google Sheets with a sheet each for your year summary, categories by month, every transaction, regular bills, accounts, goals, debts and net worth.</p></div>
          <Foot><Button variant="primary" onClick={download}><Download size={16} />Download Excel file</Button></Foot>
        </>
      ) : tab === 'restore' ? (
        <>
          <p className="text-[14.5px] text-ink2">Paste a full backup here. It replaces what's in SpendCop now.</p>
          <textarea className="field min-h-[160px] font-mono text-[12px]" value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Backup text" />
          <Err msg={err} />
          {found ? (
            <div className="rounded-2xl border border-warn bg-warn-soft p-4 text-[14px]">
              <p className="font-semibold">This backup has {found.summary}</p>
              <p className="mt-1 text-ink2">Restoring replaces everything in SpendCop now. You can undo straight afterwards.</p>
              <Foot><Button variant="ghost" onClick={() => setFound(null)}>Cancel</Button><Button variant="danger" onClick={confirmRestore}>Replace my data</Button></Foot>
            </div>
          ) : <Foot><Button variant="primary" onClick={restore}>Check backup</Button></Foot>}
        </>
      ) : (
        <>
          <p className="text-[14.5px] text-ink2">{tab === 'csv' ? 'Everything you have paid or received, ready for Excel or Google Sheets.' : 'A complete copy of your SpendCop. Keep it somewhere safe, or use it to move to another device.'}</p>
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

