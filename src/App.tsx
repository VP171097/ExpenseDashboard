import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import {
  Banknote, BarChart3, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Compass, Goal, HelpCircle, Home as HomeIcon, Landmark, LayoutGrid, PiggyBank, Plus, ReceiptText, Scale, Settings as Cog, Sparkles, Users, Wallet, X, Moon, Sun, AlertTriangle, Check,
} from 'lucide-react'
import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import Sheets from './components/Sheets'
import { Button } from './components/ui'
import { monthName, THIS_MONTH } from './lib/dates'
import { setCurrency } from './lib/money'
import { replaceData, update, useStore, useToasts, useUI, type View } from './lib/store'
import Home from './screens/Home'
import Onboarding from './screens/Onboarding'
import Tour from './components/Tour'

/* Home loads with the app; every other screen loads the first time it is opened. */
const Activity = lazy(() => import('./screens/Activity'))
const Bills = lazy(() => import('./screens/Bills'))
const Debts = lazy(() => import('./screens/Debts'))
const Goals = lazy(() => import('./screens/Goals'))
const Plan = lazy(() => import('./screens/Plan'))
const Settings = lazy(() => import('./screens/Settings'))
const Worth = lazy(() => import('./screens/Worth'))
const Accounts = lazy(() => import('./screens/Accounts'))
const Calendar = lazy(() => import('./screens/Calendar'))
const Household = lazy(() => import('./screens/Household'))
const Paycheck = lazy(() => import('./screens/Paycheck'))
const Year = lazy(() => import('./screens/Year'))
// warm the other screens once the dashboard is showing
const preload = () => ['Activity', 'Bills', 'Plan', 'Calendar', 'Goals'].forEach((n) => import(`./screens/${n}.tsx`).catch(() => {}))

type NavItem = { id: View; label: string; icon: typeof HomeIcon; sub: string; month?: boolean; group: string }
const NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: HomeIcon, sub: '', month: true, group: 'Every day' },
  { id: 'activity', label: 'Activity', icon: ReceiptText, sub: 'Everything that came in or went out.', month: true, group: 'Every day' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, sub: 'Your month day by day, with bills, pay and your balance.', month: true, group: 'Every day' },
  { id: 'bills', label: 'Bills & pay', icon: CalendarClock, sub: 'Things that repeat every week, month or year. Set them once.', month: true, group: 'Every day' },
  { id: 'plan', label: 'My plan', icon: Wallet, sub: 'Decide how much to spend on each thing, then see how you are doing.', month: true, group: 'Planning' },
  { id: 'paycheck', label: 'Paycheck', icon: Banknote, sub: 'Your money pay period by pay period, however often you are paid.', group: 'Planning' },
  { id: 'year', label: 'My year', icon: BarChart3, sub: 'The whole year: totals, trends, every category and a look back.', group: 'Planning' },
  { id: 'goals', label: 'Goals', icon: Goal, sub: 'Save up for the things that matter, and try a no-spend challenge.', month: true, group: 'Building wealth' },
  { id: 'debts', label: 'Debts', icon: Scale, sub: 'See when you will be free of loans and cards, and how to get there faster.', group: 'Building wealth' },
  { id: 'accounts', label: 'Accounts', icon: PiggyBank, sub: 'Your bank accounts, cards and cash, and money moved between them.', group: 'Building wealth' },
  { id: 'worth', label: "What I'm worth", icon: Landmark, sub: 'Everything you own minus everything you owe.', group: 'Building wealth' },
  { id: 'household', label: 'Household', icon: Users, sub: 'Who brings money in and who spends on what.', month: true, group: 'Together' },
  { id: 'settings', label: 'Settings', icon: Cog, sub: 'Names, currency, accounts and your data.', group: 'Together' },
]
const SCREENS: Record<View, ComponentType> = { home: Home, activity: Activity, calendar: Calendar, plan: Plan, paycheck: Paycheck, year: Year, bills: Bills, goals: Goals, debts: Debts, accounts: Accounts, worth: Worth, household: Household, settings: Settings }

