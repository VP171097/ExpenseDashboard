import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import { produce, setAutoFreeze } from 'immer'
import { askPersistent, localFirstStorage, onSave } from './storage'
import { addMonths, THIS_MONTH } from './dates'
import { worthNow } from './calc'
import type { Kind, State, Tx } from './types'

export function upgrade(d: State | null): State | null {
  if (!d) return d
  d.transfers ??= []
  d.trips ??= []
  d.overrides ??= {}
  d.reflections ??= {}
  d.settings.payAnchor ??= THIS_MONTH + '-01'
  d.settings.payDays ??= 14
  d.settings.effects ??= 'full'
  d.emis ??= []
  d.settings.salaryNextMonth ??= true
  d.settings.offDays ??= [0, 6]
  // copies from before payday rules: keep paying on the day of the month already set
  d.settings.payday ??= { rule: 'date', day: +d.settings.payAnchor.slice(8, 10) || 1, shift: 'before' }
  // light is the default look; anyone who later picks "match device" keeps it
  if (!d.settings.themeV) { if (d.settings.theme === 'system') d.settings.theme = 'light'; d.settings.themeV = 2 }
  return d
}
/** Record this month's net worth so the history chart has a point for it. */
function stamp(d: State) {
  const w = worthNow(d)
  d.history[THIS_MONTH] = { own: Math.round(w.own), owe: Math.round(w.owe) }
}

setAutoFreeze(false)

interface DataStore {
  data: State | null
  hydrated: boolean
  saveError: string | null
  /** Apply a change. Unchanged records are shared, not copied. Returns the previous data for undo. */
  update: (fn: (d: State) => void) => State | null
  replace: (d: State | null) => void
}
export const useStore = create<DataStore>()(
  persist(
    (set, get) => ({
      data: null,
      hydrated: false,
      saveError: null,
      update: (fn) => {
        const cur = get().data
        if (!cur) return null
        set({ data: produce(cur, fn) })
        return cur
      },
      replace: (d) => { if (d) { upgrade(d); stamp(d) } set({ data: d }) },
    }),
    {
      name: 'tally.v2', storage: localFirstStorage as unknown as PersistStorage<{ data: State | null }>, partialize: (s) => ({ data: s.data }),
      // fill in fields added after a backup or an earlier visit was saved
      merge: (saved, current) => ({ ...current, data: upgrade((saved as { data?: State | null })?.data ?? null) }),
      onRehydrateStorage: () => () => {
        const d = useStore.getState().data
        if (d) useStore.setState({ data: produce(d, stamp) })
        useStore.setState({ hydrated: true })
        confirmed = useStore.getState().data
        if (d) askPersistent()
      },
    },
  ),
)

/* If a save fails, undo the unsaved change on screen and say why, so what you see is what is stored. */
let confirmed: State | null = null
let queued: State | null = null
useStore.subscribe((s) => { queued = s.data })
onSave((ok, _where, error) => {
  if (ok) { confirmed = queued; if (useStore.getState().saveError) useStore.setState({ saveError: null }); return }
  const msg = error === 'quota' ? 'This browser is out of storage space for SpendCop.' : 'This browser would not let SpendCop save.'
  const cur = useStore.getState().data
  if (confirmed && cur !== confirmed) useStore.setState({ data: confirmed })
  useStore.setState({ saveError: msg })
  toast(`${msg} Your last change was undone. Download a backup from Settings to keep your data safe.`)
})

export const useData = () => useStore((s) => s.data) as State
export const update = (fn: (d: State) => void) => useStore.getState().update(fn)
export const replaceData = (d: State | null) => useStore.getState().replace(d)

export type View = 'home' | 'activity' | 'calendar' | 'plan' | 'paycheck' | 'year' | 'bills' | 'goals' | 'debts' | 'emis' | 'accounts' | 'worth' | 'household' | 'trips' | 'settings'
export type SheetSpec =
  | { type: 'quick'; edit?: Tx; date?: string; kind?: Kind; trip?: string }
  | { type: 'bill'; id?: string }
  | { type: 'goal'; id?: string }
  | { type: 'trip'; id?: string }
  | { type: 'debt'; id?: string }
  | { type: 'emi'; id?: string; kind?: 'loan' | 'card' }
  | { type: 'holding'; id?: string; kind?: 'own' | 'owe' }
  | { type: 'account'; id?: string }
  | { type: 'category'; id?: string }
  | { type: 'help' }
  | { type: 'more' }
  | { type: 'csv' }
  | { type: 'backup' }
  | { type: 'confirm'; title: string; text: string; label: string; run: () => void }
  | { type: 'occ'; ruleId: string; date: string }
  | { type: 'transfer'; id?: string; from?: string; to?: string }

export interface Filter {
  q: string; type: '' | Kind | 'bills'; cat: string; sub: string; person: string; status: '' | 'paid' | 'upcoming'
  group: '' | 'essentials' | 'extras' | 'future'; account: string; trip: string; scope: 'month' | 'year' | 'all' | 'range'; from: string; to: string
  sort: 'newest' | 'oldest' | 'biggest' | 'smallest'
}
export const EMPTY_FILTER: Filter = { q: '', type: '', cat: '', sub: '', person: '', status: '', group: '', account: '', trip: '', scope: 'month', from: '', to: '', sort: 'newest' }
interface UIStore {
  view: View
  month: string
  sheet: SheetSpec | null
  filter: Filter
  tour: boolean
  setTour: (v: boolean) => void
  go: (v: View) => void
  setMonth: (k: string) => void
  shiftMonth: (n: number) => void
  open: (s: SheetSpec) => void
  close: () => void
  setFilter: (f: Partial<UIStore['filter']>) => void
}
const savedView = (() => { try { return (localStorage.getItem('tally.view') as View) || 'home' } catch { return 'home' as View } })()
export const useUI = create<UIStore>()((set) => ({
  view: savedView,
  month: THIS_MONTH,
  sheet: null,
  filter: { ...EMPTY_FILTER },
  tour: false,
  setTour: (tour) => set({ tour }),
  go: (view) => { set({ view }); try { localStorage.setItem('tally.view', view) } catch { /* ignore */ } window.scrollTo({ top: 0, behavior: 'smooth' }) },
  setMonth: (month) => set({ month }),
  shiftMonth: (n) => set((s) => ({ month: addMonths(s.month, n) })),
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
}))

export interface ToastMsg { id: number; text: string; undo?: State | null; tone?: 'good' | 'info' }
interface ToastStore { toasts: ToastMsg[]; push: (text: string, undo?: State | null, tone?: ToastMsg['tone']) => void; drop: (id: number) => void }
let tid = 0
export const useToasts = create<ToastStore>()((set) => ({
  toasts: [],
  push: (text, undo, tone = 'info') => {
    const id = ++tid
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, undo, tone }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), undo ? 6500 : 3500)
  },
  drop: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
export const toast = (text: string, undo?: State | null, tone?: ToastMsg['tone']) => useToasts.getState().push(text, undo, tone)
