/**
 * Ask Tally: questions about your own money in plain words.
 *
 * Common questions are answered instantly on this device by Tally's built-in answers (free,
 * private, offline). Anything else goes to the AI you connect in Settings, if any: Claude on
 * your claude.ai account, Google Gemini's free tier, your Tally account, or your own Claude key.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Gauge, KeyRound, RefreshCw, Send, ShieldCheck, Sparkles, Square, X, Zap } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { AI_NAME, aiReady, ask, setAi, useAi, useClaudeAi, type AiMode, type Turn } from '../lib/ai/ask'
import { contextText } from '../lib/ai/context'
import { answerLocally, QUICK_EXAMPLES } from '../lib/ai/quick'
import { health, monthPicture, tripStats, currentTrip } from '../lib/calc'
import { useAuth } from '../lib/cloud/auth'
import { cloudConfig } from '../lib/cloud/client'
import { THIS_MONTH } from '../lib/dates'
import { money0 } from '../lib/money'
import { useData } from '../lib/store'
import type { State } from '../lib/types'
import { Button } from './ui'

/** local: answered on this device by the built-in answers. */
interface Msg { role: 'user' | 'assistant'; text: string; error?: boolean; local?: boolean; hint?: boolean }
export const useAsk = create<{ open: boolean; msgs: Msg[]; busy: boolean }>()(() => ({ open: false, msgs: [], busy: false }))
export const openAsk = (q?: string) => { useAsk.setState({ open: true }); if (q) setTimeout(() => send(q), 0) }

let abort: AbortController | null = null
let latestData: State | null = null
const ready = () => aiReady(useAi.getState(), useAuth.getState().status === 'signed-in', useClaudeAi.getState().available)