export default function App() {
  const data = useStore((s) => s.data)
  const hydrated = useStore((s) => s.hydrated)
  const theme = data?.settings.theme ?? 'system'
  const effects = data?.settings.effects ?? 'full'
  useEffect(() => {
    const r = document.documentElement
    r.classList.add('theme-anim')
    if (theme === 'system') delete r.dataset.theme
    else r.dataset.theme = theme
    try { localStorage.setItem('tally.theme', theme) } catch { /* ignore */ }
    const t = setTimeout(() => r.classList.remove('theme-anim'), 400)
    return () => clearTimeout(t)
  }, [theme])
  useEffect(() => {
    const r = document.documentElement
    if (effects === 'reduced') r.dataset.effects = 'reduced'
    else delete r.dataset.effects
    try { localStorage.setItem('tally.effects', effects) } catch { /* ignore */ }
  }, [effects])
  if (data) setCurrency(data.settings.currency)
  if (!hydrated) return <div className="grid min-h-screen place-items-center text-[15px] font-semibold text-muted">Loading your money…</div>
  return (
    <MotionConfig reducedMotion={effects === 'reduced' ? 'always' : 'user'}>
      {data ? <Shell /> : <Onboarding />}
      <Toaster />
    </MotionConfig>
  )
}

function Shell() {
  const { view, go, open } = useUI()
  const sample = useStore((s) => s.data?.sample)
  const toured = useStore((s) => s.data?.toured)
  useEffect(() => {
    if (toured) return
    const t = setTimeout(() => { if (!useUI.getState().sheet) useUI.getState().setTour(true) }, 1400)
    return () => clearTimeout(t)
  }, [toured])
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
  useEffect(() => { const t = setTimeout(preload, 1500); return () => clearTimeout(t) }, [])
  const Screen = SCREENS[view]
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <Sidebar />
      <main className="min-w-0 px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-14 lg:pt-8">
        <TopBar />
        <SaveWarning />
        <AnimatePresence>{sample && <SampleBanner />}</AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <Suspense fallback={<ScreenSkeleton />}><Screen /></Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar />
      <Sheets />
      <Tour />
    </div>
  )
}

