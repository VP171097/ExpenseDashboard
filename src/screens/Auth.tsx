/**
 * Log in, create an account, reset a password. Accounts are optional: "Continue without an
 * account" keeps everything on this device, exactly as before.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, Cloud, Eye, EyeOff, KeyRound, Mail, ShieldCheck, Wallet } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import writing from '../assets/landing/writing.webp'
import shot from '../assets/landing/app-desktop-dark.webp'
import { checkCloudConfig, cloudConfig, saveCloudConfig } from '../lib/cloud/client'
import { authOptions, google, logIn, restartAuth, sendReset, setNewPassword, signUp } from '../lib/cloud/auth'
import { useEntry, type AuthMode } from '../lib/entry'
import Footer from '../components/Footer'

type Mode = AuthMode | 'reset' | 'sent' | 'confirm'

export default function Auth({ reset = false }: { reset?: boolean }) {
  const entry = useEntry()
  const [mode, setMode] = useState<Mode>(reset ? 'reset' : entry.mode)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [cloudOn, setCloudOn] = useState(() => !!cloudConfig())
  const [hasGoogle, setHasGoogle] = useState(false)
  // inside the claude.ai viewer the page is framed and can't reach other websites
  const inClaude = typeof window !== 'undefined' && window.top !== window && !!(window as unknown as { claude?: { use?: unknown } }).claude?.use
  useEffect(() => { void authOptions().then((o) => setHasGoogle(!!o?.google)) }, [cloudOn])
  const back = () => entry.go('landing')
  const local = () => entry.go('setup')
  const switchTo = (m: Mode) => { setMode(m); setErr('') }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setErr('')
    if (mode !== 'reset' && !/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Enter your email address, like you@example.com.')
    if ((mode === 'signup' || mode === 'reset') && pw.length < 8) return setErr('Use at least 8 characters for your password.')
    if (mode === 'login' && !pw) return setErr('Enter your password.')
    setBusy(true)
    try {
      if (mode === 'login') { const r = await logIn(email, pw); if (!r.ok) setErr(r.error) }
      else if (mode === 'signup') { const r = await signUp(email, pw, name); if (!r.ok) setErr(r.error); else if (r.note === 'confirm') switchTo('confirm') }
      else if (mode === 'forgot') { const r = await sendReset(email); if (!r.ok) setErr(r.error); else switchTo('sent') }
      else if (mode === 'reset') { const r = await setNewPassword(pw); if (!r.ok) setErr(r.error) }
    } finally { setBusy(false) }
  }
  const viaGoogle = async () => { setErr(''); setBusy(true); const r = await google(); setBusy(false); if (!r.ok) setErr(r.error) }

  const title: Record<Mode, string> = { login: 'Log in to your account', signup: 'Create your free account', forgot: 'Reset your password', reset: 'Choose a new password', sent: 'Check your email', confirm: 'Confirm your email' }
  const strength = pw.length >= 12 && /\d/.test(pw) && /[a-z]/i.test(pw) ? 3 : pw.length >= 8 ? 2 : pw ? 1 : 0

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8" style={{ background: 'radial-gradient(800px 500px at 20% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%), var(--bg)' }}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-line bg-surface shadow-pop md:grid-cols-[1fr_1.05fr]">
        {/* photo side */}
        <div className="relative min-h-[200px] md:min-h-[620px]">
          <img src={writing} alt="Planning the month in a notebook with a cup of coffee" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(13,18,36,.15), rgba(13,18,36,.85))' }} />
          <div className="absolute left-5 top-5 flex items-center gap-2 font-display text-[19px] font-extrabold text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#2a2160]"><Wallet size={16} /></span>Tally</div>
          <div className="absolute bottom-0 hidden p-7 text-white md:block">
            <img src={shot} alt="" className="mb-6 w-[88%] rounded-xl border border-white/15 shadow-pop" />
            <p className="font-display text-[26px] font-extrabold leading-tight">Small steps.<br />Calmer money.</p>
            <ul className="mt-4 space-y-1.5 text-[14px] text-white/85">
              {['Your safe-to-spend number, every day', 'Synced across your phone and laptop', 'Ask Tally about your own money'].map((t) => <li key={t} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#4fd5b2]" />{t}</li>)}
            </ul>
          </div>
        </div>

        {/* form side */}
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <button type="button" onClick={back} className="mb-6 inline-flex w-fit items-center gap-2 text-[14.5px] font-semibold text-ink2 hover:text-ink"><ArrowLeft size={17} />Back</button>
          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              <h1 className="text-[28px] font-extrabold leading-tight">{title[mode]}</h1>
              {!cloudOn && mode !== 'sent' && mode !== 'confirm' ? <NoCloud onConnected={() => setCloudOn(true)} onLocal={local} /> : mode === 'sent' || mode === 'confirm' ? (
                <div className="mt-5">
                  <p className="flex gap-3 rounded-2xl bg-accent-soft p-4 text-[15px]"><Mail size={20} className="mt-0.5 shrink-0 text-accent" />
                    <span>{mode === 'sent' ? <>If there's an account for <b>{email}</b>, a link to reset your password is on its way. Open it on this device.</> : <>We sent a confirmation link to <b>{email}</b>. Open it to finish creating your account, then come back here.</>}</span></p>
                  <button type="button" onClick={() => switchTo('login')} className="mt-5 font-semibold text-accent">Back to log in</button>
                </div>
              ) : (
                <>
                  {inClaude && <p className="mt-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13.5px]">You're viewing Tally inside claude.ai, where pages can't reach other websites, so logging in may not work here. Open Tally from its own web address to use your account, or continue without one.</p>}
                  {mode === 'login' && <p className="mt-1.5 text-[15px] text-ink2">Welcome back. Your money picks up where you left it.</p>}
                  {mode === 'signup' && <p className="mt-1.5 text-[15px] text-ink2">Free. Keep your money in sync on every device.</p>}
                  {mode === 'forgot' && <p className="mt-1.5 text-[15px] text-ink2">Enter your email and we'll send you a link to choose a new password.</p>}
                  <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
                    {mode === 'signup' && <Input label="Your name" value={name} onChange={setName} autoComplete="name" placeholder="e.g. Alex" />}
                    {mode !== 'reset' && <Input label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" />}
                    {mode !== 'forgot' && (
                      <Input label={mode === 'reset' ? 'New password' : 'Password'} type={show ? 'text' : 'password'} value={pw} onChange={setPw}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}
                        right={<button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-ink">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
                        extra={mode === 'login' ? <button type="button" onClick={() => switchTo('forgot')} className="text-[13.5px] font-semibold text-accent">Forgot password?</button> : undefined} />
                    )}
                    {(mode === 'signup' || mode === 'reset') && pw && (
                      <div className="-mt-2 flex items-center gap-2 text-[12.5px] text-ink2" aria-live="polite">
                        <span className="flex flex-1 gap-1">{[1, 2, 3].map((n) => <i key={n} className="h-1.5 flex-1 rounded-full" style={{ background: n <= strength ? (strength === 3 ? 'var(--good)' : strength === 2 ? 'var(--warn)' : 'var(--bad)') : 'var(--surface2)' }} />)}</span>
                        {strength === 3 ? 'Strong' : strength === 2 ? 'OK, longer is stronger' : 'Too short'}
                      </div>
                    )}
                    <AnimatePresence>{err && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-[14px] font-medium text-bad">{err}</motion.p>}</AnimatePresence>
                    <button type="submit" disabled={busy} className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-[16px] font-bold text-accent-ink shadow-pop transition-opacity disabled:opacity-60">
                      {busy ? 'One moment…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Save new password'}
                      {!busy && <ArrowRight size={18} />}
                    </button>
                  </form>
                  {(mode === 'login' || mode === 'signup') && (
                    <>
                      <div className="my-5 flex items-center gap-3 text-[12px] font-semibold text-muted"><i className="h-px flex-1 bg-line" />OR<i className="h-px flex-1 bg-line" /></div>
                      {hasGoogle && <button type="button" onClick={viaGoogle} disabled={busy} className="mb-3 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line2 bg-surface font-semibold hover:border-accent"><GoogleMark />Continue with Google</button>}
                      <button type="button" onClick={local} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line font-semibold text-ink2 hover:text-ink"><ShieldCheck size={18} />Continue without an account</button>
                      <p className="mt-5 text-center text-[14.5px] text-ink2">
                        {mode === 'login' ? <>Don't have an account? <button type="button" onClick={() => switchTo('signup')} className="font-bold text-accent">Sign up</button></> : <>Already have an account? <button type="button" onClick={() => switchTo('login')} className="font-bold text-accent">Log in</button></>}
                      </p>
                    </>
                  )}
                  {mode === 'forgot' && <button type="button" onClick={() => switchTo('login')} className="mt-5 font-semibold text-accent">Back to log in</button>}
                  <p className="mt-6 text-[12px] leading-relaxed text-muted">Without an account, your data stays only in this browser. With one, it's also kept in your private cloud space, readable only by your login.</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
      <Footer className="mt-8 w-full max-w-5xl" />
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', autoComplete, placeholder, right, extra }: { label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string; placeholder?: string; right?: ReactNode; extra?: ReactNode }) {
  const id = label.toLowerCase().replace(/\W+/g, '-')
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between"><label htmlFor={id} className="text-[14px] font-semibold">{label}</label>{extra}</div>
      <div className="relative">
        <input id={id} className="field h-12 !rounded-xl pr-12 text-[15.5px]" type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} />
        {right && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{right}</span>}
      </div>
    </div>
  )
}

/** Shown when this copy of Tally has no Supabase project yet. */
function NoCloud({ onConnected, onLocal }: { onConnected: () => void; onLocal: () => void }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [err, setErr] = useState('')
  const connect = async (e: FormEvent) => {
    e.preventDefault()
    const c = { url: url.trim().replace(/\/$/, ''), anonKey: key.trim() }
    const problem = checkCloudConfig(c)
    if (problem) return setErr(problem)
    saveCloudConfig(c)
    await restartAuth()
    onConnected()
  }
  return (
    <div className="mt-5">
      <p className="flex gap-3 rounded-2xl bg-warn-soft p-4 text-[14.5px]"><Cloud size={20} className="mt-0.5 shrink-0 text-warn" />
        <span>Accounts aren't switched on for this copy of Tally yet. You can still use everything without an account, and your data stays in this browser.</span></p>
      <button type="button" onClick={onLocal} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-bold text-accent-ink shadow-pop">Continue without an account <ArrowRight size={18} /></button>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-ink2 hover:text-ink"><KeyRound size={16} />Connect your own Supabase project</button>
      <AnimatePresence>{open && (
        <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={connect} className="overflow-hidden">
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-line p-4">
            <p className="text-[13px] text-ink2">From your Supabase dashboard: Project Settings → API. The setup steps are in the project's README.</p>
            <Input label="Project URL" value={url} onChange={setUrl} placeholder="https://abcd.supabase.co" />
            <Input label="Anon public key" value={key} onChange={setKey} placeholder="eyJhbGciOi…" />
            {err && <p role="alert" className="text-[13.5px] font-semibold text-bad">{err}</p>}
            <button type="submit" className="h-11 rounded-xl border border-line2 font-semibold hover:border-accent">Connect</button>
          </div>
        </motion.form>
      )}</AnimatePresence>
    </div>
  )
}

const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
)