/** Ask: built-in answer first; the connected AI for anything else (or when asked for more). */
async function send(q: string, forceAi = false) {
  const s = useAsk.getState()
  const question = q.trim()
  if (s.busy || !question || !latestData) return
  if (!forceAi) {
    const local = answerLocally(latestData, question)
    if (local || !ready()) {
      const text = local?.text ?? `I can't answer that one on my own yet. Here are things I can answer instantly:\n\n${QUICK_EXAMPLES.map((x) => `- ${x}`).join('\n')}\n\nFor any other question, connect an AI below or in Settings → Ask Tally.`
      useAsk.setState({ msgs: [...s.msgs, { role: 'user', text: question }, { role: 'assistant', text, local: true, hint: !local }] })
      return
    }
  }
  // messages come in question/answer pairs; only answered pairs go to the AI as history
  const history: Turn[] = []
  for (let i = 0; i + 1 < s.msgs.length; i += 2) {
    const u = s.msgs[i], r = s.msgs[i + 1]
    if (u.role === 'user' && r.role === 'assistant' && r.text && !r.error && !r.hint) history.push({ role: 'user', text: u.text }, { role: 'assistant', text: r.text })
  }
  const turns: Turn[] = [...history, { role: 'user', text: question }]
  useAsk.setState({ msgs: [...s.msgs, { role: 'user', text: question }, { role: 'assistant', text: '' }], busy: true })
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
  const claudeAiOn = useClaudeAi((c) => c.available)
  const signedIn = useAuth((a) => a.status === 'signed-in')
  const { msgs, busy } = useAsk()
  const [q, setQ] = useState('')
  const [connect, setConnect] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const aiOn = aiReady(ai, signedIn, claudeAiOn)
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
    P.perDay > 0 ? `Can I spend ${money0(Math.max(10, Math.round(P.perDay * 1.5 / 5) * 5))} on dinner tonight?` : 'How much is safe to spend?',
    'Where can I cut back this month?',
    goal ? `When will ${goal.name} be done?` : 'Am I saving enough?',
    trip ? `How is my ${trip.name} budget?` : s.debts.length ? 'Which debt should I pay off first?' : 'What bills are due?',
  ], [P.perDay, goal, trip, s.debts.length])
  const go = (text: string) => { if (busy) return; setQ(''); void send(text) }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Bot size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[18px] font-extrabold">Ask Tally</h2>
          <p className="truncate text-[12px] text-muted">Built-in answers{aiOn ? ` + ${AI_NAME[ai.mode]}` : ' · free and on this device'}</p>
        </div>
        {msgs.length > 0 && <button type="button" onClick={() => { abort?.abort(); useAsk.setState({ msgs: [] }) }} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label="New conversation" title="New conversation"><RefreshCw size={16} /></button>}
        <button type="button" onClick={() => useAsk.setState({ open: false })} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label="Close"><X size={18} /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
        <section className="rounded-2xl border border-line p-4" aria-label="Your money right now">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl font-display text-[20px] font-extrabold" style={{ background: `var(--${H.tone}-soft)`, color: `var(--${H.tone})` }}>{H.score}</span>
            <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-muted"><Gauge size={13} />Money health</p><p className="font-bold">{H.label}</p></div>
            <div className="text-right"><p className="text-[12px] text-muted">Safe to spend</p><p className="font-bold tnum">{money0(P.safe)}{P.daysLeft > 0 && P.safe > 0 && <span className="text-[12px] font-medium text-ink2"> · {money0(P.perDay)}/day</span>}</p></div>
          </div>
          {weakest && weakest.points < weakest.max && <p className="mt-3 rounded-xl bg-surface2 px-3 py-2 text-[13.5px] text-ink2"><b className="text-ink">Biggest lift:</b> {weakest.title.toLowerCase()} ({weakest.points} of {weakest.max} points).</p>}
          {trip && (() => { const st = tripStats(s, trip); return <p className="mt-2 text-[13px] text-ink2">{trip.icon} {trip.name}: {money0(st.net)} spent{trip.budget ? ` of ${money0(trip.budget)}` : ''}</p> })()}
        </section>

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
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">{m.local ? <Zap size={15} /> : <Sparkles size={15} />}</span>
                <div className={`min-w-0 flex-1 rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-[14.5px] leading-relaxed ${m.error ? 'border-bad bg-bad-soft' : 'border-line bg-surface2/50'}`}>
                  {m.text ? <Rich text={m.text} /> : <span className="inline-flex gap-1 py-1" aria-label="Thinking">{[0, 1, 2].map((d) => <motion.i key={d} className="h-2 w-2 rounded-full bg-muted" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}</span>}
                  {m.local && !m.hint && <p className="mt-2 flex flex-wrap items-center gap-x-2 border-t border-line pt-2 text-[11.5px] text-muted"><Zap size={11} />Instant answer, worked out on this device
                    {aiOn && !busy && i === msgs.length - 1 && <button type="button" className="font-semibold text-accent" onClick={() => { const lastQ = msgs[i - 1]?.text; if (lastQ) { useAsk.setState({ msgs: msgs.slice(0, i - 1) }); setTimeout(() => send(lastQ, true), 0) } }}>Ask {ai.mode === 'gemini' ? 'Gemini' : 'Claude'} for more</button>}</p>}
                  {m.error && <button type="button" className="mt-2 block text-[13px] font-semibold text-accent" onClick={() => { const lastQ = msgs[i - 1]?.text; useAsk.setState({ msgs: msgs.slice(0, i - 1) }); if (lastQ) setTimeout(() => send(lastQ, true), 0) }}>Try again</button>}
                </div>
              </div>
            ))}
        </div>
        {!aiOn && (
          <div className="mt-5 rounded-2xl border border-dashed border-line2 p-4">
            <button type="button" onClick={() => setConnect((v) => !v)} aria-expanded={connect} className="flex w-full items-center gap-2 text-left text-[14px] font-semibold"><Sparkles size={16} className="text-accent" /><span className="flex-1">Connect an AI for any question</span><span className="text-[12px] font-medium text-muted">{connect ? 'Hide' : 'Optional'}</span></button>
            {connect && <div className="mt-3"><AiChoices compact /></div>}
          </div>
        )}
        <div ref={end} />
      </div>

      <footer className="border-t border-line p-4">
        <form onSubmit={(e) => { e.preventDefault(); go(q) }} className="flex items-end gap-2">
          <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={1} maxLength={2000} placeholder="Ask about your money…" aria-label="Your question"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(q) } }}
            className="field max-h-32 min-h-[46px] flex-1 resize-none !rounded-xl py-3 text-[15px]" />
          {busy
            ? <button type="button" onClick={() => abort?.abort()} className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl border border-line2" aria-label="Stop"><Square size={16} /></button>
            : <button type="submit" disabled={!q.trim()} className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-accent text-accent-ink disabled:opacity-40" aria-label="Send"><Send size={18} /></button>}
        </form>
        <p className="mt-2 text-[11.5px] text-muted">{aiOn ? `Common questions are answered on this device. Others go to ${AI_NAME[ai.mode]} with a summary of your dashboard. Double-check big decisions.` : 'Answered on this device from your own numbers. Nothing is sent anywhere.'}</p>
      </footer>
    </>
  )
}

