/**
 * The front page people see before they have any data: what Tally does, with a log-in button
 * in the top corner. Every number on this page is example data and is labelled as such.
 */
import { AnimatePresence, motion, useInView } from 'framer-motion'
import {
  AlertTriangle, ArrowRight, Banknote, Bell, Bot, CalendarClock, Check, CheckCircle2, ChevronDown, Cloud, Coffee, FileSpreadsheet, FileUp,
  Flame, Gauge, Heart, House, Lock, Luggage, Menu, Moon, PieChart, Plane, Plus, Scale, ShieldCheck, ShoppingBag, Sparkles, Sun, Target,
  TrendingDown, TrendingUp, Trophy, Users, Utensils, Wallet, WifiOff, X, XCircle, Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useEntry } from '../lib/entry'
import { celebrate, Tilt } from '../components/ui'
import desk from '../assets/landing/desk.webp'
import plan from '../assets/landing/plan.webp'
import roadtrip from '../assets/landing/roadtrip.webp'
import family from '../assets/landing/family.webp'
import couple from '../assets/landing/couple.webp'
import growth from '../assets/landing/growth.webp'
import coins from '../assets/landing/coins.webp'
import devices from '../assets/landing/devices.webp'
import together from '../assets/landing/together.webp'
import writing from '../assets/landing/writing.webp'
import shotDark from '../assets/landing/app-desktop-dark.webp'
import shotLight from '../assets/landing/app-desktop-light.webp'
import shotPhone from '../assets/landing/app-phone-dark.webp'
import shotTrips from '../assets/landing/app-trips-dark.webp'
import shotGoals from '../assets/landing/app-goals-dark.webp'

/* ---------- example money in the visitor's own currency ---------- */
function useDemoMoney() {
  return useMemo(() => {
    let region = ''
    try { region = new Intl.Locale(navigator.language).maximize().region ?? '' } catch { /* ignore */ }
    const cur: Record<string, [string, number]> = { IN: ['INR', 40], US: ['USD', 1], GB: ['GBP', 0.85], CA: ['CAD', 1.3], AU: ['AUD', 1.5], JP: ['JPY', 150], CH: ['CHF', 0.9], SG: ['SGD', 1.3], AE: ['AED', 3.6], ZA: ['ZAR', 18], BR: ['BRL', 5], MX: ['MXN', 18], NZ: ['NZD', 1.6], SE: ['SEK', 10], NO: ['NOK', 10], DK: ['DKK', 7], PL: ['PLN', 4] }
    const [code, k] = cur[region] ?? ['EUR', 1]
    let nf: Intl.NumberFormat
    try { nf = new Intl.NumberFormat(navigator.language, { style: 'currency', currency: code, maximumFractionDigits: 0 }) } catch { nf = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) }
    const round = (v: number) => (k >= 10 ? Math.round(v * k / 10) * 10 : Math.round(v * k))
    const fmt = (v: number) => nf.format(round(v))
    return Object.assign(fmt, { raw: round, code })
  }, [])
}
type Money = ReturnType<typeof useDemoMoney>

