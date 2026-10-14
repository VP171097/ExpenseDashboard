/**
 * Sends a question to an AI and streams the answer back. (Common questions never get here:
 * Tally's built-in answers in quick.ts handle them on the device.)
 *
 * Ways to connect, chosen in Settings:
 * - "claudeai": Claude on the viewer's own claude.ai account, when Tally is opened inside
 *   claude.ai. No key; the viewer is asked once to allow it.
 * - "gemini": Google Gemini with the viewer's own free Gemini API key, from this browser.
 * - "cloud": the ask-tally function in your Supabase project (Claude or Gemini on the server).
 * - "key": Claude with the viewer's own Anthropic API key, from this browser.
 *
 * AI settings live in this browser only and are never synced, so a key never leaves the device
 * except to call the AI provider.
 */
import { create } from 'zustand'
import { buildRequest, geminiRequest, pump, pumpGemini, sampleTurns, validate, type AiEvent, type Turn } from '../../../supabase/functions/_shared/tally-ai'
import { accessToken } from '../cloud/auth'
import { cloudConfig } from '../cloud/client'

export type { AiEvent, Turn }
export type AiMode = 'off' | 'claudeai' | 'gemini' | 'cloud' | 'key'
export interface AiSettings { mode: AiMode; key: string; geminiKey: string; notes: boolean; chosen: boolean }
const KEY = 'tally.ai'
const DEFAULTS: AiSettings = { mode: 'off', key: '', geminiKey: '', notes: true, chosen: false }
const load = (): AiSettings => {
  try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); return saved ? { ...DEFAULTS, ...saved, chosen: true } : DEFAULTS } catch { return DEFAULTS }
}
export const useAi = create<AiSettings>()(() => load())
export function setAi(p: Partial<AiSettings>) {
  useAi.setState({ ...p, chosen: true })
  try { const { chosen: _c, ...rest } = useAi.getState(); localStorage.setItem(KEY, JSON.stringify(rest)) } catch { /* ignore */ }
}

/* ---------- Claude through the claude.ai viewer ---------- */
type SampleFn = ((input: { role: 'user' | 'assistant'; content: string }[], opts?: { onText?: (u: { text: string; delta: string }) => void; signal?: AbortSignal; modelTier?: 'quick' | 'default' | 'complex'; cache?: boolean }) => Promise<{ text: string; truncated: boolean }>)
let sampleP: Promise<SampleFn | null> | null = null
/** Claude on the viewer's claude.ai account, or null when Tally isn't open inside claude.ai. */
export function claudeAi(): Promise<SampleFn | null> {
  sampleP ??= (async () => {
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude
    if (!c?.use) return null
    try { return ((await c.use('sample')) as SampleFn | null) ?? null } catch { return null }
  })()
  return sampleP
}
export const useClaudeAi = create<{ available: boolean }>()(() => ({ available: false }))
if (typeof window !== 'undefined') void claudeAi().then((f) => {
  useClaudeAi.setState({ available: !!f })
  // inside claude.ai, and nothing chosen yet: Claude on the viewer's own account is the natural default
  if (f && !useAi.getState().chosen) useAi.setState({ mode: 'claudeai' })
})

/** Whether the chosen AI can answer right now (the built-in answers always can). */
export function aiReady(s: AiSettings, signedIn: boolean, claudeAiAvailable: boolean) {
  if (s.mode === 'claudeai') return claudeAiAvailable
  if (s.mode === 'gemini') return !!s.geminiKey.trim()
  if (s.mode === 'key') return !!s.key.trim()
  if (s.mode === 'cloud') return signedIn && !!cloudConfig()
  return false
}
export const AI_NAME: Record<AiMode, string> = { off: 'Built-in answers only', claudeai: 'Claude (your claude.ai account)', gemini: 'Google Gemini', cloud: 'Your Tally account', key: 'Claude (your API key)' }

export async function* ask(context: string, turns: Turn[], signal?: AbortSignal): AsyncGenerator<AiEvent> {
  const problem = validate(context, turns)
  if (problem) { yield { type: 'error', message: problem }; return }
  const s = useAi.getState()
  if (s.mode === 'key') yield* viaKey(s.key, context, turns, signal)
  else if (s.mode === 'cloud') yield* viaCloud(context, turns, signal)
  else if (s.mode === 'gemini') yield* viaGemini(s.geminiKey, context, turns, signal)
  else if (s.mode === 'claudeai') yield* viaClaudeAi(context, turns, signal)
  else yield { type: 'error', message: 'No AI is connected. Choose one in Settings → Ask Tally.' }
}

async function* viaCloud(context: string, turns: Turn[], signal?: AbortSignal): AsyncGenerator<AiEvent> {
  const c = cloudConfig()
  if (!c) { yield { type: 'error', message: 'Connect Tally to your Supabase project first (Settings).' }; return }
  const token = await accessToken()
  if (!token) { yield { type: 'error', message: 'Log in to use Ask Tally through your account.' }; return }
  let res: Response
  try {
    res = await fetch(`${c.url.replace(/\/$/, '')}/functions/v1/ask-tally`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: c.anonKey },
      body: JSON.stringify({ context, turns }),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    // an undeployed function and a dropped connection look the same to the browser
    yield { type: 'error', message: navigator.onLine === false ? "You're offline. Ask Tally needs a connection." : "Can't reach Ask Tally. If you're online, the ask-tally function may not be deployed in your Supabase project yet (see the README), or use your own API key in Settings." }; return
  }
  if (!res.ok || !res.body) {
    let msg = res.status === 404 ? 'The ask-tally function isn\'t deployed in your Supabase project yet.' : `Ask Tally had a problem (${res.status}).`
    try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* keep msg */ }
    yield { type: 'error', message: msg }; return
  }
  // newline-delimited JSON events
  const reader = res.body.getReader(), dec = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
        if (line) { try { yield JSON.parse(line) as AiEvent } catch { /* skip a broken line */ } }
      }
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') yield { type: 'error', message: 'The answer was cut off. Try again.' }
  }
}

