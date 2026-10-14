/**
 * The connection to your Supabase project. Accounts, sync and Ask Tally only switch on when a
 * project is configured, either at build time (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) or in
 * Settings. supabase-js is downloaded only then, so the app stays small for local-only use.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CloudConfig { url: string; anonKey: string }
const KEY = 'tally.cloud.config'

const fromEnv = (): CloudConfig | null => {
  const url = import.meta.env.VITE_SUPABASE_URL, anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  return url && anonKey ? { url, anonKey } : null
}
/** A project chosen in Settings wins over the one built in. */
export function cloudConfig(): CloudConfig | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as CloudConfig | null
    if (saved?.url && saved.anonKey) return saved
  } catch { /* ignore */ }
  return fromEnv()
}
export const builtInCloud = () => !!fromEnv()
export function saveCloudConfig(c: CloudConfig | null) {
  try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY) } catch { /* ignore */ }
  client = null
}
/** Basic shape check, so a typo is caught before anything is sent. */
export function checkCloudConfig(c: CloudConfig): string | null {
  try { const u = new URL(c.url); if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return 'The project URL should start with https://' }
  catch { return 'That project URL doesn\'t look right. It looks like https://abcd.supabase.co' }
  if (c.anonKey.trim().length < 20) return 'That key looks too short. Copy the "anon public" key.'
  return null
}

let client: Promise<SupabaseClient> | null = null
export function supabase(): Promise<SupabaseClient> | null {
  const c = cloudConfig()
  if (!c) return null
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'tally.auth' } }))
  }
  return client
}
