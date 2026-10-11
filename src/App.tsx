import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarClock, ChevronLeft, ChevronRight, Goal, HelpCircle, Home as HomeIcon, Landmark, LayoutGrid, Plus, ReceiptText, Scale, Settings as Cog, Sparkles, Wallet, X,
} from 'lucide-react'
import { useEffect } from 'react'
import Sheets from './components/Sheets'
import { Button } from './components/ui'
import { monthName, THIS_MONTH } from './lib/dates'
import { setCurrency } from './lib/money'
import { replaceData, update, useStore, useToasts, useUI, type View } from './lib/store'
import Activity from './screens/Activity'
import Bills from './screens/Bills'
import Debts from './screens/Debts'
import Goals from './screens/Goals'
import Home from './screens/Home'
import Onboarding from './screens/Onboarding'
import Plan from './screens/Plan'
import Settings from './screens/Settings'
import Worth from './screens/Worth'

const NAV: { id: View; label: string; icon: typeof HomeIcon; sub: string; month?: boolean }[] = [
  { id: 'home', label: 'Home', icon: HomeIcon, sub: '', month: true },
  { id: 'activity', label: 'Activity', icon: ReceiptText, sub: 'Everything that came in or went out.', month: true },
  { id: 'plan', label: 'My plan', icon: Wallet, sub: 'Decide how much to spend on each thing, then see how you are doing.', month: true },
  { id: 'bills', label: 'Bills & pay', icon: CalendarClock, sub: 'Things that repeat every week, month or year. Set them once.', month: true },
  { id: 'goals', label: 'Goals', icon: Goal, sub: 'Save up for the things that matter to you.', month: true },
  { id: 'debts', label: 'Debts', icon: Scale, sub: 'See when you will be free of loans and cards, and how to get there faster.' },
  { id: 'worth', label: "What I'm worth", icon: Landmark, sub: 'Everything you own minus everything you owe.' },
  { id: 'settings', label: 'Settings', icon: Cog, sub: 'Names, currency, accounts and your data.' },
]
const SCREENS: Record<View, () => JSX.Element> = { home: Home, activity: Activity, plan: Plan, bills: Bills, goals: Goals, debts: Debts, worth: Worth, settings: Settings }

export default function App() {
  const data = useStore((s) => s.data)
  const theme = data?.settings.theme ?? 'system'
  useEffect(() => {
    const r = document.documentElement
    if (theme === 'system') delete r.dataset.theme
    else r.dataset.theme = theme
  }, [theme])
  if (data) setCurrency(data.settings.currency)
  return (
    <>
      {data ? <Shell /> : <Onboarding />}
      <Toaster />
    </>
  )
}

function Shell() {
  const { view, go, open } = useUI()
  const sample = useStore((s) => s.data?.sample)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey || useUI.getState().sheet) return
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); open({ type: 'quick' }) }
      else if (e.key === '[') useUI.getState().shiftMonth(-1)
      else if (e.key === ']') useUI.getState().shiftMonth(1)
      else if (e.key === '?') open({ type: 'help' })
      else { const n = +e.key; if (n >= 1 && n <= NAV.length) go(NAV[n - 1].id) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [go, open])
  const Screen = SCREENS[view]
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <Sidebar />
      <main className="min-w-0 px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-14 lg:pt-8">
        <TopBar />
        <AnimatePresence>{sample && <SampleBanner />}</AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <Screen />
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar />
      <Sheets />
    </div>
  )
}