/* ---------- small building blocks ---------- */
const Reveal = ({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) => (
  <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}>{children}</motion.div>
)
function Head({ eyebrow, title, sub, center = true }: { eyebrow?: string; title: ReactNode; sub?: string; center?: boolean }) {
  return (
    <Reveal className={`mx-auto mb-10 max-w-2xl ${center ? 'text-center' : ''}`}>
      {eyebrow && <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[12.5px] font-semibold text-accent"><Sparkles size={13} />{eyebrow}</p>}
      <h2 className="font-display text-[30px] font-extrabold leading-tight tracking-tight sm:text-[40px]">{title}</h2>
      {sub && <p className="mt-3 text-[16px] leading-relaxed text-ink2 sm:text-[17px]">{sub}</p>}
    </Reveal>
  )
}
const Section = ({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) => (
  <section id={id} className={`scroll-mt-20 border-t border-line px-4 py-20 sm:px-6 lg:py-28 ${className}`}><div className="mx-auto max-w-6xl">{children}</div></section>
)
const Photo = ({ src, alt, className = '', eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) => (
  <img src={src} alt={alt} className={`h-full w-full object-cover ${className}`} loading={eager ? 'eager' : 'lazy'} decoding="async" {...(eager ? { fetchpriority: 'high' } : {})} />
)
const Panel = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-[24px] border border-line bg-surface shadow-card ${className}`}>{children}</div>
)

/* ---------- theme switch on the landing page (no data yet, so it lives in this browser) ---------- */
function useLandingTheme() {
  const [dark, setDark] = useState(() => {
    const t = document.documentElement.dataset.theme
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  })
  const toggle = () => {
    const next = !dark
    setDark(next)
    const r = document.documentElement
    r.classList.add('theme-anim'); setTimeout(() => r.classList.remove('theme-anim'), 400)
    r.dataset.theme = next ? 'dark' : 'light'
    try { localStorage.setItem('tally.theme', next ? 'dark' : 'light') } catch { /* ignore */ }
  }
  return { dark, toggle }
}

const NAV: [string, string][] = [['features', 'Features'], ['journey', 'How it works'], ['ai', 'Ask Tally'], ['together', 'Together'], ['privacy', 'Privacy'], ['faq', 'FAQ']]

export default function Landing() {
  const go = useEntry((e) => e.go)
  const m = useDemoMoney()
  const { dark, toggle } = useLandingTheme()
  const [menu, setMenu] = useState(false)
  const login = () => go('auth', 'login'), start = () => go('auth', 'signup'), tryIt = () => go('setup')
  const jump = (id: string) => { setMenu(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: id === 'ask-demo' ? 'center' : 'start' }) }
  // the Ask Tally demo can be driven from other parts of the page
  const [qa, setQa] = useState(0)
  const [ownQ, setOwnQ] = useState('')
  const askDemo = (i: number) => { setOwnQ(''); setQa(i); jump('ask-demo') }

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* ---------- top bar ---------- */}
      <header className="sticky top-0 z-50 border-b border-line backdrop-blur-xl" style={{ background: 'color-mix(in srgb, var(--bg) 78%, transparent)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <a href="#top" onClick={(e) => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }) }} className="flex items-center gap-2.5 font-display text-[21px] font-extrabold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-ink shadow-pop"><Wallet size={18} /></span>Tally
          </a>
          <nav className="mx-auto hidden items-center gap-1 rounded-full border border-line bg-surface/60 p-1 lg:flex" aria-label="Page sections">
            {NAV.map(([id, l]) => <button key={id} type="button" onClick={() => jump(id)} className="rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold text-ink2 transition-colors hover:bg-surface2 hover:text-ink">{l}</button>)}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <button type="button" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink2 hover:text-ink">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button type="button" onClick={login} className="rounded-xl px-3 py-2 text-[14.5px] font-semibold text-ink hover:bg-surface2">Log in</button>
            <button type="button" onClick={start} className="hidden items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[14.5px] font-bold text-accent-ink shadow-pop transition-transform hover:-translate-y-0.5 sm:inline-flex">Get started <ArrowRight size={16} /></button>
            <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface lg:hidden">{menu ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
        <AnimatePresence>
          {menu && (
            <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line lg:hidden" aria-label="Page sections">
              <div className="grid gap-1 px-4 py-3">
                {NAV.map(([id, l]) => <button key={id} type="button" onClick={() => jump(id)} className="rounded-xl px-3 py-2.5 text-left font-semibold hover:bg-surface2">{l}</button>)}
                <button type="button" onClick={start} className="mt-1 rounded-xl bg-accent px-3 py-2.5 font-bold text-accent-ink">Get started free</button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main id="top">
        <Hero m={m} dark={dark} onStart={start} onTry={tryIt} onTour={() => jump('journey')} jump={jump} askDemo={askDemo} />
        <TrustStrip jump={jump} />
        <Journey m={m} />
        <Shift />
        <AskSection m={m} n={qa} setN={setQa} askDemo={askDemo} ownQ={ownQ} setOwnQ={setOwnQ} />
        <WhatIf m={m} />
        <Modules />
        <FeatureChips jump={jump} />
        <Cascade m={m} />
        <Together m={m} />
        <Habits />
        <Privacy />
        <Faq />
        <FinalCta onStart={start} onTry={tryIt} onLogin={login} />
      </main>
      <Footer onLogin={login} onStart={start} jump={jump} />
    </div>
  )
}

/* ---------- hero ---------- */
function Hero({ m, dark, onStart, onTry, onTour, jump, askDemo }: { m: Money; dark: boolean; onStart: () => void; onTry: () => void; onTour: () => void; jump: (id: string) => void; askDemo: (i: number) => void }) {
  return (
    <section className="relative px-4 pb-16 pt-12 sm:px-6 lg:pb-24 lg:pt-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(900px 500px at 85% 10%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%), radial-gradient(700px 400px at 0% 90%, color-mix(in srgb, var(--good) 14%, transparent), transparent 70%)' }} />
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.02fr_1fr]">
        <div>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink2">
            <span className="h-2 w-2 rounded-full bg-good" />Money made simple for you and your family
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="font-display text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-[56px] lg:text-[62px]">
            Know what's safe to spend.{' '}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(100deg, var(--accent), var(--good))' }}>Every single day.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink2 sm:text-[18.5px]">
            Tally sets your bills and savings aside first, then shows one clear number you can spend. Plan holidays, fill savings jars, share costs with family, and ask questions about your own money in plain words.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-2xl bg-accent px-6 py-3.5 text-[16px] font-bold text-accent-ink shadow-pop transition-transform hover:-translate-y-0.5">Start free <ArrowRight size={18} /></button>
            <button type="button" onClick={onTour} className="inline-flex items-center gap-2 rounded-2xl border border-line2 bg-surface px-6 py-3.5 text-[16px] font-semibold hover:border-accent">See how it works <ChevronDown size={18} /></button>
          </motion.div>
          <button type="button" onClick={onTry} className="mt-4 text-[14px] font-semibold text-ink2 underline-offset-4 hover:text-ink hover:underline">Or try it without an account →</button>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] font-medium text-ink2">
            {[[ShieldCheck, 'Private by default'], [WifiOff, 'Works offline'], [Bot, 'AI that knows your numbers']].map(([I, t]) => { const Icon = I as typeof Check; return <li key={t as string} className="flex items-center gap-1.5"><Icon size={15} className="text-good" />{t as string}</li> })}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[600px]">
          <Tilt max={4}>
            <div className="relative">
              <div className="overflow-hidden rounded-[28px] border border-line shadow-pop">
                <div className="relative aspect-[4/3]">
                  <Photo src={desk} alt="A laptop and coffee on a desk, ready to plan the month" eager />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, transparent 30%, color-mix(in srgb, var(--bg) 80%, transparent))' }} />
                </div>
              </div>
              {/* the real app, as a browser window */}
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -bottom-10 -left-[3%] right-[30%] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
                <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
                  <i className="h-2.5 w-2.5 rounded-full bg-bad" /><i className="h-2.5 w-2.5 rounded-full bg-warn" /><i className="h-2.5 w-2.5 rounded-full bg-good" />
                  <span className="ml-2 truncate font-mono text-[10.5px] text-muted">tally · your money</span>
                </div>
                <img src={dark ? shotDark : shotLight} alt="Tally's home screen showing safe to spend, money health and monthly totals" className="block w-full" decoding="async" />
              </motion.div>
              <motion.img src={shotPhone} alt="Tally on a phone" decoding="async" initial={{ opacity: 0, y: 40, rotate: 6 }} animate={{ opacity: 1, y: 0, rotate: 4 }} transition={{ delay: 0.45, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -bottom-14 right-[2%] w-[26%] rounded-[22px] border-4 border-[#0b0f1d] shadow-pop" />
              <Float className="absolute -left-3 top-6 sm:-left-8" delay={0.6} onClick={() => jump('whatif')} label="Try the safe-to-spend calculator">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Safe today</p>
                <p className="font-display text-[22px] font-extrabold text-good tnum">{m(77)}<span className="text-[12px] font-semibold text-ink2"> / day</span></p>
              </Float>
              <Float className="absolute -right-2 top-[38%] hidden sm:block sm:-right-8" delay={0.8} onClick={() => askDemo(1)} label="Ask Tally why the health score is 72">
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold"><Gauge size={14} className="text-accent" />Money health <span className="text-good">72</span></p>
                <p className="text-[11.5px] text-ink2">Doing well · up 8 this month</p>
              </Float>
            </div>
          </Tilt>
          <p className="mt-16 text-center text-[12px] text-muted">The real Tally app, shown with example data.</p>
        </div>
      </div>
    </section>
  )
}
const Float = ({ children, className, delay, onClick, label }: { children: ReactNode; className: string; delay: number; onClick: () => void; label: string }) => (
  <motion.button type="button" onClick={onClick} aria-label={label} title={label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
    transition={{ opacity: { delay }, scale: { delay: 0 }, y: { delay, duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
    className={`rounded-2xl border border-line px-4 py-3 text-left shadow-pop backdrop-blur-xl hover:border-accent ${className}`} style={{ background: 'color-mix(in srgb, var(--surface) 88%, transparent)' }}>{children}</motion.button>
)

function TrustStrip({ jump }: { jump: (id: string) => void }) {
  const items: [typeof Check, string, string, string, string][] = [
    [ShieldCheck, 'No bank login', 'You stay in control', 'Tally never asks for your bank password. You add entries yourself, or import a CSV file your bank gives you.', 'privacy'],
    [WifiOff, 'Offline first', 'Saved on your device', 'Everything is saved in your browser first, so Tally opens instantly and works on a plane. With an account, it syncs when you are back online.', 'privacy'],
    [Sparkles, 'Plain language', 'No finance jargon', 'Every number comes with a short, friendly explanation. Tap any ? in the app for a simple answer.', 'ai'],
    [FileSpreadsheet, 'Yours to keep', 'CSV, Excel, backups', 'Take everything with you at any time: a CSV for spreadsheets, an Excel workbook, or a full backup to restore later.', 'faq'],
  ]
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="border-y border-line bg-surface/50 px-4 py-6 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 md:grid-cols-4">
        {items.map(([I, t, s], n) => (
          <button key={t} type="button" onClick={() => setOpen(open === n ? null : n)} aria-expanded={open === n}
            className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors ${open === n ? 'border-accent bg-accent-soft' : 'border-transparent hover:border-line'}`}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><I size={19} /></span>
            <span className="min-w-0 flex-1"><b className="block text-[14.5px]">{t}</b><span className="text-[12.5px] text-muted">{s}</span></span>
            <motion.span animate={{ rotate: open === n ? 180 : 0 }} className="text-muted"><ChevronDown size={16} /></motion.span>
          </button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {open != null && (
          <motion.div key={open} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mx-auto max-w-6xl overflow-hidden">
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface px-4 py-3 text-[14.5px] text-ink2" role="status">
              <span className="flex-1">{items[open][3]}</span>
              <button type="button" onClick={() => jump(items[open][4])} className="font-semibold text-accent">Read more →</button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------- a month with Tally: steps on the left, a live phone on the right ---------- */
function Journey({ m }: { m: Money }) {
  const steps = [
    { icon: Banknote, t: 'Payday arrives', s: 'Your pay lands and Tally starts the month.' },
    { icon: CalendarClock, t: 'Bills set aside', s: 'Rent, phone and subscriptions are reserved first.' },
    { icon: ShieldCheck, t: 'Safe to spend', s: 'One number for what is truly free.' },
    { icon: Coffee, t: 'Add a coffee', s: 'Three taps: what, how much, done.' },
    { icon: Bot, t: 'Ask Tally', s: 'A plain answer from your own numbers.' },
    { icon: Target, t: 'Fill a goal jar', s: 'Money moved somewhere safe.' },
    { icon: Gauge, t: 'Health goes up', s: 'See your habits pay off.' },
  ]
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { margin: '-120px' })
  useEffect(() => {
    if (paused || !seen) return
    const t = setInterval(() => setI((x) => (x + 1) % steps.length), 3200)
    return () => clearInterval(t)
  }, [paused, seen, steps.length])
  return (
    <Section id="journey">
      <Head eyebrow="How it works" title="A month with Tally" sub="From payday to your goals, here's what Tally does for you along the way." />
      <div ref={ref} className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <ol className="flex flex-col gap-2.5">
          {steps.map((x, n) => (
            <li key={x.t}>
              <button type="button" onClick={() => { setI(n); setPaused(true) }} aria-current={i === n ? 'step' : undefined}
                className={`relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border px-4 py-3 text-left transition-colors ${i === n ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line2'}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${i === n ? 'bg-accent text-accent-ink' : 'bg-surface2 text-ink2'}`}><x.icon size={18} /></span>
                <span className="min-w-0 flex-1"><b className="block text-[15px]">{x.t}</b><span className="text-[13px] text-ink2">{x.s}</span></span>
                <span className="font-mono text-[11px] text-muted">{String(n + 1).padStart(2, '0')}</span>
                {i === n && !paused && <motion.i key={`bar${n}`} className="absolute bottom-0 left-0 h-[3px] bg-accent" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 3.2, ease: 'linear' }} />}
              </button>
            </li>
          ))}
        </ol>
        <div className="mx-auto w-full max-w-[380px]">
          <div className="rounded-[36px] border border-line bg-surface p-3 shadow-pop">
            <div className="overflow-hidden rounded-[28px] border border-line" style={{ background: 'var(--bg)' }}>
              <div className="flex items-center justify-between border-b border-line px-5 py-3 text-[12px]"><span className="flex items-center gap-1.5 font-bold"><i className="h-2 w-2 rounded-full bg-good" />Tally</span><span className="font-mono text-muted">example</span></div>
              <div className="relative h-[360px]">
                <AnimatePresence mode="wait">
                  <motion.div key={i} initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }} className="absolute inset-0 grid place-items-center p-5">
                    <JourneyScreen i={i} m={m} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="grid grid-cols-5 items-center border-t border-line px-4 py-3 text-muted">
                {[House, PieChart, Plus, Target, Bell].map((I, n) => <span key={n} className="flex justify-center">{n === 2 ? <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-ink"><I size={20} /></span> : <I size={19} />}</span>)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-1.5" aria-hidden>{steps.map((_, n) => <i key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-6 bg-accent' : 'w-1.5 bg-line2'}`} />)}</div>
        </div>
      </div>
    </Section>
  )
}
function JourneyScreen({ i, m }: { i: number; m: Money }) {
  const card = 'w-full rounded-2xl border border-line bg-surface p-4'
  switch (i) {
    case 0: return <div className={card}><p className="text-[12px] font-bold uppercase tracking-wider text-muted">Money in</p><p className="mt-1 font-display text-[38px] font-extrabold text-good tnum">+{m(3200)}</p><p className="mt-2 flex items-center gap-2 text-[14px]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-good-soft text-good"><Banknote size={16} /></span>Pay received · today</p></div>
    case 1: return <div className={card}><p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-muted">Set aside for bills</p>{[['Rent', 1250], ['Phone & internet', 45], ['Streaming', 15], ['Gym', 35]].map(([n, v]) => <p key={n} className="flex items-center justify-between border-t border-line py-2 text-[14px] first:border-0"><span className="flex items-center gap-2"><Check size={15} className="text-good" />{n}</span><b className="tnum">{m(+v)}</b></p>)}</div>
    case 2: return <div className={`${card} text-center`} style={{ background: 'linear-gradient(140deg, var(--hero-a), var(--hero-b))', color: '#fff', borderColor: 'transparent' }}><p className="text-[12px] font-bold uppercase tracking-wider opacity-80">Safe to spend this month</p><p className="mt-1 font-display text-[44px] font-extrabold tnum">{m(1380)}</p><p className="text-[14px] opacity-90">About <b>{m(77)} a day</b> for 18 days</p></div>
    case 3: return <div className={card}><p className="text-[12px] font-bold uppercase tracking-wider text-muted">Added</p><div className="mt-2 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-warn-soft text-warn"><Coffee size={20} /></span><span className="flex-1"><b className="block">Coffee</b><span className="text-[13px] text-muted">Eating out · today</span></span><b className="tnum">−{m(3.4)}</b></div><p className="mt-3 rounded-xl bg-good-soft p-2.5 text-center text-[13px] font-semibold text-good">Still {m(76)} a day. You're fine.</p></div>
    case 4: return <div className="w-full space-y-2.5"><p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[14px] text-accent-ink">Can I go out for dinner tonight?</p><p className="w-fit max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-[14px]">Yes. Dinner for about <b>{m(45)}</b> still leaves you <b>{m(73)} a day</b> until payday, after rent and bills.</p><p className="text-[11px] text-muted">Example answer</p></div>
    case 5: return <div className={`${card} flex items-center gap-4`}><div className="relative h-24 w-16 overflow-hidden rounded-b-2xl rounded-t-lg border-2 border-line2"><motion.div className="absolute inset-x-0 bottom-0 bg-good" initial={{ height: '38%' }} animate={{ height: '58%' }} transition={{ duration: 1.2 }} /></div><div><b className="block">Summer trip</b><p className="text-[13px] text-ink2">+{m(150)} added · 58% saved</p><p className="mt-1 text-[12px] font-semibold text-good">On track for June</p></div></div>
    default: return <div className={`${card} text-center`}><p className="text-[12px] font-bold uppercase tracking-wider text-muted">Money health</p><p className="mt-1 font-display text-[46px] font-extrabold tnum">64 <span className="text-muted">→</span> <span className="text-good">72</span></p><p className="text-[14px] text-ink2">Doing well. You stayed inside your plan.</p></div>
  }
}

/* ---------- before and after ---------- */
function Shift() {
  const [after, setAfter] = useState(true)
  const before: [typeof Check, string, string][] = [[AlertTriangle, 'Spending drifts', 'No clear idea what is free to spend today.'], [XCircle, 'Bills surprise you', 'Yearly renewals and subscriptions catch you out.'], [TrendingDown, 'Savings stall', 'Whatever is left at month end quietly disappears.'], [FileSpreadsheet, 'Spreadsheets pile up', 'Hours of copying numbers around.']]
  const now: [typeof Check, string, string][] = [[ShieldCheck, 'One clear number', 'Safe to spend, worked out for you every day.'], [CheckCircle2, 'Bills set aside first', 'Every regular payment reserved before you spend.'], [TrendingUp, 'Goals fill up', 'Jars for the holiday, the car, the rainy day.'], [Bot, 'Answers on tap', 'Ask Tally about your own numbers in plain words.']]
  const list = (rows: typeof before, tone: 'bad' | 'good') => rows.map(([I, t, s], n) => (
    <motion.li key={t} initial={{ opacity: 0, x: tone === 'bad' ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: n * 0.06 }} className="flex gap-3.5">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone === 'bad' ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good'}`}><I size={18} /></span>
      <span><b className="block text-[16px]">{t}</b><span className="text-[14px] text-ink2">{s}</span></span>
    </motion.li>
  ))
  return (
    <Section id="shift">
      <Head title="From guessing to knowing" sub="Most money stress comes from not knowing. Tally swaps the guesswork for a calm, clear picture." />
      <div className="mb-8 flex items-center justify-center gap-3" role="group" aria-label="Compare">
        <button type="button" aria-pressed={!after} onClick={() => setAfter(false)} className={`rounded-xl border px-4 py-2 text-[14px] font-semibold ${!after ? 'border-bad bg-bad-soft text-bad' : 'border-line text-ink2'}`}>Without a plan</button>
        <span className="flex items-center gap-1 text-accent" aria-hidden><i className="h-px w-8 bg-line2" /><ArrowRight size={16} /><i className="h-px w-8 bg-line2" /></span>
        <button type="button" aria-pressed={after} onClick={() => setAfter(true)} className={`rounded-xl border px-4 py-2 text-[14px] font-semibold ${after ? 'border-good bg-good-soft text-good' : 'border-line text-ink2'}`}>With Tally</button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel className={`p-6 transition-opacity sm:p-8 ${after ? 'opacity-60' : ''}`}><div className="mb-5 h-1 w-16 rounded-full bg-bad" /><ul className="flex flex-col gap-5">{list(before, 'bad')}</ul></Panel>
        <Panel className={`p-6 transition-all sm:p-8 ${after ? 'ring-2 ring-[var(--good)]' : 'opacity-60'}`}><div className="mb-5 h-1 w-16 rounded-full bg-good" /><ul className="flex flex-col gap-5">{list(now, 'good')}</ul></Panel>
      </div>
    </Section>
  )
}

/* ---------- Ask Tally ---------- */
const DEMO_QA = (m: Money): { q: string; a: string; pills: [string, string][] }[] => [
  { q: `Can I spend ${m(45)} on dinner tonight?`, a: `Yes. You have ${m(77)} a day free after rent, your phone bill and your savings. Dinner for ${m(45)} still leaves about ${m(73)} a day until payday. Enjoy it.`, pills: [['Safe today', m(77)], ['Bills still to pay', m(178)], ['Days left', '18']] },
  { q: 'Why is my health score 72?', a: `You get full marks for saving and paying bills on time. You lose points because spending is heading about ${m(240)} over your plan. Holding back on eating out for a week would lift you to around 85.`, pills: [['Score', '72 of 100'], ['Over plan', m(240)], ['Biggest pot', 'Eating out']] },
  { q: 'When will my holiday jar be full?', a: `At your recent pace of ${m(150)} a month, Summer in Porto is full in about 7 months, a little after your date. Adding ${m(30)} more each month gets you there on time.`, pills: [['Saved', m(1380)], ['Target', m(2400)], ['Needed / month', m(180)]] },
  { q: 'Which debt should I pay off first?', a: `Your store card. At 24.9% it costs the most. Putting your extra ${m(150)} a month there clears it in about 9 months and saves roughly ${m(310)} in interest.`, pills: [['Highest rate', '24.9%'], ['Extra / month', m(150)], ['Interest saved', m(310)]] },
  { q: `What if I save ${m(100)} more a month?`, a: `You'd still have about ${m(71)} a day to spend, and your rainy-day fund would reach three months of essentials by next spring instead of next autumn.`, pills: [['Safe a day', `${m(77)} → ${m(71)}`], ['Cushion', '3 months'], ['Sooner by', '6 months']] },
]
function AskSection({ m, n, setN, askDemo, ownQ, setOwnQ }: { m: Money; n: number; setN: (i: number) => void; askDemo: (i: number) => void; ownQ: string; setOwnQ: (q: string) => void }) {
  const qa = useMemo(() => DEMO_QA(m), [m])
  const [typed, setTyped] = useState('')
  const [thinking, setThinking] = useState(true)
  const [cmp, setCmp] = useState<'bot' | 'tally'>('tally')
  const [own, setOwn] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, margin: '-100px' })
  const cur = ownQ ? { q: ownQ, a: `Great question. Once you've set up Tally, Ask Tally answers this from your own bills, plan and goals in a few seconds. Here it can only show example answers, so try one of the questions below.`, pills: [] as [string, string][] } : qa[n]
  useEffect(() => {
    if (!seen) return
    setTyped(''); setThinking(true)
    const a = cur.a
    let k = 0, t: ReturnType<typeof setInterval> | undefined
    const s = setTimeout(() => { setThinking(false); t = setInterval(() => { k += 3; setTyped(a.slice(0, k)); if (k >= a.length) clearInterval(t) }, 16) }, 700)
    return () => { clearTimeout(s); clearInterval(t) }
  }, [cur.a, seen])
  const points: [string, string][] = [['Answers from your own numbers', 'Ask Tally reads your bills, plan, goals and recent spending before it replies.'], ['Nothing to copy and paste', 'No bank statements to upload. Tally already knows your picture.'], ['Plain words', 'Short, friendly answers with the one number that matters.'], ['Tally counts, AI explains', "Tally's own calculations produce the numbers. The AI explains them clearly."]]
  const pick = (i: number) => { setOwnQ(''); setN(i) }
  return (
    <Section id="ai">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Head center={false} eyebrow="Ask Tally · AI" title="Your money has answers. Just ask." sub="Get clear answers about your own money, not generic tips. Ask how much you can spend, why your score changed, or when a goal will be done." />
          <ul className="flex flex-col gap-1">
            {points.map(([t, s], i) => <Reveal key={t} delay={i * 0.05}><li><button type="button" onClick={() => pick(i === 2 ? 1 : i === 3 ? 4 : i)} className="flex w-full gap-3 rounded-xl p-2 text-left hover:bg-surface2"><CheckCircle2 size={20} className="mt-0.5 shrink-0 text-good" /><span><b className="block">{t}</b><span className="text-[14.5px] text-ink2">{s}</span></span></button></li></Reveal>)}
          </ul>
          <Reveal><p className="mt-6 flex gap-3 rounded-2xl border border-line bg-surface p-4 text-[14px] text-ink2"><ShieldCheck size={20} className="shrink-0 text-good" /><span><b className="text-ink">You stay in charge.</b> Ask Tally only reads a summary of your dashboard when you ask a question, and you can see exactly what it reads. It can't move money or change anything.</span></p></Reveal>
        </div>
        <Reveal>
          <div ref={ref} id="ask-demo" className="scroll-mt-24">
          <Panel className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Bot size={20} /></span>
              <span className="min-w-0 flex-1"><b className="flex items-center gap-2">Ask Tally <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good"><i className="h-1.5 w-1.5 rounded-full bg-good" />Ready</span></b><span className="text-[12px] text-muted">Reading: {m(3811)} spent · {m(77)}/day safe · example data</span></span>
            </div>
            <div className="min-h-[300px] space-y-3 p-5" aria-live="polite">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[14.5px] text-accent-ink">{cur.q}</p>
              <div className="flex gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Sparkles size={15} /></span>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface2/60 px-4 py-3 text-[14.5px] leading-relaxed" data-testid="demo-answer">
                  {thinking ? <span className="inline-flex gap-1 py-1" aria-label="Thinking">{[0, 1, 2].map((d) => <motion.i key={d} className="h-2 w-2 rounded-full bg-muted" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}</span> : typed}
                  {!thinking && typed.length >= cur.a.length && cur.pills.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                      {cur.pills.map(([k, v]) => <span key={k} className="rounded-lg border border-line px-2.5 py-1 text-[12.5px] text-ink2">{k}: <b className="text-ink tnum">{v}</b></span>)}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-line p-5">
              <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-wider text-muted">Try asking</p>
              <div className="flex flex-wrap gap-2">
                {qa.map((x, i) => <button key={x.q} type="button" onClick={() => pick(i)} aria-pressed={!ownQ && n === i} className={`rounded-xl border px-3 py-2 text-left text-[13.5px] font-medium transition-colors ${!ownQ && n === i ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-line2'}`}>{x.q}</button>)}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); if (own.trim()) { setOwnQ(own.trim()); setOwn('') } }} className="mt-3 flex gap-2">
                <input value={own} onChange={(e) => setOwn(e.target.value)} maxLength={140} placeholder="Or type your own question…" aria-label="Type a question for the demo" className="field flex-1 !rounded-xl !py-2 text-[14px]" />
                <button type="submit" className="rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink disabled:opacity-50" disabled={!own.trim()}>Ask</button>
              </form>
              <p className="mt-3 text-[11.5px] text-muted">Example answers on example data. Real answers use your own numbers.</p>
            </div>
          </Panel>
          </div>
        </Reveal>
      </div>

      <div className="mt-20 grid gap-5 md:grid-cols-2" role="group" aria-label="Compare a general chatbot with Ask Tally">
        {(['bot', 'tally'] as const).map((k, i) => {
          const on = cmp === k, bot = k === 'bot'
          return (
            <Reveal key={k} delay={i * 0.08}><button type="button" onClick={() => setCmp(k)} aria-pressed={on} className={`h-full w-full rounded-[24px] border bg-surface p-6 text-left shadow-card transition-all ${on ? (bot ? 'border-bad ring-1 ring-[var(--bad)]' : 'border-good ring-1 ring-[var(--good)]') : 'border-line opacity-80 hover:opacity-100'}`}>
              <p className={`mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider ${bot ? 'text-muted' : 'text-good'}`}>{bot ? <XCircle size={16} /> : <Sparkles size={16} />}{bot ? 'A general chatbot' : 'Ask Tally'}</p>
              <p className={`mb-4 rounded-xl px-4 py-3 text-[13.5px] ${bot ? 'border border-line bg-surface2/60 font-mono text-ink2' : 'bg-good-soft font-semibold text-good'}`}>{bot ? '"Please paste your bank statement first…"' : `"Safe today: ${m(77)} · Bills still to pay: ${m(178)}"`}</p>
              <ul className="space-y-1.5 text-[14px] text-ink2">{(bot ? ['Has to be told everything, every time', 'Generic tips that fit nobody', 'No idea what bills are coming'] : ['Starts from your real dashboard', 'Knows the bills still to come', 'Tracks your goals, trips and debts']).map((x) => <li key={x}>• {x}</li>)}</ul>
              <AnimatePresence>{on && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-4 space-y-2 border-t border-line pt-4 text-[13.5px]">
                    <p className="ml-auto w-fit rounded-xl bg-accent px-3 py-1.5 text-accent-ink">Can I afford dinner out tonight?</p>
                    <p className="w-fit max-w-[92%] rounded-xl border border-line bg-surface2/60 px-3 py-2">{bot ? "I can't see your finances. Could you tell me your income, your bills, what you've spent this month and any savings goals?" : `Yes. About ${m(45)} still leaves ${m(73)} a day until payday, after rent and bills.`}</p>
                  </div>
                </motion.div>
              )}</AnimatePresence>
              {!on && <p className="mt-4 text-[12.5px] font-semibold text-accent">Tap to see it answer →</p>}
            </button></Reveal>
          )
        })}
      </div>

      <div className="mt-20"><Head title="Questions people ask every week" sub="Everyday decisions, answered in seconds. Tap one to see Ask Tally answer it." /></div>
      <div className="grid gap-5 md:grid-cols-3">
        {([[ShieldCheck, 'Know your daily limit', 'How much can you spend today without missing a bill?', 0], [Target, 'Track your goals', 'How far away is the target, and when will you get there?', 2], [Zap, 'Try what-ifs', 'See what happens if you save or spend a little differently.', 4]] as const).map(([I, t, s, qi], i) => (
          <Reveal key={t} delay={i * 0.06}><button type="button" onClick={() => askDemo(qi)} className="h-full w-full rounded-[24px] border border-line bg-surface p-6 text-left shadow-card transition-all hover:-translate-y-1 hover:border-accent">
            <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent"><I size={20} /></span><b className="block text-[17px]">{t}</b><p className="mt-1 text-[14.5px] text-ink2">{s}</p>
            <p className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface2/50 px-3.5 py-2.5 font-mono text-[12.5px] italic text-accent"><span>"{qa[qi].q}"</span><ArrowRight size={15} className="shrink-0" /></p>
          </button></Reveal>
        ))}
      </div>
    </Section>
  )
}

