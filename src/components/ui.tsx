import { animate, AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion'
import {
  Baby, BookOpen, Briefcase, Car, Coins, CreditCard, Dumbbell, Gift, GraduationCap, Heart, HelpCircle, Home, Package, PawPrint,
  PiggyBank, Plane, ShoppingBag, ShoppingCart, Sparkles, Ticket, TrendingUp, Tv, UtensilsCrossed, X, Zap, Shirt, Coffee, Wrench,
  type LucideIcon,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { money0 } from '../lib/money'
import { catColor } from '../lib/calc'
import type { Category } from '../lib/types'

/* ---------- category icons ---------- */
export const ICONS: Record<string, LucideIcon> = {
  home: Home, cart: ShoppingCart, food: UtensilsCrossed, car: Car, bolt: Zap, tv: Tv, bag: ShoppingBag, card: CreditCard, heart: Heart,
  ticket: Ticket, plane: Plane, gift: Gift, box: Package, briefcase: Briefcase, sparkles: Sparkles, coins: Coins, piggy: PiggyBank,
  growth: TrendingUp, baby: Baby, pet: PawPrint, school: GraduationCap, gym: Dumbbell, book: BookOpen, clothes: Shirt, coffee: Coffee, tools: Wrench,
}
export function CatIcon({ cat, size = 40, className = '' }: { cat?: Category | null; size?: number; className?: string }) {
  const I = ICONS[cat?.icon ?? 'box'] ?? Package
  const c = catColor(cat)
  return (
    <span className={`grid shrink-0 place-items-center rounded-[30%] ${className}`}
      style={{ width: size, height: size, background: `color-mix(in srgb, ${c} 16%, var(--surface))`, color: c }} aria-hidden>
      <I size={size * 0.5} strokeWidth={2} />
    </span>
  )
}

/* ---------- animated numbers ---------- */
export function Num({ value, format = money0, className = '' }: { value: number; format?: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)
  const reduce = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) { el.textContent = format(value); prev.current = value; return }
    const c = animate(prev.current, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = format(v)) })
    prev.current = value
    return () => c.stop()
  }, [value, format, reduce])
  return <span ref={ref} className={`tnum ${className}`}>{format(value)}</span>
}

/* ---------- layout ---------- */
export function Card({ children, className = '', i = 0, as = 'section' }: { children: ReactNode; className?: string; i?: number; as?: 'section' | 'article' | 'div' }) {
  const M = motion[as]
  return (
    <M className={`card p-5 ${className}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(i, 10) * 0.05, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </M>
  )
}
export function CardHead({ title, sub, right, help }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; help?: string }) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-[17px] font-bold">{title}{help && <Explain text={help} />}</h3>
        {sub && <p className="mt-0.5 text-[13.5px] text-ink2">{sub}</p>}
      </div>
      {right}
    </header>
  )
}

/* ---------- controls ---------- */
type BtnProps = { children: ReactNode; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; variant?: 'primary' | 'soft' | 'ghost' | 'danger' | 'plain'; size?: 'sm' | 'md' | 'lg'; className?: string; type?: 'button' | 'submit'; disabled?: boolean; title?: string; ariaLabel?: string }
export function Button({ children, onClick, variant = 'soft', size = 'md', className = '', type = 'button', disabled, title, ariaLabel }: BtnProps) {
  const v = {
    primary: 'bg-accent text-accent-ink border-accent hover:brightness-110',
    soft: 'bg-surface text-ink border-line2 hover:bg-surface2',
    ghost: 'bg-transparent text-ink2 border-transparent hover:bg-surface2 hover:text-ink',
    danger: 'bg-surface text-bad border-[color-mix(in_srgb,var(--bad)_35%,transparent)] hover:bg-bad-soft',
    plain: 'bg-transparent border-transparent text-accent hover:underline px-0',
  }[variant]
  const s = { sm: 'px-3 py-1.5 text-[13px] rounded-[10px] gap-1.5', md: 'px-4 py-2.5 text-[14.5px] rounded-xl gap-2', lg: 'px-6 py-3.5 text-base rounded-2xl gap-2' }[size]
  return (
    <motion.button whileTap={{ scale: 0.96 }} type={type} onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel}
      className={`inline-flex items-center justify-center whitespace-nowrap border font-semibold transition-colors disabled:opacity-50 ${v} ${s} ${className}`}>
      {children}
    </motion.button>
  )
}
export function IconButton({ children, onClick, label, className = '' }: { children: ReactNode; onClick?: () => void; label: string; className?: string }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={onClick} aria-label={label} title={label}
      className={`grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface2 hover:text-ink ${className}`}>
      {children}
    </motion.button>
  )
}
export function Chip({ children, tone = 'plain', className = '' }: { children: ReactNode; tone?: 'plain' | 'good' | 'warn' | 'bad' | 'accent'; className?: string }) {
  const t = { plain: 'bg-surface2 text-ink2 border-line', good: 'bg-good-soft text-good border-transparent', warn: 'bg-warn-soft text-warn border-transparent', bad: 'bg-bad-soft text-bad border-transparent', accent: 'bg-accent-soft text-accent border-transparent' }[tone]
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12.5px] font-semibold ${t} ${className}`}>{children}</span>
}
export function Segmented<T extends string>({ value, options, onChange, label, className = '' }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void; label: string; className?: string }) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-surface2 p-1 ${className}`}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`relative rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${value === v ? 'text-ink' : 'text-ink2 hover:text-ink'}`}>
          {value === v && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-xl bg-surface shadow-card" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative z-10 inline-flex items-center gap-1.5">{l}</span>
        </button>
      ))}
    </div>
  )
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line2'}`}>
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }}
        className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow ${checked ? 'right-1' : 'left-1'}`} />
    </button>
  )
}
export function Slider({ value, min, max, step = 1, onChange, label, id }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; id?: string }) {
  const p = ((value - min) / (max - min || 1)) * 100
  return <input id={id} className="slider" type="range" min={min} max={max} step={step} value={value} aria-label={label}
    style={{ ['--p' as string]: `${Math.max(0, Math.min(100, p))}%` }} onChange={(e) => onChange(+e.target.value)} />
}
export function Field({ label, children, hint, className = '' }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-[13.5px] font-semibold text-ink2 ${className}`}>
      {label}{children}{hint && <span className="text-[12.5px] font-normal text-muted">{hint}</span>}
    </label>
  )
}

