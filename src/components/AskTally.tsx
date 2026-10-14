/**
 * Ask Tally: questions about your own money, answered by Claude from a summary of your
 * dashboard. The health summary at the top is worked out here instantly, before any AI call.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Gauge, KeyRound, RefreshCw, Send, Settings as Cog, ShieldCheck, Sparkles, Square, X } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { ask, setAi, useAi, type Turn } from '../lib/ai/ask'
import { contextText } from '../lib/ai/context'
import { health, monthPicture, tripStats, currentTrip } from '../lib/calc'
import { useAuth } from '../lib/cloud/auth'
import { cloudConfig } from '../lib/cloud/client'
import { THIS_MONTH } from '../lib/dates'
import { money0 } from '../lib/money'
import { useData, useUI } from '../lib/store'
import { Button } from './ui'

interface Msg { role: 'user' | 'assistant'; text: string; error?: boolean }
export const useAsk = create<{ open: boolean; msgs: Msg[]; busy: boolean }>()(() => ({ open: false, msgs: [], busy: false }))
export const openAsk = (q?: string) => { useAsk.setState({ open: true }); if (q) setTimeout(() => send(q), 0) }

let abort: AbortController | null = null
let latestData: ReturnType<typeof useData> | null = null
async function send(q: string) {
  const s = useAsk.getState()
  if (s.busy || !q.trim() || !latestData) return
  const history: Turn[] = s.msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }))
  const turns: Turn[] = [...history, { role: 'user', text: q.trim() }]
  useAsk.setState({ msgs: [...s.msgs, { role: 'user', text: q.trim() }, { role: 'assistant', text: '' }], busy: true })
  abort = new AbortController()
  const ctx = contextText(latestData, { notes: useAi.getState().notes })
  const put = (f: (m: Msg) => Msg) => useAsk.setState((st) => { const msgs = st.msgs.slice(); msgs[msgs.length - 1] = f(msgs[msgs.length - 1]); return { msgs } })
  try {
    for await (const e of ask(ctx, turns, abort.signal)) {
      if (e.type === 'text') put((m) => ({ ...m, text: m.text + e.text }))
      else if (e.type === 'error') put((m) => (m.text ? { ...m, text: m.text + '\n\n' + e.message } : { ...m, text: e.message, error: true }))
    }
  } finally {
    // a stopped or empty answer is dropped so the conversation stays well-formed
    useAsk.setState((st) => { const last = st.msgs[st.msgs.length - 1]; return { busy: false, msgs: last && !last.text ? st.msgs.slice(0, -2) : st.msgs } })
    abort = null
  }
}

export default function AskTally() {
  const open = useAsk((a) => a.open)
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => useAsk.setState({ open: false })} />
          <motion.aside role="dialog" aria-modal="true" aria-label="Ask Tally" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-[460px] flex-col border-l border-line bg-surface shadow-pop" style={{ backdropFilter: 'none' }}>
            <Panel />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function Panel() {
  const s = useData()
  latestData = s
  const ai = useAi()
  const { msgs, busy } = useAsk()
  const signedIn = useAuth((a) => a.status === 'signed-in')
  const [q, setQ] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const ready = ai.mode === 'key' ? !!ai.key.trim() : ai.mode === 'cloud' ? signedIn && !!cloudConfig() : false
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') useAsk.setState({ open: false }) }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [])

  // instant, local: no AI needed for the headline numbers
  const H = health(s, THIS_MONTH), P = monthPicture(s, THIS_MONTH)
  const weakest = [...H.checks].sort((a, b) => (a.points / a.max) - (b.points / b.max))[0]
  const trip = currentTrip(s)
  const goal = s.goals.find((g) => g.saved < g.target)
  const ideas = useMemo(() => [
    'Explain my money health score',
    P.perDay > 0 ? `Can I spend ${money0(Math.max(10, Math.round(P.perDay * 1.5 / 5) * 5))} on dinner tonight?` : 'How do I get back on track this month?',
    'Where can I cut back this month?',
    goal ? `When will ${goal.name} be done?` : 'How much should I be saving?',
    trip ? `How is my ${trip.name} budget looking?` : s.debts.length ? 'Which debt should I pay off first?' : 'Am I spending more than usual?',
  ], [P.perDay, goal, trip, s.debts.length])
  const go = (text: string) => { if (!ready || busy) return; setQ(''); void send(text) }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Bot size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[18px] font-extrabold">Ask Tally</h2>
          <p className="truncate text-[12px] text-muted">{ready ? `Reading your dashboard · ${ai.mode === 'cloud' ? 'through your account' : 'with your API key'}` : 'Not set up yet'}</p>
        </div>
        {msgs.length > 0 && <button type="button" onClick={() => { abort?.abort(); useAsk.setState({ msgs: [] }) }} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label="New conversation" title="New conversation"><RefreshCw size={16} /></button>}
        <button type="button" onClick={() => useAsk.setState({ open: false })} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label="Close"><X size={18} /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
        {/* instant summary */}
        <section className="rounded-2xl border border-line p-4" aria-label="Your money right now">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl font-display text-[20px] font-extrabold" style={{ background: `var(--${H.tone}-soft)`, color: `var(--${H.tone})` }}>{H.score}</span>
            <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-muted"><Gauge size={13} />Money health</p><p className="font-bold">{H.label}</p></div>
            <div className="text-right"><p className="text-[12px] text-muted">Safe to spend</p><p className="font-bold tnum">{money0(P.safe)}{P.daysLeft > 0 && P.safe > 0 && <span className="text-[12px] font-medium text-ink2"> · {money0(P.perDay)}/day</span>}</p></div>
          </div>
          {weakest && weakest.points < weakest.max && <p className="mt-3 rounded-xl bg-surface2 px-3 py-2 text-[13.5px] text-ink2"><b className="text-ink">Biggest lift:</b> {weakest.title.toLowerCase()} ({weakest.points} of {weakest.max} points).</p>}
          {trip && (() => { const st = tripStats(s, trip); return <p className="mt-2 text-[13px] text-ink2">{trip.icon} {trip.name}: {money0(st.net)} spent{trip.budget ? ` of ${money0(trip.budget)}` : ''}</p> })()}
        </section>

        {!ready ? <Setup /> : (
          <>
            {msgs.length === 0 && (
              <div className="mt-5">
                <p className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-muted">Try asking</p>
                <div className="flex flex-col gap-2">
                  {ideas.map((x) => <button key={x} type="button" onClick={() => go(x)} className="rounded-xl border border-line px-3.5 py-2.5 text-left text-[14px] font-medium hover:border-accent hover:bg-accent-soft">{x}</button>)}
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-col gap-3">
              {msgs.map((m, i) => m.role === 'user'
                ? <p key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[14.5px] text-accent-ink">{m.text}</p>
                : (
                  <div key={i} className="flex gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Sparkles size={15} /></span>
                    <div className={`min-w-0 flex-1 rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-[14.5px] leading-relaxed ${m.error ? 'border-bad bg-bad-soft' : 'border-line bg-surface2/50'}`}>
                      {m.text ? <Rich text={m.text} /> : <span className="inline-flex gap-1 py-1" aria-label="Thinking">{[0, 1, 2].map((d) => <motion.i key={d} className="h-2 w-2 rounded-full bg-muted" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}</span>}
                      {m.error && <button type="button" className="mt-2 block text-[13px] font-semibold text-accent" onClick={() => { const lastQ = [...msgs].reverse().find((x) => x.role === 'user'); useAsk.setState({ msgs: msgs.slice(0, i - 1) }); if (lastQ) setTimeout(() => send(lastQ.text), 0) }}>Try again</button>}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
        <div ref={end} />
      </div>

      {ready && (
        <footer className="border-t border-line p-4">
          <form onSubmit={(e) => { e.preventDefault(); go(q) }} className="flex items-end gap-2">
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={1} maxLength={2000} placeholder="Ask about your money…" aria-label="Your question"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(q) } }}
              className="field max-h-32 min-h-[46px] flex-1 resize-none !rounded-xl py-3 text-[15px]" />
            {busy
              ? <button type="button" onClick={() => abort?.abort()} className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl border border-line2" aria-label="Stop"><Square size={16} /></button>
              : <button type="submit" disabled={!q.trim()} className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-accent text-accent-ink disabled:opacity-40" aria-label="Send"><Send size={18} /></button>}
          </form>
          <p className="mt-2 text-[11.5px] text-muted">Answers come from Claude (Anthropic) using a summary of your dashboard. Double-check big decisions.</p>
        </footer>
      )}
    </>
  )
}

/** First-time setup and consent. */
function Setup() {
  const s = useData()
  const ai = useAi()
  const auth = useAuth()
  const { go } = useUI()
  const [key, setKey] = useState(ai.key)
  const [peek, setPeek] = useState(false)
  const cloud = !!cloudConfig()
  const canCloud = cloud && auth.status === 'signed-in'
  const preview = useMemo(() => (peek ? JSON.stringify(JSON.parse(contextText(s, { notes: ai.notes })), null, 2) : ''), [peek, s, ai.notes])
  return (
    <section className="mt-5 flex flex-col gap-4">
      <div>
        <h3 className="text-[17px] font-bold">Switch on Ask Tally</h3>
        <p className="mt-1 text-[14px] text-ink2">Ask questions about your own money in plain words. When you ask, Tally sends a summary of your dashboard to Claude, an AI by Anthropic: this month's totals, your plan, bills, goals, debts, trips and up to 40 recent entries. It can't change anything.</p>
      </div>
      <label className="flex items-start gap-2.5 text-[14px]"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={ai.notes} onChange={(e) => setAi({ notes: e.target.checked })} />Include the descriptions of recent entries (for example "Coffee with Sam")</label>
      <button type="button" onClick={() => setPeek((v) => !v)} className="w-fit text-[13.5px] font-semibold text-accent" aria-expanded={peek}>{peek ? 'Hide' : 'See exactly what is shared'}</button>
      {peek && <pre className="max-h-64 overflow-auto rounded-xl border border-line bg-surface2/60 p-3 text-[11px] leading-snug">{preview}</pre>}

      <Choice on={ai.mode === 'cloud'} disabled={!canCloud} title="Use my Tally account" icon={<ShieldCheck size={18} />}
        text={canCloud ? 'Questions go through your account. No key needed on this device.' : cloud ? 'Log in to use this.' : 'Needs accounts switched on for this copy of Tally.'}
        onPick={() => setAi({ mode: 'cloud' })} />
      <Choice on={ai.mode === 'key'} title="Use my own Anthropic API key" icon={<KeyRound size={18} />} text="Kept only in this browser, never synced. Anthropic bills your account for use." onPick={() => setAi({ mode: 'key', key })}>
        <div className="mt-3 flex gap-2">
          <input className="field flex-1 !py-2 text-[14px]" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" aria-label="Anthropic API key" autoComplete="off" />
          <Button size="sm" variant="primary" onClick={() => setAi({ mode: 'key', key: key.trim() })} disabled={!key.trim().startsWith('sk-')}>Save</Button>
        </div>
      </Choice>
      <button type="button" onClick={() => { useAsk.setState({ open: false }); go('settings') }} className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink2 hover:text-ink"><Cog size={14} />More in Settings</button>
    </section>
  )
}
function Choice({ on, disabled, title, text, icon, onPick, children }: { on: boolean; disabled?: boolean; title: string; text: string; icon: ReactNode; onPick: () => void; children?: ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 ${on ? 'border-accent bg-accent-soft' : 'border-line'} ${disabled ? 'opacity-60' : ''}`}>
      <button type="button" disabled={disabled} onClick={onPick} aria-pressed={on} className="flex w-full items-start gap-3 text-left">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${on ? 'bg-accent text-accent-ink' : 'bg-surface2'}`}>{icon}</span>
        <span><b className="block">{title}</b><span className="text-[13px] text-ink2">{text}</span></span>
      </button>
      {children}
    </div>
  )
}

/** Just enough formatting for answers: paragraphs, "- " bullets and **bold**. No HTML is injected. */
function Rich({ text }: { text: string }) {
  const bold = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>))
  const blocks = text.split(/\n{2,}/)
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) return <ul key={i} className="my-1.5 list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{bold(l.replace(/^\s*[-•*]\s+/, ''))}</li>)}</ul>
        return <p key={i} className={i ? 'mt-2' : ''}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{bold(l.replace(/^#+\s*/, ''))}</Fragment>)}</p>
      })}
    </>
  )
}
