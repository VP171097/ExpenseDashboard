/**
 * Signing in. Accounts are optional: Tally works fully without one, and your data stays in this
 * browser. Signing in adds a private copy in your Supabase project so it follows you to other
 * devices.
 */
import { create } from 'zustand'
import { cloudConfig, supabase } from './client'

export interface Account { id: string; email: string; name: string }
interface AuthState {
  /** off: no project configured. loading: checking for a saved session. */
  status: 'off' | 'loading' | 'signed-out' | 'signed-in'
  user: Account | null
  /** arrived from a "reset your password" email */
  recovering: boolean
}
export const useAuth = create<AuthState>()(() => ({ status: cloudConfig() ? 'loading' : 'off', user: null, recovering: false }))

type SbUser = { id: string; email?: string; user_metadata?: Record<string, unknown> }
const toAccount = (u: SbUser | null | undefined): Account | null =>
  u ? { id: u.id, email: u.email ?? '', name: String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? '') } : null

let started = false
/** Picks up a saved session, or one arriving in the URL after Google sign-in or an email link. */
export async function initAuth() {
  if (started) return
  started = true
  const p = supabase()
  if (!p) { useAuth.setState({ status: 'off', user: null }); return }
  try {
    const sb = await p
    sb.auth.onAuthStateChange((event, session) => {
      const user = toAccount(session?.user)
      useAuth.setState({ status: user ? 'signed-in' : 'signed-out', user, ...(event === 'PASSWORD_RECOVERY' ? { recovering: true } : {}) })
    })
    const { data } = await sb.auth.getSession()
    const user = toAccount(data.session?.user)
    useAuth.setState({ status: user ? 'signed-in' : 'signed-out', user })
    // tidy the address bar after an email link or Google sign-in
    if (/[?&](code|error)=/.test(location.search) || /access_token|error_description/.test(location.hash))
      history.replaceState(null, '', location.pathname + (location.hash.startsWith('#/') ? location.hash : ''))
  } catch {
    useAuth.setState({ status: 'signed-out', user: null })
  }
}
/** Call after the project settings change. */
export function restartAuth() { started = false; useAuth.setState({ status: cloudConfig() ? 'loading' : 'off', user: null }); return initAuth() }

/** Where email links and Google send people back to: this same page. */
const here = () => location.origin + location.pathname

/** Supabase's messages, in plain words. */
function friendly(e: { message?: string; status?: number } | null | undefined): string {
  const m = (e?.message || '').toLowerCase()
  if (!m) return 'Something went wrong. Please try again.'
  if (m.includes('invalid login')) return 'That email and password don\'t match. Check them, or reset your password.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first. We sent you a link when you signed up.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'There\'s already an account with this email. Log in instead.'
  if (m.includes('password should be') || m.includes('weak')) return 'Choose a stronger password: at least 8 characters, mixing letters and numbers.'
  if (m.includes('rate limit') || e?.status === 429) return 'Too many tries. Please wait a minute and try again.'
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'Google sign-in isn\'t switched on for this Tally yet. Use email and password.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Can\'t reach the server. Check your connection.'
  if (m.includes('same password')) return 'That\'s your current password. Choose a new one.'
  return e?.message || 'Something went wrong. Please try again.'
}
async function sb() {
  const p = supabase()
  if (!p) throw new Error('Accounts are not set up for this copy of Tally.')
  return p
}
type Result = { ok: true; note?: string } | { ok: false; error: string }
const run = async (f: () => Promise<{ error: { message?: string; status?: number } | null }>, note?: string): Promise<Result> => {
  try { const { error } = await f(); return error ? { ok: false, error: friendly(error) } : { ok: true, note } }
  catch (e) { return { ok: false, error: friendly(e as Error) } }
}

export async function logIn(email: string, password: string) {
  const c = await sb()
  return run(() => c.auth.signInWithPassword({ email: email.trim(), password }))
}
export async function signUp(email: string, password: string, name: string) {
  const c = await sb()
  try {
    const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: here(), data: { full_name: name.trim() } } })
    if (error) return { ok: false as const, error: friendly(error) }
    // projects that require email confirmation return no session until the link is clicked
    return { ok: true as const, note: data.session ? undefined : 'confirm' }
  } catch (e) { return { ok: false as const, error: friendly(e as Error) } }
}
export async function sendReset(email: string) {
  const c = await sb()
  return run(() => c.auth.resetPasswordForEmail(email.trim(), { redirectTo: here() }))
}
export async function setNewPassword(password: string) {
  const c = await sb()
  const r = await run(() => c.auth.updateUser({ password }))
  if (r.ok) useAuth.setState({ recovering: false })
  return r
}
export async function google() {
  const c = await sb()
  return run(() => c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } }))
}
export async function logOut() {
  const p = supabase()
  if (p) { try { await (await p).auth.signOut() } catch { /* still signed out locally below */ } }
  useAuth.setState({ status: cloudConfig() ? 'signed-out' : 'off', user: null })
}
/** The signed-in user's access token, for calling the Ask Tally function. */
export async function accessToken() {
  const p = supabase()
  if (!p) return null
  const { data } = await (await p).auth.getSession()
  return data.session?.access_token ?? null
}