/* ---------- progress ---------- */
export function Bar({ value, color = 'var(--accent)', marker, height = 10, label }: { value: number; color?: string; marker?: number; height?: number; label?: string }) {
  return (
    <div className="relative w-full overflow-visible rounded-full border border-line bg-surface2" style={{ height }} role="progressbar" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      {marker != null && <span className="absolute -top-1 -bottom-1 w-[3px] rounded bg-ink" style={{ left: `calc(${Math.min(1, marker) * 100}% - 1.5px)` }} />}
    </div>
  )
}
export function Ring({ value, size = 96, stroke = 10, color = 'var(--accent)', track = 'var(--surface2)', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

/* ---------- plain-language explainer ---------- */
export function Explain({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <span ref={ref} className="relative inline-flex font-body">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="What does this mean?" aria-expanded={open}
        className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-surface2 hover:text-accent">
        <HelpCircle size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span role="tooltip" initial={{ opacity: 0, y: 6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className="absolute left-1/2 top-8 z-40 w-[min(280px,80vw)] -translate-x-1/2 rounded-2xl border border-line2 bg-surface p-3.5 text-[13.5px] font-normal leading-relaxed text-ink shadow-pop">
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/* ---------- sheets (bottom sheet on phones, dialog on desktop) ---------- */
export function Sheet({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const drag = useDragControls()
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0" style={{ background: 'var(--overlay)' }} onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
            className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-pop sm:rounded-[28px] ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
            initial={{ y: 60, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 60, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            drag="y" dragControls={drag} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} dragListener={false}
            onDragEnd={(_, i) => { if (i.offset.y > 120) onClose() }}>
            <div className="flex cursor-grab touch-none justify-center pt-2.5 sm:hidden" onPointerDown={(e) => drag.start(e)} aria-hidden><span className="h-1.5 w-11 rounded-full bg-line2" /></div>
            <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-4">
              <h2 className="text-[22px] font-bold">{title}</h2>
              <IconButton label="Close" onClick={onClose}><X size={20} /></IconButton>
            </div>
            <div className="overflow-y-auto px-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      {icon && <div className="mb-1 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</div>}
      <p className="font-display text-lg font-bold">{title}</p>
      {text && <p className="max-w-sm text-[14px] text-ink2">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/* ---------- celebration ---------- */
export function celebrate(e?: { clientX: number; clientY: number } | null, big = false) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const origin = e ? { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight } : { x: 0.5, y: 0.6 }
  const colors = ['#1baf7a', '#2a78d6', '#eda100', '#e87ba4', '#6250d6']
  try {
    confetti({ particleCount: big ? 140 : 40, spread: big ? 100 : 60, startVelocity: big ? 45 : 28, origin, colors, scalar: big ? 1 : 0.8, ticks: big ? 220 : 120, disableForReducedMotion: true })
  } catch { /* canvas unavailable */ }
}