/** Choose which AI handles questions the built-in answers can't. Used here and in Settings. */
export function AiChoices({ compact = false }: { compact?: boolean }) {
  const ai = useAi()
  const claudeAiOn = useClaudeAi((c) => c.available)
  const auth = useAuth()
  const [gk, setGk] = useState(ai.geminiKey)
  const [ak, setAk] = useState(ai.key)
  const cloud = !!cloudConfig()
  const opt = (mode: AiMode, title: string, text: ReactNode, icon: ReactNode, extra?: ReactNode, disabled = false) => {
    const on = ai.mode === mode
    return (
      <div key={mode} className={`rounded-2xl border p-3.5 ${on ? 'border-accent bg-accent-soft' : 'border-line'} ${disabled ? 'opacity-60' : ''}`}>
        <button type="button" disabled={disabled} onClick={() => setAi({ mode })} aria-pressed={on} className="flex w-full items-start gap-3 text-left">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${on ? 'bg-accent text-accent-ink' : 'bg-surface2'}`}>{icon}</span>
          <span className="min-w-0"><b className="block text-[14.5px]">{title}</b><span className="text-[13px] text-ink2">{text}</span></span>
        </button>
        {on && extra}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2.5">
      {opt('off', 'Built-in answers only', 'Free, instant and private. Answers the common questions; nothing leaves this device.', <Zap size={17} />)}
      {claudeAiOn && opt('claudeai', 'Claude on your claude.ai account', 'Free with your claude.ai plan, no key needed. Works while Tally is open inside claude.ai; you\'ll be asked once to allow it.', <Sparkles size={17} />)}
      {opt('gemini', 'Google Gemini (free tier)', <>Free with a Gemini API key from <b>aistudio.google.com</b>. On the free tier, Google may use what you send to improve its products.</>, <Sparkles size={17} />,
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input className="field flex-1 !py-2 text-[14px]" type="password" value={gk} onChange={(e) => setGk(e.target.value)} placeholder="Gemini API key (AIza…)" aria-label="Gemini API key" autoComplete="off" />
            <Button size="sm" variant="primary" onClick={() => setAi({ geminiKey: gk.trim() })} disabled={!gk.trim() || gk.trim() === ai.geminiKey}>Save</Button>
          </div>
          <p className="text-[12px] text-muted">Kept only in this browser, never synced. {!compact && 'Tip: turn off "Include entry descriptions" below to share amounts and categories only.'}</p>
          {ai.geminiKey && <button type="button" className="w-fit text-[12.5px] font-semibold text-bad" onClick={() => { setAi({ geminiKey: '' }); setGk('') }}>Remove key from this device</button>}
        </div>)}
      {opt('cloud', 'Your Tally account', !cloud ? 'Needs accounts switched on.' : auth.status !== 'signed-in' ? 'Log in to use this.' : 'Answered by the AI set up on your Tally server (Claude or Gemini). No key on this device.', <ShieldCheck size={17} />, undefined, !cloud || auth.status !== 'signed-in')}
      {opt('key', 'Claude with your Anthropic API key', 'Paid by your Anthropic account. Kept only in this browser.', <KeyRound size={17} />,
        <div className="mt-3 flex gap-2">
          <input className="field flex-1 !py-2 text-[14px]" type="password" value={ak} onChange={(e) => setAk(e.target.value)} placeholder="sk-ant-…" aria-label="Anthropic API key" autoComplete="off" />
          <Button size="sm" variant="primary" onClick={() => setAi({ key: ak.trim() })} disabled={!ak.trim().startsWith('sk-') || ak.trim() === ai.key}>Save</Button>
        </div>)}
    </div>
  )
}

/** Just enough formatting for answers: paragraphs, "- " bullets and **bold**. No HTML is injected. */
export function Rich({ text }: { text: string }) {
  const bold = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>))
  const isItem = (l: string) => /^\s*[-•*]\s+/.test(l)
  return (
    <>
      {text.split(/\n{2,}/).map((b, i) => {
        // a block can mix lines of text and runs of bullets
        const groups: { list: boolean; lines: string[] }[] = []
        for (const l of b.split('\n')) { const list = isItem(l); const last = groups[groups.length - 1]; if (last && last.list === list) last.lines.push(l); else groups.push({ list, lines: [l] }) }
        return (
          <div key={i} className={i ? 'mt-2' : ''}>
            {groups.map((g, j) => g.list
              ? <ul key={j} className="my-1.5 list-disc space-y-1 pl-5">{g.lines.map((l, k) => <li key={k}>{bold(l.replace(/^\s*[-•*]\s+/, ''))}</li>)}</ul>
              : <p key={j}>{g.lines.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{bold(l.replace(/^#+\s*/, ''))}</Fragment>)}</p>)}
          </div>
        )
      })}
    </>
  )
}
