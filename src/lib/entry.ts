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