/* ---------- what if: one purchase, the whole month ---------- */
function WhatIf({ m }: { m: Money }) {
  const opts = [{ k: 'coffee', l: 'Coffee run', icon: Coffee, d: 4, max: 20 }, { k: 'dinner', l: 'Dinner out', icon: Utensils, d: 45, max: 200 }, { k: 'shoes', l: 'New shoes', icon: ShoppingBag, d: 90, max: 400 }, { k: 'weekend', l: 'Weekend away', icon: Luggage, d: 320, max: 1600 }]
  const [o, setO] = useState(opts[1])
  const [amt, setAmt] = useState(o.d)
  const safe = 1380, days = 18, goal = 400
  const perBefore = safe / days, perAfter = Math.max(0, safe - amt) / days
  const intoGoal = Math.max(0, amt - safe)
  const goalAfter = Math.max(0, goal - intoGoal)
  return (
    <Section id="whatif">
      <Head eyebrow="Try it" title="One purchase, the whole picture" sub="Pick something and move the slider. Tally instantly shows what it means for every day left this month and for your savings." />
      <Reveal><Panel className="mx-auto grid max-w-4xl gap-6 p-5 sm:p-8 md:grid-cols-2">
        <div>
          <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-muted">1. Choose</p>
          <div className="grid grid-cols-2 gap-2.5">
            {opts.map((x) => <button key={x.k} type="button" aria-pressed={o.k === x.k} onClick={() => { setO(x); setAmt(x.d) }} className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3.5 text-[13.5px] font-semibold transition-colors ${o.k === x.k ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-line2'}`}><x.icon size={20} />{x.l}</button>)}
          </div>
          <div className="mt-6 flex items-center justify-between"><p className="text-[12px] font-bold uppercase tracking-wider text-muted">2. How much</p><b className="font-display text-[22px] tnum">{m(amt)}</b></div>
          <input type="range" min={1} max={o.max} value={amt} onChange={(e) => setAmt(+e.target.value)} className="mt-3 w-full accent-[var(--accent)]" aria-label="Amount" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-line p-4">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-accent" />Safe to spend a day</span><motion.b key={Math.round(perAfter)} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className={`font-display text-[26px] tnum ${perAfter < perBefore * 0.5 ? 'text-warn' : 'text-good'}`}>{m(perAfter)}</motion.b></div>
            <p className="text-right text-[12.5px] text-muted">was {m(perBefore)} for the {days} days left</p>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-semibold"><Target size={18} className="text-accent" />Going to your goals</span><b className={`font-display text-[26px] tnum ${intoGoal ? 'text-bad' : 'text-good'}`}>{m(goalAfter)}</b></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2"><motion.div className="h-full rounded-full" style={{ background: intoGoal ? 'var(--bad)' : 'var(--good)' }} animate={{ width: `${(goalAfter / goal) * 100}%` }} /></div>
            <p className="mt-1.5 text-right text-[12.5px] text-muted">plan {m(goal)} this month</p>
          </div>
          <p className={`rounded-2xl p-3.5 text-[14px] ${intoGoal ? 'bg-bad-soft' : perAfter < perBefore * 0.5 ? 'bg-warn-soft' : 'bg-good-soft'}`}>
            {intoGoal ? <>This is more than is free this month. <b>{m(intoGoal)}</b> would come out of your savings.</> : perAfter < perBefore * 0.5 ? <>It fits, but the rest of the month gets tight. Maybe wait until payday?</> : <>It fits comfortably. Your bills and savings are already taken care of.</>}
          </p>
        </div>
      </Panel></Reveal>
      <p className="mt-4 text-center text-[12.5px] text-muted">Example: {m(safe)} safe to spend, {days} days left, {m(goal)} planned for goals.</p>
    </Section>
  )
}

/* ---------- everything in one place ---------- */
function Modules() {
  const mods = [
    { icon: Banknote, t: 'Pay & income', d: 'Monthly, weekly, every two weeks or your own cycle. Tally plans each pay period and shows what is coming in.', img: shotDark, alt: 'Tally home screen' },
    { icon: PieChart, t: 'My plan', d: 'Give every pot a monthly amount, roll leftovers forward, or use "give every bit a job". 50/30/20 balance built in.', img: plan, alt: 'A notebook with a planning checklist' },
    { icon: CalendarClock, t: 'Bills & pay', d: 'Set rent, subscriptions and pay once. They appear on their dates; tick them off when paid and spot what to cancel.', img: writing, alt: 'Writing in a notebook next to a coffee' },
    { icon: ShieldCheck, t: 'Safe to spend', d: 'Money in, minus spending, savings and the bills still to come. One number, and how much that is per day.', img: shotLight, alt: 'Tally safe-to-spend card' },
    { icon: Plus, t: 'Quick add', d: 'Three taps: pick what it was, type the amount, done. Double taps are ignored, and look-alike entries are flagged.', img: shotPhone, alt: 'Tally on a phone', tall: true },
    { icon: Bot, t: 'Ask Tally', d: 'Questions about your money answered in plain words, from your own dashboard.', img: devices, alt: 'Someone using a phone and laptop together' },
    { icon: Target, t: 'Goals', d: 'Savings jars that fill as you add money, with the monthly amount needed and when you will get there.', img: shotGoals, alt: 'Tally goals screen with savings jars' },
    { icon: Plane, t: 'Trips', d: 'Give a holiday a budget, tag what you spend, see it per day and who paid. It still counts in your normal month.', img: shotTrips, alt: 'Tally trips screen' },
    { icon: Users, t: 'Household', d: 'Up to six people: who brings money in, who spends on what, and how the family is doing together.', img: family, alt: 'A family watching the sunset on a beach' },
    { icon: Scale, t: 'Debts', d: 'Cheapest-first, quickest wins or your own order. See your debt-free date and the interest you save.', img: coins, alt: 'Stacks of coins growing' },
  ]
  const [i, setI] = useState(0)
  const x = mods[i]
  return (
    <Section id="features">
      <Head eyebrow="Features" title="Everything in one calm place" sub="Tally isn't just an expense list. Each part feeds the next, so your money has a job from payday to goal." />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid grid-cols-2 content-start gap-3 self-start sm:grid-cols-5" role="tablist" aria-label="Features">
          {mods.map((y, n) => (
            <button key={y.t} type="button" role="tab" aria-selected={n === i} onClick={() => setI(n)}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-center text-[13px] font-semibold transition-all ${n === i ? 'border-accent bg-accent-soft text-ink shadow-pop' : 'border-line bg-surface text-ink2 hover:-translate-y-0.5 hover:border-line2'}`}>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${n === i ? 'bg-accent text-accent-ink' : 'bg-surface2'}`}><y.icon size={19} /></span>{y.t}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <Panel className="overflow-hidden">
              <div className={`relative overflow-hidden bg-surface2 ${x.tall ? 'h-[240px]' : 'aspect-[16/9]'}`}>
                <img src={x.img} alt={x.alt} loading="lazy" decoding="async" className={`h-full w-full ${x.tall ? 'object-contain py-3' : 'object-cover object-top'}`} />
              </div>
              <div className="p-6">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent"><x.icon size={20} /></span>
                <h3 className="text-[22px] font-extrabold">{x.t}</h3>
                <p className="font-mono text-[12px] text-accent">Part {i + 1} of {mods.length}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink2">{x.d}</p>
                <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-4 text-[13px] font-semibold text-good"><CheckCircle2 size={15} />Connected to the rest of Tally</p>
              </div>
            </Panel>
          </motion.div>
        </AnimatePresence>
      </div>
    </Section>
  )
}

function FeatureChips({ jump }: { jump: (id: string) => void }) {
  const chips: [typeof Check, string, string, string, string, string][] = [
    [Sparkles, 'Smart tips', 'From your own numbers', 'var(--warn)', 'Tally spots things like a category running higher than usual or a subscription you could cancel, and tells you in one sentence.', 'features'],
    [WifiOff, 'Works offline', 'Always available', 'var(--accent)', 'Add entries on a plane or in a basement shop. Nothing waits for the internet.', 'privacy'],
    [Lock, 'Private', 'No ads, no tracking', 'var(--good)', 'No adverts, no selling data and no analytics on your money. Without an account, nothing leaves your device.', 'privacy'],
    [Bell, 'Bills coming up', 'Next two weeks', 'var(--accent)', 'Home lists every bill due in the next two weeks, so nothing catches you out. Tick them off as they are paid.', 'journey'],
    [FileUp, 'Bank CSV import', 'Checked before saving', 'var(--accent)', 'Import your bank\'s CSV file. Tally previews it first, flags possible duplicates and unreadable rows, and only saves when you say so.', 'features'],
    [Cloud, 'Cloud sync', 'Optional, your account', 'var(--good)', 'Log in to keep your phone and laptop in step. If both change, Tally asks which copy to keep, and never silently throws one away.', 'faq'],
  ]
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="border-t border-line bg-surface/50 px-4 py-10 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {chips.map(([I, t, s, c], n) => (
          <Reveal key={t} delay={n * 0.04}><button type="button" onClick={() => setOpen(open === n ? null : n)} aria-expanded={open === n}
            className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-colors ${open === n ? 'border-accent bg-accent-soft' : 'border-transparent hover:border-line'}`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line" style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}><I size={19} /></span><span><b className="block text-[14px]">{t}</b><span className="text-[12px] text-muted">{s}</span></span>
          </button></Reveal>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {open != null && (
          <motion.div key={open} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mx-auto max-w-6xl overflow-hidden">
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface px-4 py-3 text-[14.5px] text-ink2" role="status"><span className="flex-1"><b className="text-ink">{chips[open][1]}.</b> {chips[open][4]}</span><button type="button" onClick={() => jump(chips[open][5])} className="font-semibold text-accent">See more →</button></p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------- a paycheck finding its place ---------- */
function Cascade({ m }: { m: Money }) {
  const [pay, setPay] = useState(3200)
  const [share, setShare] = useState([39, 34, 13, 8, 6])
  const rows: [typeof Check, string, string][] = [[Zap, 'Bills and regular payments', 'var(--warn)'], [Wallet, 'Everyday spending plan', 'var(--ink2)'], [Target, 'Savings goals', 'var(--accent)'], [ShieldCheck, 'Safety cushion', 'var(--good)'], [TrendingUp, 'Long-term investing', 'var(--accent)']]
  const used = share.reduce((a, b) => a + b, 0)
  const left = pay * (100 - used) / 100
  const bump = (i: number, d: number) => setShare((x) => x.map((v, j) => (j === i ? Math.max(0, Math.min(90, v + d)) : v)))
  let bal = pay
  return (
    <Section id="cascade">
      <div className="grid items-start gap-12 lg:grid-cols-2">
        <div>
          <Head center={false} title="Watch every payday find its place" sub="Tally helps you give every bit of your pay a job, so nothing is left to drift. Move the slider and adjust each share until the last line reaches zero." />
          <Reveal><div className="relative aspect-[4/3] overflow-hidden rounded-[24px] border border-line shadow-card"><Photo src={growth} alt="A small plant growing out of a pile of coins" /></div></Reveal>
        </div>
        <div>
          <div className="mb-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-good-soft text-good"><Banknote size={18} /></span><span className="flex-1 font-semibold">Your pay this month</span><b className="font-mono text-[18px] text-good tnum">+ {m(pay)}</b></div>
            <input type="range" min={800} max={9000} step={50} value={pay} onChange={(e) => setPay(+e.target.value)} aria-label="Your pay this month" className="mt-3 w-full accent-[var(--good)]" />
          </div>
          <ol className="flex flex-col gap-2.5">
            {rows.map(([I, t, c], n) => {
              const v = pay * share[n] / 100
              bal -= v
              return (
                <motion.li key={t} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: n * 0.1 }}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-3 shadow-card">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}><I size={18} /></span>
                  <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{t}</b><span className="text-[12px] text-muted">{share[n]}% · left after this {m(bal)}</span></span>
                  <b className="font-mono text-[14.5px] tnum">− {m(v)}</b>
                  <span className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => bump(n, 1)} aria-label={`More for ${t}`} className="grid h-6 w-7 place-items-center rounded-md border border-line text-[13px] font-bold hover:border-accent">+</button>
                    <button type="button" onClick={() => bump(n, -1)} aria-label={`Less for ${t}`} className="grid h-6 w-7 place-items-center rounded-md border border-line text-[13px] font-bold hover:border-accent">−</button>
                  </span>
                </motion.li>
              )
            })}
          </ol>
          <p className={`mt-4 flex items-center justify-center gap-1.5 rounded-2xl p-3 text-center text-[14.5px] font-semibold ${Math.abs(left) < 0.5 ? 'bg-good-soft text-good' : left > 0 ? 'bg-warn-soft text-warn' : 'bg-bad-soft text-bad'}`} aria-live="polite" data-testid="cascade-left">
            {Math.abs(left) < 0.5 ? <><CheckCircle2 size={16} />Every bit has a job. Your whole month is planned.</> : left > 0 ? <>{m(left)} still has no job. Give it one.</> : <>You've planned {m(-left)} more than you earn.</>}
          </p>
          <button type="button" onClick={() => { setPay(3200); setShare([39, 34, 13, 8, 6]) }} className="mt-2 w-full text-center text-[12.5px] font-semibold text-muted hover:text-ink">Reset example</button>
        </div>
      </div>
    </Section>
  )
}

/* ---------- together ---------- */
function Together({ m }: { m: Money }) {
  const tabs = [
    { k: 'couples', l: 'Couples', icon: Heart, img: couple, alt: 'Two people sharing coffee', h: 'One plan, two people.', s: 'See who brings money in and who spends on what, without arguments about the numbers.', pts: ['Each person\'s money in, out and saved', 'Who pays for which category', 'One shared plan and safe-to-spend'], ledger: { name: 'Home together', badge: '2 people', rows: [['Alex', 'Rent & groceries', 2450, 'even'], ['Sam', 'Dinners & cinema', 1280, 'under']] } },
    { k: 'housemates', l: 'Housemates', icon: House, img: together, alt: 'Friends working together at a table', h: 'No more awkward IOUs.', s: 'Track who paid the Wi-Fi and the electricity, and see who is ahead of an even share.', pts: ['Every shared bill in one place', 'Paid more or less than an even share', 'Works offline, syncs later'], ledger: { name: 'Flat 4B', badge: '3 people', rows: [['Priya', 'Internet & streaming', 620, 'over'], ['Rahul', 'Electricity & gas', 410, 'even'], ['Sana', 'Cleaning supplies', 180, 'under']] } },
    { k: 'family', l: 'Family', icon: Users, img: family, alt: 'A family at the beach at sunset', h: 'The whole family picture.', s: 'Up to six people in one household, with savings goals the whole family can see grow.', pts: ['Up to 6 people', 'Family goals and jars', 'Year-end look back together'], ledger: { name: 'Family budget', badge: '4 people', rows: [['Mum', 'Groceries & school', 1840, 'over'], ['Dad', 'Car & insurance', 1220, 'even'], ['Mia', 'Pocket money', 60, 'under']] } },
    { k: 'trips', l: 'Trips', icon: Plane, img: roadtrip, alt: 'A camper van on a desert road', h: 'Holidays without the hangover.', s: 'Give a trip a budget and dates. Everything you tag shows per day, by category and by who paid.', pts: ['Budget, spent and left per day', 'Bookings made before you go', 'Still counts in your normal month'], ledger: { name: 'Weekend in Lisbon', badge: '2 travellers', rows: [['Alex', 'Flights & hotel', 470, 'over'], ['Sam', 'Food & tickets', 213, 'under']] } },
  ] as const
  const [k, setK] = useState<(typeof tabs)[number]['k']>('housemates')
  const t = tabs.find((x) => x.k === k)!
  const total = t.ledger.rows.reduce((a, r) => a + r[2], 0)
  const share = total / t.ledger.rows.length
  return (
    <Section id="together">
      <Head eyebrow="Together" title="Money is better shared" sub="Couples, housemates, families and travel buddies: see who paid what, and how you're doing together." />
      <Reveal><Panel className="overflow-hidden">
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-line p-3" role="tablist" aria-label="Who you share with">
          {tabs.map((x) => <button key={x.k} type="button" role="tab" aria-selected={k === x.k} onClick={() => setK(x.k)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-[14px] font-semibold transition-colors ${k === x.k ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink2 hover:text-ink'}`}><x.icon size={16} />{x.l}</button>)}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="grid gap-0 lg:grid-cols-2">
            <div className="relative min-h-[260px] lg:min-h-full"><Photo src={t.img} alt={t.alt} className="absolute inset-0" /><div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, color-mix(in srgb, var(--bg) 85%, transparent), transparent 60%)' }} />
              <div className="absolute bottom-0 p-6"><span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-ink"><t.icon size={20} /></span><h3 className="text-[26px] font-extrabold leading-tight">{t.h}</h3></div>
            </div>
            <div className="p-6 sm:p-8">
              <p className="text-[16px] leading-relaxed text-ink2">{t.s}</p>
              <ul className="mt-4 space-y-2">{t.pts.map((p) => <li key={p} className="flex items-center gap-2 text-[14.5px]"><CheckCircle2 size={17} className="text-good" />{p}</li>)}</ul>
              <div className="mt-6 rounded-2xl border border-line" style={{ background: 'var(--bg)' }}>
                <div className="flex items-center justify-between border-b border-line px-4 py-3"><b className="flex items-center gap-2 text-[14.5px]"><i className="h-2 w-2 rounded-full bg-good" />{t.ledger.name}</b><span className="rounded-lg border border-line px-2 py-0.5 text-[12px] text-ink2">{t.ledger.badge}</span></div>
                <div className="space-y-2 p-3">
                  {t.ledger.rows.map(([who, what, v]) => {
                    const diff = v - share, tone = Math.abs(diff) < share * 0.05 ? 'good' : diff > 0 ? 'good' : 'warn'
                    return (
                      <div key={who} className="flex items-center gap-3 rounded-xl border-l-4 bg-surface px-3 py-2.5" style={{ borderColor: `var(--${tone})` }}>
                        <span className="min-w-0 flex-1"><b className="block text-[14px]">{who}</b><span className="text-[12.5px] text-muted">{what}</span></span>
                        <span className="text-right"><b className="block font-mono text-[14px] tnum">{m(v)}</b>
                          <span className={`text-[11.5px] font-semibold ${tone === 'warn' ? 'text-warn' : 'text-good'}`}>{Math.abs(diff) < share * 0.05 ? 'Even share' : diff > 0 ? `Ahead ${m(diff)}` : `Owes ${m(-diff)}`}</span></span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[14px]"><span className="text-ink2">Together</span><b className="font-mono text-good tnum">{m(total)}</b></div>
              </div>
              <p className="mt-2 text-[11.5px] text-muted">Example data. "Owes" compares what each person paid with an even share.</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </Panel></Reveal>
    </Section>
  )
}

/* ---------- habits ---------- */
function Habits() {
  const m = useDemoMoney()
  const [days, setDays] = useState({ sat: true, sun: false })
  const [jar, setJar] = useState(2100)
  const [cells, setCells] = useState(() => Array.from({ length: 16 }, (_, i) => [0, 1, 3, 4, 6, 8, 9, 11, 12].includes(i)))
  const weekend = (+days.sat + +days.sun) * 50, jarP = Math.min(100, Math.round(jar / 3000 * 100)), count = cells.filter(Boolean).length, nsP = Math.min(100, Math.round(count / 12 * 100))
  const cheer = (e: React.MouseEvent, before: number, after: number) => { if (before < 100 && after >= 100) celebrate(e, true) }
  const card = (icon: ReactNode, title: string, sub: string, p: number, body: ReactNode) => (
    <Panel className="h-full p-6">
      <div className="flex items-start justify-between"><span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</span>{p >= 100 ? <span className="inline-flex items-center gap-1 rounded-lg bg-good-soft px-2.5 py-1 text-[12px] font-semibold text-good"><CheckCircle2 size={13} />Done</span> : <span className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-ink2">In progress</span>}</div>
      <h3 className="mt-5 text-[18px] font-bold">{title}</h3><p className="text-[14px] text-ink2">{sub}</p>
      <div className="mt-4">{body}</div>
      <div className="mt-5 flex justify-between text-[13px]"><span className="text-muted">Progress</span><b className="tnum">{p}%</b></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2"><motion.div className="h-full rounded-full" style={{ background: p >= 100 ? 'var(--good)' : 'var(--accent)' }} initial={{ width: 0 }} whileInView={{ width: `${p}%` }} animate={{ width: `${p}%` }} viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} /></div>
    </Panel>
  )
  const pill = (on: boolean) => `rounded-xl border px-3 py-2 text-[13.5px] font-semibold transition-colors ${on ? 'border-good bg-good-soft text-good' : 'border-line hover:border-line2'}`
  return (
    <Section id="habits">
      <Head title="Small wins that add up" sub="Challenges, streaks and jars turn good money habits into something you look forward to. Go on, try them." />
      <div className="grid gap-5 md:grid-cols-3">
        <Reveal>{card(<Flame size={22} />, 'No-spend weekend', 'Nothing on extras, Saturday and Sunday', weekend,
          <div className="flex gap-2">{(['sat', 'sun'] as const).map((d) => <button key={d} type="button" aria-pressed={days[d]} onClick={(e) => { const next = { ...days, [d]: !days[d] }; setDays(next); cheer(e, weekend, (+next.sat + +next.sun) * 50) }} className={pill(days[d])}>{days[d] ? <Check size={14} className="mr-1 inline" /> : null}{d === 'sat' ? 'Saturday' : 'Sunday'}</button>)}</div>)}</Reveal>
        <Reveal delay={0.07}>{card(<Trophy size={22} />, 'Fill the rainy-day jar', `${m(jar)} of ${m(3000)} saved`, jarP,
          jarP < 100
            ? <button type="button" onClick={(e) => { const next = jar + 300; setJar(next); cheer(e, jarP, Math.round(next / 3000 * 100)) }} className={pill(false)}><Plus size={14} className="mr-1 inline" />Add {m(300)}</button>
            : <button type="button" onClick={() => setJar(2100)} className={pill(true)}>Full! Start again</button>)}</Reveal>
        <Reveal delay={0.14}>{card(<Target size={22} />, 'No-spend days', `${count} of 12 days without extras · tap a day`, nsP,
          <div className="grid grid-cols-8 gap-1.5" role="group" aria-label="Days this month">{cells.map((on, i) => <button key={i} type="button" aria-pressed={on} aria-label={`Day ${i + 1}`} onClick={(e) => { const next = cells.map((v, j) => (j === i ? !v : v)); setCells(next); cheer(e, nsP, Math.round(next.filter(Boolean).length / 12 * 100)) }} className={`aspect-square rounded-md text-[10.5px] font-bold ${on ? 'bg-good text-white' : 'bg-surface2 text-muted hover:bg-line'}`}>{i + 1}</button>)}</div>)}</Reveal>
      </div>
    </Section>
  )
}

/* ---------- privacy ---------- */
function Privacy() {
  const cards: [typeof Check, string, string, string][] = [
    [WifiOff, 'Works anywhere', 'Everything runs in your browser and keeps working offline.', 'Your data is saved in this browser\'s own storage the moment you add it. If you\'re signed in, changes queue up and sync when you\'re back online.'],
    [Lock, 'Private by default', 'Without an account, your data never leaves this device.', 'With an account, your copy lives in a private database row protected by row-level security, so only your login can read it. Data saved in the browser isn\'t encrypted by Tally, so keep your device locked.'],
    [ShieldCheck, 'No ads, no tracking', 'No bank logins, no selling data, no analytics on your money.', 'Tally never connects to your bank. Ask Tally only sends a summary of your dashboard when you ask a question, and you can turn it off or see exactly what is sent.'],
    [FileSpreadsheet, 'Take it with you', 'CSV, Excel or a full backup, whenever you like.', 'Settings → Back up & export gives you a CSV for spreadsheets, an Excel workbook with every part of Tally, and a full backup you can restore on any device.'],
  ]
  const [open, setOpen] = useState<number | null>(null)
  return (
    <Section id="privacy">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <Reveal><div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-line shadow-pop"><Photo src={devices} alt="Someone checking a phone in front of a laptop" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl border border-line px-4 py-3 backdrop-blur-xl" style={{ background: 'color-mix(in srgb, var(--surface) 85%, transparent)' }}><ShieldCheck size={22} className="text-good" /><span className="text-[14px]"><b>Your data, your rules.</b> <span className="text-ink2">Nothing is shared unless you choose.</span></span></div>
        </div></Reveal>
        <div>
          <Head center={false} eyebrow="Privacy" title="Your money stays yours" sub="Built from the start to be private, to work offline and to never lock you in. Tap a card to see how." />
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map(([I, t, s, more], n) => (
              <Reveal key={t} delay={n * 0.05}><button type="button" onClick={() => setOpen(open === n ? null : n)} aria-expanded={open === n} className={`h-full w-full rounded-2xl border bg-surface p-5 text-left transition-colors ${open === n ? 'border-accent' : 'border-line hover:border-line2'}`}>
                <span className="flex items-start justify-between"><I size={22} className="text-accent" /><motion.span animate={{ rotate: open === n ? 45 : 0 }} className="text-muted"><Plus size={18} /></motion.span></span>
                <b className="mt-3 block">{t}</b><span className="mt-1 block text-[14px] text-ink2">{s}</span>
                <AnimatePresence initial={false}>{open === n && <motion.span initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="block overflow-hidden"><span className="mt-3 block border-t border-line pt-3 text-[13.5px] text-ink2">{more}</span></motion.span>}</AnimatePresence>
              </button></Reveal>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}

const FAQS: [string, string][] = [
  ['Do I need an account?', 'No. You can use everything in Tally without one, and your data stays in this browser. Create an account if you want your money on more than one device, or to use Ask Tally through your account.'],
  ['Is my data private?', 'Without an account, nothing leaves your device. With an account, your data is kept in a private database row that only your login can read. Tally never asks for your bank login and shows no ads.'],
  ['Does it work without internet?', 'Yes. Tally works fully offline. If you\'re signed in, changes sync the next time you\'re online, and if two devices both changed something, Tally asks which copy to keep.'],
  ['Can I take my data out?', 'Any time: CSV for spreadsheets, an Excel workbook with every part of Tally, or a full backup you can restore later.'],
  ['How does Ask Tally work?', 'Common questions, like "Can I afford this?", "Why is my score low?" or "Where can I cut back?", are answered instantly on your device from your own numbers. Nothing is sent anywhere. For any other question you can connect an AI: Claude on your own claude.ai account, Google Gemini on its free tier, or Claude with an API key. Then Tally sends a summary of your dashboard to that AI, and you can see exactly what it sends.'],
  ['Is it free?', 'Yes. Tally, its built-in answers and accounts are free. Connecting an AI is optional: Claude through claude.ai uses your own claude.ai plan, Gemini has a free tier (Google may use free-tier requests to improve its products), and an Anthropic API key is paid by use.'],
]
function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <Section id="faq">
      <Head title="Questions, answered" sub="Everything you need to know before you start." />
      <div className="mx-auto max-w-3xl space-y-3">
        {FAQS.map(([q, a], i) => (
          <Reveal key={q} delay={i * 0.03}><div className="rounded-2xl border border-line bg-surface">
            <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex w-full items-center gap-3 px-5 py-4 text-left text-[16px] font-semibold">
              <span className="flex-1">{q}</span><motion.span animate={{ rotate: open === i ? 180 : 0 }}><ChevronDown size={19} /></motion.span>
            </button>
            <AnimatePresence initial={false}>{open === i && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-5 text-[15px] leading-relaxed text-ink2"><span className="block pb-5">{a}</span></motion.p>}</AnimatePresence>
          </div></Reveal>
        ))}
      </div>
    </Section>
  )
}

function FinalCta({ onStart, onTry, onLogin }: { onStart: () => void; onTry: () => void; onLogin: () => void }) {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[32px] border border-line shadow-pop">
          <Photo src={desk} alt="" className="absolute inset-0" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg, color-mix(in srgb, var(--hero-a) 94%, transparent), color-mix(in srgb, var(--hero-b) 80%, transparent))' }} />
          <div className="relative px-6 py-16 text-center text-white sm:px-12 sm:py-20">
            <h2 className="font-display text-[34px] font-extrabold leading-tight sm:text-[48px]">Stop guessing.<br />Start knowing.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[17px] opacity-90">Set up in about two minutes. Your first safe-to-spend number appears straight away.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-[16px] font-bold text-[#1d1840] shadow-pop transition-transform hover:-translate-y-0.5">Create my free account <ArrowRight size={18} /></button>
              <button type="button" onClick={onTry} className="rounded-2xl border border-white/40 px-6 py-3.5 text-[16px] font-semibold hover:bg-white/10">Try without an account</button>
            </div>
            <p className="mt-5 text-[14px] opacity-80">Already have an account? <button type="button" onClick={onLogin} className="font-bold underline underline-offset-4">Log in</button></p>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function Footer({ onLogin, onStart, jump }: { onLogin: () => void; onStart: () => void; jump: (id: string) => void }) {
  const link = 'text-[14px] text-ink2 hover:text-ink'
  return (
    <footer className="border-t border-line px-4 py-12 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5 font-display text-[20px] font-extrabold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-ink"><Wallet size={16} /></span>Tally</p>
          <p className="mt-3 max-w-sm text-[14px] text-ink2">A private, friendly money companion for you and your family. Built for clarity, speed and peace of mind.</p>
        </div>
        <div><p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-muted">Product</p><ul className="space-y-2"><li><button type="button" className={link} onClick={onLogin}>Log in</button></li><li><button type="button" className={link} onClick={onStart}>Create account</button></li><li><button type="button" className={link} onClick={() => jump('features')}>Features</button></li><li><button type="button" className={link} onClick={() => jump('ai')}>Ask Tally</button></li></ul></div>
        <div><p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-muted">Help</p><ul className="space-y-2"><li><button type="button" className={link} onClick={() => jump('privacy')}>Privacy</button></li><li><button type="button" className={link} onClick={() => jump('faq')}>FAQ</button></li><li><button type="button" className={link} onClick={() => jump('journey')}>How it works</button></li></ul></div>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap justify-between gap-2 border-t border-line pt-6 text-[12.5px] text-muted">
        <span>© 2026 Tally. A private personal and family finance tool.</span>
        <span>Photos from Unsplash · App images show example data</span>
      </div>
    </footer>
  )
}