function Sidebar() {
  const { view, go, open } = useUI()
  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-5 bg-cover px-4 py-6 text-cover-ink lg:flex">
      <div className="flex items-center gap-2.5 px-2 font-display text-[24px] font-extrabold">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-cover-ink text-cover"><Wallet size={18} /></span>Tally
      </div>
      <span data-tour="add" className="contents"><Button variant="primary" size="lg" onClick={() => open({ type: 'quick' })} className="!bg-cover-ink !text-cover !border-transparent">
        <Plus size={20} />Add money in or out
      </Button></span>
      <nav data-tour="nav" className="no-scrollbar -mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1" aria-label="Sections">
        {NAV.map((n, i) => {
          const I = n.icon, on = view === n.id, head = i === 0 || NAV[i - 1].group !== n.group
          return (
            <div key={n.id}>
              {head && <p className={`px-3 pb-1 text-[10.5px] font-bold uppercase tracking-[.1em] text-cover-muted opacity-70 ${i ? 'pt-3' : ''}`}>{n.group}</p>}
              <button type="button" onClick={() => go(n.id)} aria-current={on ? 'page' : undefined}
                className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-semibold transition-colors ${on ? 'text-cover-ink' : 'text-cover-muted hover:text-cover-ink'}`}>
                {on && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-cover-hi" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <I size={18} className="relative" /><span className="relative flex-1">{n.label}</span>
              </button>
            </div>
          )
        })}
      </nav>
      <div className="flex flex-col gap-1">
        <button type="button" data-tour="help" onClick={() => open({ type: 'help' })} className="flex items-center gap-3 rounded-xl px-3 py-2 font-semibold text-cover-muted hover:bg-cover-hi hover:text-cover-ink"><HelpCircle size={18} />Help & simple answers</button>
        <button type="button" onClick={() => { go('home'); setTimeout(() => useUI.getState().setTour(true), 300) }} className="flex items-center gap-3 rounded-xl px-3 py-2 font-semibold text-cover-muted hover:bg-cover-hi hover:text-cover-ink"><Compass size={18} />Take the tour</button>
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
        <div data-tour="month" className="flex items-center rounded-2xl border border-line bg-surface p-1 shadow-card">
          <button type="button" onClick={() => shiftMonth(-1)} className="grid h-9 w-9 place-items-center rounded-xl text-ink2 hover:bg-surface2 hover:text-ink" aria-label="Previous month"><ChevronLeft size={18} /></button>
          <AnimatePresence mode="wait">
            <motion.span key={month} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="min-w-[128px] text-center font-semibold">{monthName(month)}</motion.span>
          </AnimatePresence>
          <button type="button" onClick={() => shiftMonth(1)} className="grid h-9 w-9 place-items-center rounded-xl text-ink2 hover:bg-surface2 hover:text-ink" aria-label="Next month"><ChevronRight size={18} /></button>
          {month !== THIS_MONTH && <button type="button" onClick={() => setMonth(THIS_MONTH)} className="ml-1 rounded-xl px-2.5 py-1.5 text-[13px] font-semibold text-accent hover:bg-accent-soft">Today</button>}
        </div>
      )}
      <ThemeToggle />
      <span data-tour="help" className="lg:hidden"><Button variant="ghost" onClick={() => open({ type: 'help' })} ariaLabel="Help"><HelpCircle size={18} /><span className="hidden sm:inline">Help</span></Button></span>
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
    <nav data-tour="nav" aria-label="Sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur lg:hidden" style={{ background: 'color-mix(in srgb, var(--surface) 92%, transparent)' }}>
      <div className="mx-auto grid max-w-md grid-cols-5 items-end">
        {tabs.slice(0, 2).map(([v, l, I]) => <Tab key={v} on={view === v} label={l} icon={I} onClick={() => go(v as View)} />)}
        <div className="flex justify-center">
          <motion.button data-tour="add" type="button" whileTap={{ scale: 0.9 }} onClick={() => open({ type: 'quick' })} aria-label="Add money in or out"
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
            {t.tone === 'good' ? <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-good text-white"><Check size={14} strokeWidth={3} /></motion.span> : null}
            <span className="flex-1">{t.text}</span>
            {t.undo && <button type="button" className="rounded-lg border px-3 py-1 font-semibold" style={{ borderColor: 'color-mix(in srgb, var(--bg) 35%, transparent)' }} onClick={() => { replaceData(t.undo!); drop(t.id) }}>Undo</button>}
            <button type="button" aria-label="Dismiss" onClick={() => drop(t.id)} className="opacity-60 hover:opacity-100"><X size={16} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}


function ScreenSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4" aria-busy="true" aria-label="Loading">
      {[8, 4, 4, 4, 4].map((w, i) => <div key={i} className={`card col-span-12 h-40 animate-pulse md:col-span-${w}`} style={{ opacity: 0.6 }} />)}
    </div>
  )
}

function ThemeToggle() {
  const theme = useStore((s) => s.data?.settings.theme ?? 'system')
  const dark = theme === 'dark' || (theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <motion.button type="button" whileTap={{ scale: 0.9, rotate: -20 }} onClick={() => update((d) => { d.settings.theme = dark ? 'light' : 'dark' })}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}
      className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink2 shadow-card hover:text-ink">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? 'sun' : 'moon'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

function SaveWarning() {
  const err = useStore((s) => s.saveError)
  const go = useUI((u) => u.go)
  if (!err) return null
  return (
    <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-bad bg-bad-soft px-4 py-3 text-[14.5px]">
      <AlertTriangle size={18} className="shrink-0 text-bad" />
      <p className="flex-1">{err} New changes can't be stored right now. Download a backup so nothing is lost, then free up space in your browser.</p>
      <Button size="sm" variant="danger" onClick={() => go('settings')}>Back up now</Button>
    </div>
  )
}
