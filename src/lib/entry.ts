import { create } from 'zustand'

/** Which front door is showing before the app: the landing page, sign-in, or first-time setup. */
export type AuthMode = 'login' | 'signup' | 'forgot'
interface Entry { screen: 'landing' | 'auth' | 'setup'; mode: AuthMode; go: (screen: Entry['screen'], mode?: AuthMode) => void }

const fromHash = (): Pick<Entry, 'screen' | 'mode'> => {
  const h = typeof location !== 'undefined' ? location.hash : ''
  if (h === '#/login') return { screen: 'auth', mode: 'login' }
  if (h === '#/signup') return { screen: 'auth', mode: 'signup' }
  if (h === '#/start') return { screen: 'setup', mode: 'login' }
  return { screen: 'landing', mode: 'login' }
}
export const useEntry = create<Entry>()((set) => ({
  ...fromHash(),
  go: (screen, mode = 'login') => {
    set({ screen, mode })
    try {
      const hash = screen === 'auth' ? (mode === 'signup' ? '#/signup' : '#/login') : screen === 'setup' ? '#/start' : ''
      history.replaceState(null, '', location.pathname + location.search + hash)
    } catch { /* ignore */ }
    window.scrollTo({ top: 0 })
  },
}))

/** The privacy policy and terms pages, reachable from every screen at #/privacy and #/terms. */
export type LegalDoc = 'privacy' | 'terms'
const legalFromHash = (): LegalDoc | null => (typeof location === 'undefined' ? null : location.hash === '#/privacy' ? 'privacy' : location.hash === '#/terms' ? 'terms' : null)
let pushed = false
export const useLegal = create<{ doc: LegalDoc | null; open: (d: LegalDoc) => void; close: () => void }>()((set) => ({
  doc: legalFromHash(),
  open: (doc) => {
    try { history.pushState(null, '', location.pathname + location.search + '#/' + doc); pushed = true } catch { /* ignore */ }
    set({ doc }); window.scrollTo({ top: 0 })
  },
  close: () => {
    if (pushed) { pushed = false; history.back(); return }
    try { history.replaceState(null, '', location.pathname + location.search) } catch { /* ignore */ }
    set({ doc: null })
  },
}))
if (typeof window !== 'undefined') window.addEventListener('popstate', () => useLegal.setState({ doc: legalFromHash() }))
