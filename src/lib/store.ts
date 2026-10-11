import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { addMonths, THIS_MONTH } from './dates'
import { worthNow } from './calc'
import type { Kind, State, Tx } from './types'

const safeStorage = {
  getItem: (n: string) => { try { return localStorage.getItem(n) } catch { return null } },
  setItem: (n: string, v: string) => { try { localStorage.setItem(n, v) } catch { /* storage unavailable */ } },
  removeItem: (n: string) => { try { localStorage.removeItem(n) } catch { /* storage unavailable */ } },
}

export function upgrade(d: State | null): State | null {
  if (!d) return d
  d.transfers ??= []
  d.overrides ??= {}
  d.reflections ??= {}
  d.settings.payAnchor ??= THIS_MONTH + '-01'
  d.settings.payDays ??= 14
  return d
}
function stamp(d: State) {
  const w = worthNow(d)
  d.history[THIS_MONTH] = { own: Math.round(w.own), owe: Math.round(w.owe) }
}

interface DataStore {
  data: State | null
  /** Apply a change to a copy of the data. Returns the previous data so the change can be undone. */
  update: (fn: (d: State) => void) => State | null
  replace: (d: State | null) => void
}
export const useStore = create<DataStore>()(
  persist(
    (set, get) => ({
      data: null,
      update: (fn) => {
        const cur = get().data
        if (!cur) return null
        const next = structuredClone(cur)
        fn(next)
        stamp(next)
        set({ data: next })
        return cur
      },
      replace: (d) => { if (d) { upgrade(d); stamp(d) } set({ data: d }) },
    }),
    {
      name: 'tally.v2', storage: createJSONStorage(() => safeStorage), partialize: (s) => ({ data: s.data }),
      // fill in fields added after a backup or an earlier visit was saved
      merge: (saved, current) => ({ ...current, data: upgrade((saved as { data?: State | null })?.data ?? null) }),
    },
  ),
)
export const useData = () => useStore((s) => s.data) as State
export const update = (fn: (d: State) => void) => useStore.getState().update(fn)
export const replaceData = (d: State | null) => useStore.getState().replace(d)

export type View = 'home' | 'activity' | 'calendar' | 'plan' | 'paycheck' | 'year' | 'bills' | 'goals' | 'debts' | 'accounts' | 'worth' | 'household' | 'settings'
export type SheetSpec =
  | { type: 'quick'; edit?: Tx; date?: string; kind?: Kind }
  | { type: 'bill'; id?: string }
  | { type: 'goal'; id?: string }
  | { type: 'debt'; id?: string }
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
  group: '' | 'essentials' | 'extras' | 'future'; account: string; scope: 'month' | 'year'; sort: 'newest' | 'oldest' | 'biggest' | 'smallest'
}
export const EMPTY_FILTER: Filter = { q: '', type: '', cat: '', sub: '', person: '', status: '', group: '', account: '', scope: 'month', sort: 'newest' }
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
