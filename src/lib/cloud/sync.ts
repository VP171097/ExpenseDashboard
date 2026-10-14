/**
 * Wires the sync engine to Supabase and to the app's data. Runs only while signed in.
 */
import { create } from 'zustand'
import { keepCopy } from '../storage'
import { replaceData, useStore } from '../store'
import type { State } from '../types'
import { useAuth } from './auth'
import { supabase } from './client'
import { createEngine, type Engine, type Remote, type SyncState } from './engine'

/** checked: the first look at the cloud copy has finished (so we know whether to show setup). */
export const useSync = create<{ state: SyncState; checked: boolean }>()(() => ({ state: { kind: 'idle' }, checked: false }))
export const SET_ASIDE_KEY = 'tally.set-aside'

const device = () => {
  const ua = navigator.userAgent
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'device'
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'browser'
  return `${br} on ${os}`
}

/** Database errors in plain words. */
function plain(message: string) {
  if (/PGRST20[25]|schema cache|tally_data|tally_save/.test(message)) return "Your Supabase project doesn't have Tally's table yet. Run the setup SQL from the README (step 2), then tap Sync now."
  if (/JWT|permission denied|401/.test(message)) return 'Your login has expired. Log out and log in again.'
  return message
}

function supabaseRemote(): Remote {
  return {
    async get() {
      const sb = await supabase()!
      const { data, error } = await sb.from('tally_data').select('data, rev, updated_at, device').maybeSingle()
      if (error) throw new Error(plain(`${error.code ?? ''} ${error.message}`))
      return data ? { data: data.data as State, rev: Number(data.rev), updated_at: data.updated_at, device: data.device } : null
    },
    async save(data, expected) {
      const sb = await supabase()!
      const { data: rev, error } = await sb.rpc('tally_save', { p_data: data, p_expected: expected, p_device: device() })
      if (error) throw new Error(plain(`${error.code ?? ''} ${error.message}`))
      return Number(rev)
    },
  }
}

let engine: Engine | null = null
let stop: (() => void) | null = null
let applying = false
let timer: ReturnType<typeof setTimeout> | undefined

function begin(uid: string) {
  end()
  useSync.setState({ checked: false })
  const metaKey = `tally.sync.${uid}`
  engine = createEngine({
    remote: supabaseRemote(),
    local: () => useStore.getState().data,
    apply: (d) => { applying = true; try { replaceData(d) } finally { applying = false } },
    setAside: (d) => { void keepCopy(SET_ASIDE_KEY, d) },
    loadMeta: () => { try { return JSON.parse(localStorage.getItem(metaKey) || 'null') } catch { return null } },
    saveMeta: (m) => { try { localStorage.setItem(metaKey, JSON.stringify(m)) } catch { /* ignore */ } },
    now: () => new Date().toISOString(),
  }, (state) => useSync.setState((u) => ({ state, checked: u.checked || state.kind !== 'syncing' })))
  const e = engine
  const unsub = useStore.subscribe((s, prev) => {
    if (s.data === prev.data || applying || !s.data) return
    e.changed()
    clearTimeout(timer)
    timer = setTimeout(() => e.push(), 2500)
  })
  const soon = () => { clearTimeout(timer); void e.push() }
  const hide = () => { if (document.visibilityState === 'hidden') soon() }
  addEventListener('online', soon)
  document.addEventListener('visibilitychange', hide)
  stop = () => { unsub(); removeEventListener('online', soon); document.removeEventListener('visibilitychange', hide); clearTimeout(timer) }
  void e.start()
}
function end() { stop?.(); stop = null; engine = null; useSync.setState({ state: { kind: 'idle' }, checked: false }) }

/** Start or stop syncing as people sign in and out. Call once. */
export function watchAccount() {
  let uid: string | null = null
  const check = () => {
    const { status, user } = useAuth.getState()
    const next = status === 'signed-in' && user ? user.id : null
    if (next === uid) return
    uid = next
    if (uid) begin(uid); else end()
  }
  useAuth.subscribe(check)
  check()
}
export const syncNow = () => engine?.push()
export const resolveConflict = (keep: 'cloud' | 'device') => engine?.resolve(keep)

/** Remove the cloud copy (the copy on this device stays). */
export async function deleteCloudCopy() {
  const sb = await supabase()
  if (!sb) return 'Not connected.'
  const { error } = await sb.from('tally_data').delete().not('user_id', 'is', null)
  return error ? error.message : null
}