function Sidebar() {
  const { view, go, open } = useUI()
  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-6 bg-cover px-4 py-6 text-cover-ink lg:flex">
      <div className="flex items-center gap-2.5 px-2 font-display text-[24px] font-extrabold">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-cover-ink text-cover"><Wallet size={18} /></span>Tally
      </div>
      <Button variant="primary" size="lg" onClick={() => open({ type: 'quick' })} className="!bg-cover-ink !text-cover !border-transparent">
        <Plus size={20} />Add money in or out
      </Button>
      <nav className="flex flex-col gap-1" aria-label="Sections">
        {NAV.map((n, i) => {
          const I = n.icon, on = view === n.id
          return (
            <button key={n.id} type="button" onClick={() => go(n.id)} aria-current={on ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold transition-colors ${on ? 'text-cover-ink' : 'text-cover-muted hover:text-cover-ink'}`}>
              {on && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-cover-hi" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <I size={19} className="relative" /><span className="relative flex-1">{n.label}</span><span className="relative text-[11px] opacity-50">{i + 1}</span>
            </button>
          )
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        <button type="button" onClick={() => open({ type: 'help' })} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold text-cover-muted hover:bg-cover-hi hover:text-cover-ink"><HelpCircle size={19} />Help & simple answers</button>
        <p className="px-3 text-[12px] leading-relaxed text-cover-muted">Press <b>N</b> to add · <b>[</b> <b>]</b> to change month. Saved only on this device.</p>
      </div>
    </aside>
  )
}

function TopBar() {
  const { view, month, shiftMonth, setMonth, open } = useUI()
  const n = NAV.find((x) => x.id === view)!
  return (
    <header className="mb-5 flex flex-wrap items-center gap-3 lg:mb-7">
      <div className="flex min-w-0 flex-[1_1_240px] items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cover text-cover-ink lg:hidden"><Wallet size={19} /></span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-tight sm:text-[32px]">{view === 'home' ? 'Your money' : n.label}</h1>
          <p className="text-[14.5px] text-ink2">{view === 'home' ? `How things look in ${monthName(month)}.` : n.sub}</p>
        </div>
      </div>
      {n.month && (
        <div className="flex items-center rounded-2xl border border-line bg-surface p-1 shadow-card">
          <button type="button" onClick={() => shiftMonth(-1)} className="grid h-9 w-9 place-items-center rounded-xl text-ink2 hover:bg-surface2 hover:text-ink" aria-label="Previous month"><ChevronLeft size={18} /></button>
          <AnimatePresence mode="wait">
            <motion.span key={month} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="min-w-[128px] text-center font-semibold">{monthName(month)}</motion.span>
          </AnimatePresence>
          <button type="button" onClick={() => shiftMonth(1)} className="grid h-9 w-9 place-items-center rounded-xl text-ink2 hover:bg-surface2 hover:text-ink" aria-label="Next month"><ChevronRight size={18} /></button>
          {month !== THIS_MONTH && <button type="button" onClick={() => setMonth(THIS_MONTH)} className="ml-1 rounded-xl px-2.5 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent-soft">Today</button>}
        </div>
      )}
      <Button variant="ghost" className="hidden sm:inline-flex lg:hidden" onClick={() => open({ type: 'help' })}><HelpCircle size={18} />Help</Button>
    </header>
  )
}

function SampleBanner() {
  const open = useUI((u) => u.open)
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-accent-soft px-4 py-3">
        <Sparkles size={18} className="shrink-0 text-accent" />
        <p className="min-w-[200px] flex-1 text-[14.5px]">You're looking at <b>example data</b> for Alex and Sam. Tap around, nothing can break. When you're ready, set up your own.</p>
        <Button size="sm" variant="primary" onClick={() => open({ type: 'confirm', title: 'Set up your own money?', text: 'The example data will be cleared and you will go through a short setup.', label: 'Start setup', run: () => replaceData(null) })}>Use my own money</Button>
        <Button size="sm" variant="ghost" onClick={() => update((d) => { d.sample = false })}>Hide</Button>
      </div>
    </motion.div>
  )
}

function TabBar() {
  const { view, go, open } = useUI()
  const tabs: [View | 'more', string, typeof HomeIcon][] = [['home', 'Home', HomeIcon], ['activity', 'Activity', ReceiptText], ['plan', 'Plan', Wallet], ['more', 'More', LayoutGrid]]
  const moreOn = !['home', 'activity', 'plan'].includes(view)
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur lg:hidden" style={{ background: 'color-mix(in srgb, var(--surface) 92%, transparent)' }}>
      <div className="mx-auto grid max-w-md grid-cols-5 items-end">
        {tabs.slice(0, 2).map(([v, l, I]) => <Tab key={v} on={view === v} label={l} icon={I} onClick={() => go(v as View)} />)}
        <div className="flex justify-center">
          <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => open({ type: 'quick' })} aria-label="Add money in or out"
            className="-mt-7 grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-ink shadow-pop ring-4 ring-[var(--bg)]">
            <Plus size={30} strokeWidth={2.5} />
          </motion.button>
        </div>
        {tabs.slice(2).map(([v, l, I]) => <Tab key={v} on={v === 'more' ? moreOn : view === v} label={l} icon={I} onClick={() => (v === 'more' ? open({ type: 'more' }) : go(v as View))} />)}
      </div>
    </nav>
  )
}
function Tab({ on, label, icon: I, onClick }: { on: boolean; label: string; icon: typeof HomeIcon; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined} className={`relative flex flex-col items-center gap-0.5 py-1 text-[11.5px] font-semibold ${on ? 'text-accent' : 'text-muted'}`}>
      {on && <motion.span layoutId="tab-dot" className="absolute -top-2 h-1 w-8 rounded-full bg-accent" />}
      <I size={22} />{label}
    </button>
  )
}

function Toaster() {
  const { toasts, drop } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-[14.5px] shadow-pop" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
            <span className="flex-1">{t.text}</span>
            {t.undo && <button type="button" className="rounded-lg border px-3 py-1 font-semibold" style={{ borderColor: 'color-mix(in srgb, var(--bg) 35%, transparent)' }} onClick={() => { replaceData(t.undo!); drop(t.id) }}>Undo</button>}
            <button type="button" aria-label="Dismiss" onClick={() => drop(t.id)} className="opacity-60 hover:opacity-100"><X size={16} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