async function* viaKey(key: string, context: string, turns: Turn[], signal?: AbortSignal): AsyncGenerator<AiEvent> {
  if (!key.trim()) { yield { type: 'error', message: 'Add your Anthropic API key in Settings.' }; return }
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  let baseURL: string | undefined
  try { baseURL = localStorage.getItem('tally.ai.baseURL') || undefined } catch { /* ignore */ } // e.g. a company proxy
  const client = new Anthropic({ apiKey: key.trim(), dangerouslyAllowBrowser: true, ...(baseURL ? { baseURL } : {}), maxRetries: 1 })
  try {
    yield* pump(client.beta.messages.stream(buildRequest(context, turns), { signal }))
  } catch (e) {
    if (e instanceof Anthropic.APIUserAbortError) return
    if (e instanceof Anthropic.AuthenticationError) yield { type: 'error', message: 'Anthropic didn\'t accept that API key. Check it in Settings.' }
    else if (e instanceof Anthropic.PermissionDeniedError) yield { type: 'error', message: 'That API key isn\'t allowed to use this model.' }
    else if (e instanceof Anthropic.RateLimitError) yield { type: 'error', message: 'Too many questions at once. Wait a moment and try again.' }
    else if (e instanceof Anthropic.APIConnectionError) yield { type: 'error', message: "Can't reach Anthropic. Check your connection." }
    else if (e instanceof Anthropic.APIError) yield { type: 'error', message: `Anthropic returned an error (${e.status ?? 'unknown'}). Try again.` }
    else yield { type: 'error', message: 'Something went wrong. Try again.' }
  }
}

async function* viaClaudeAi(context: string, turns: Turn[], signal?: AbortSignal): AsyncGenerator<AiEvent> {
  const sample = await claudeAi()
  if (!sample) { yield { type: 'error', message: 'Claude through claude.ai only works when Tally is opened inside claude.ai.' }; return }
  // the platform streams through a callback; turn it into events
  const queue: AiEvent[] = []
  let wake: (() => void) | null = null, finished = false
  const push = (e: AiEvent) => { queue.push(e); wake?.() }
  sample(sampleTurns(context, turns), { modelTier: 'quick', cache: false, signal, onText: ({ delta }) => push({ type: 'text', text: delta }) })
    .then((r) => { if (r.truncated) push({ type: 'text', text: '\n\n(The answer was cut short. Try asking for less at once.)' }); push({ type: 'done', stop: r.truncated ? 'max_tokens' : 'end_turn' }) })
    .catch((e: { code?: string; text?: string }) => {
      const code = e?.code
      if (code !== 'cancelled') push({ type: 'error', message: code === 'not_granted' ? 'Claude was not allowed for this page. You can allow it from the page\'s permissions, or pick another AI in Settings.' : code === 'rate_limited' ? 'You have asked a lot in a short time, or reached your claude.ai usage limit. Try again later.' : code === 'refused' ? "Claude wouldn't answer that one. Try asking it a different way." : code === 'session_expired' ? 'Sign in to claude.ai again, then try once more.' : code === 'sampling_disabled' ? 'Claude is not available for this claude.ai account.' : 'Claude had a problem answering. Try again.' })
      push({ type: 'done', stop: code ?? 'error' })
    })
    .finally(() => { finished = true; wake?.() })
  for (;;) {
    while (queue.length) { const e = queue.shift()!; yield e; if (e.type === 'done') return }
    if (finished) return
    await new Promise<void>((r) => { wake = r })
    wake = null
  }
}

async function* viaGemini(key: string, context: string, turns: Turn[], signal?: AbortSignal): AsyncGenerator<AiEvent> {
  if (!key.trim()) { yield { type: 'error', message: 'Add your free Gemini API key in Settings → Ask Tally.' }; return }
  const { GoogleGenAI, ApiError } = await import('@google/genai')
  let baseUrl: string | undefined
  try { baseUrl = localStorage.getItem('tally.ai.geminiBaseURL') || undefined } catch { /* ignore */ } // e.g. a proxy
  const ai = new GoogleGenAI({ apiKey: key.trim(), ...(baseUrl ? { httpOptions: { baseUrl } } : {}) })
  const req = geminiRequest(context, turns)
  try {
    yield* pumpGemini(await ai.models.generateContentStream({ ...req, config: { ...req.config, abortSignal: signal } }))
  } catch (e) {
    if (signal?.aborted || (e as Error)?.name === 'AbortError') return
    if (e instanceof ApiError) {
      if (e.status === 429) yield { type: 'error', message: "You've reached Gemini's free limit for now. Wait a minute, or try again later today." }
      else if (e.status === 400 || e.status === 401 || e.status === 403) yield { type: 'error', message: "Google didn't accept that Gemini key. Check it in Settings → Ask Tally." }
      else yield { type: 'error', message: `Gemini returned an error (${e.status}). Try again.` }
    } else yield { type: 'error', message: "Can't reach Gemini. Check your connection." }
  }
}
