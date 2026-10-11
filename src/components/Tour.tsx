import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useState } from 'react'
import { update, useUI } from '../lib/store'
import { Button } from './ui'

const STEPS: { sel: string; title: string; text: string }[] = [
  { sel: 'safe', title: 'Your most important number', text: '"Safe to spend" is the money that is really free this month, after bills and savings. If you only spend from this, your bills are always covered.' },
  { sel: 'health', title: 'Your money health', text: 'A quick score out of 100. Tap any line to see what helps or hurts it.' },
  { sel: 'add', title: 'Add spending in 3 taps', text: 'Tap here whenever you buy something or get paid. Pick what it was, type the amount, done. On a keyboard you can press N.' },
  { sel: 'bills', title: 'Bills tick themselves in', text: 'Regular bills appear by themselves. Tick each one when it has been paid.' },
  { sel: 'nav', title: 'Everything else is here', text: 'Your plan, calendar, paycheck view, goals, debts, accounts, your year and more. Each page explains itself at the top.' },
  { sel: 'month', title: 'Look back or ahead', text: 'Move between months to see how you did, or what is coming up.' },
  { sel: 'help', title: 'Stuck? Tap a question mark', text: 'Every number has a little ? that explains it in plain words. The Help page answers common questions.' },
]

function findTarget(sel: string) {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${sel}"]`))
  return all.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }) ?? null
}

export default function Tour() {
  const { tour, setTour, go } = useUI()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = STEPS[i]

  useEffect(() => { if (tour) { setI(0); go('home') } }, [tour, go])
  useLayoutEffect(() => {
    if (!tour) return
    let raf = 0
    const el = findTarget(step.sel)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const measure = () => { const t = findTarget(step.sel); setRect(t ? t.getBoundingClientRect() : null); raf = requestAnimationFrame(measure) }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [tour, i, step])
  useEffect(() => {
    if (!tour) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const finish = () => { setTour(false); update((d) => { d.toured = true }) }
  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : finish())

  const pad = 8
  const box = rect ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null
  const below = box ? box.top + box.height + 220 < window.innerHeight : true
  const tipTop = box ? (below ? box.top + box.height + 12 : Math.max(12, box.top - 12)) : window.innerHeight / 2
  const tipLeft = box ? Math.min(Math.max(12, box.left), window.innerWidth - 352) : window.innerWidth / 2 - 170

  return (
    <AnimatePresence>
      {tour && (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Guided tour">
          {box ? (
            <motion.div className="pointer-events-none absolute rounded-[22px] ring-2 ring-accent" animate={box} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              style={{ boxShadow: '0 0 0 9999px rgba(5,12,16,.62)' }} />
          ) : <div className="absolute inset-0" style={{ background: 'rgba(5,12,16,.62)' }} />}
          <motion.div key={i} className="absolute w-[min(340px,calc(100vw-24px))] rounded-3xl border border-line bg-surface p-5 text-ink shadow-pop"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ top: tipTop, left: tipLeft, transform: !below && box ? 'translateY(-100%)' : undefined }}>
            <div className="mb-2 flex items-center gap-1.5">{STEPS.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-6 bg-accent' : 'w-1.5 bg-line2'}`} />)}</div>
            <h3 className="text-[19px] font-bold">{step.title}</h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink2">{step.text}</p>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={finish}>Skip tour</Button>
              <span className="flex-1" />
              {i > 0 && <Button size="sm" onClick={() => setI(i - 1)}>Back</Button>}
              <Button size="sm" variant="primary" onClick={next}>{i < STEPS.length - 1 ? 'Next' : 'Got it'}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
