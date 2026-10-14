/**
 * Sends a question to Claude and streams the answer back.
 *
 * Two ways to connect, chosen in Settings:
 * - "cloud": through the ask-tally function in your Supabase project (needs you signed in; the
 *   API key stays on the server).
 * - "key": straight from this browser with your own Anthropic API key, kept only on this device.
 *
 * AI settings live in this browser only and are never synced, so a key never leaves the device
 * except to call Anthropic.
 */
import { create } from 'zustand'
import { buildRequest, pump, validate, type AiEvent, type Turn } from '../../../supabase/functions/_shared/tally-ai'
import { accessToken } from '../cloud/auth'
import { cloudConfig } from '../cloud/client'

export type { AiEvent, Turn }
export interface AiSettings { mode: 'off' | 'cloud' | 'key'; key: string; notes: boolean }
const KEY = 'tally.ai'
const load = (): AiSettings => {
  try { return { mode: 'off', key: '', notes: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { mode: 'off', key: '', notes: true } }
}
export const useAi = create<AiSettings>()(() => load())
export function setAi(p: Partial<AiSettings>) {
  useAi.setState(p)
  try { localStorage.setItem(KEY, JSON.stringify(useAi.getState())) } catch { /* ignore */ }
}

export async function* ask(context: string, turns: Turn[], signal?: AbortSignal): AsyncGenerator<AiEvent> {
  const problem = validate(context, turns)
  if (problem) { yield { type: 'error', message: problem }; return }
  const s = useAi.getState()
  if (s.mode === 'key') yield* viaKey(s.key, context, turns, signal)
  else if (s.mode === 'cloud') yield* viaCloud(context, turns, signal)
  else yield { type: 'error', message: 'Ask Tally is switched off. Turn it on in Settings.' }
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
