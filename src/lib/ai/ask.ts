/**
 * SpendCop AI: questions the built-in answers (quick.ts) can't handle go to the ask-tally function
 * in your Supabase project, which asks Google Gemini and streams the answer back. People need to
 * be logged in; the AI key stays on the server.
 *
 * These settings live in this browser only and are never synced.
 */
import { create } from 'zustand'
import { validate, type AiEvent, type Turn } from '../../../supabase/functions/_shared/tally-ai'
import { accessToken } from '../cloud/auth'
import { cloudConfig } from '../cloud/client'

export type { AiEvent, Turn }
/** enabled: use SpendCop AI for other questions. notes: include entry descriptions in what is sent. */
export interface AiSettings { enabled: boolean; notes: boolean }
const KEY = 'tally.ai'
const DEFAULTS: AiSettings = { enabled: true, notes: true }
const load = (): AiSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    return saved ? { enabled: typeof saved.enabled === 'boolean' ? saved.enabled : true, notes: saved.notes !== false } : DEFAULTS
  } catch { return DEFAULTS }
}
export const useAi = create<AiSettings>()(() => load())
export function setAi(p: Partial<AiSettings>) {
  useAi.setState(p)
  try { localStorage.setItem(KEY, JSON.stringify(useAi.getState())) } catch { /* ignore */ }
}

/** Whether SpendCop AI can answer right now (the built-in answers always can). */
export const aiReady = (s: AiSettings, signedIn: boolean) => s.enabled && signedIn && !!cloudConfig()

export async function* ask(context: string, turns: Turn[], signal?: AbortSignal): AsyncGenerator<AiEvent> {
  const problem = validate(context, turns)
  if (problem) { yield { type: 'error', message: problem }; return }
  const c = cloudConfig()
  if (!c) { yield { type: 'error', message: 'SpendCop AI needs accounts switched on.' }; return }
  const token = await accessToken()
  if (!token) { yield { type: 'error', message: 'Log in to use SpendCop AI.' }; return }
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
    yield { type: 'error', message: navigator.onLine === false ? "You're offline. SpendCop AI needs a connection." : "Can't reach SpendCop AI right now. Try again in a moment." }; return
  }
  if (!res.ok || !res.body) {
    let msg = res.status === 404 ? "SpendCop AI isn't available yet." : `SpendCop AI had a problem (${res.status}).`
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
