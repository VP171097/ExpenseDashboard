/** Settings: account and sync, and Ask Tally. */
import { Bot, Cloud, CloudOff, KeyRound, LogIn, LogOut, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { setAi, useAi } from '../lib/ai/ask'
import { contextText } from '../lib/ai/context'
import { logOut, restartAuth, useAuth } from '../lib/cloud/auth'
import { builtInCloud, checkCloudConfig, cloudConfig, saveCloudConfig } from '../lib/cloud/client'
import { deleteCloudCopy, SET_ASIDE_KEY, syncNow, useSync } from '../lib/cloud/sync'
import { useEntry } from '../lib/entry'
import { readCopy } from '../lib/storage'
import { replaceData, toast, useData, useStore, useUI } from '../lib/store'
import type { State } from '../lib/types'
import { openAsk } from './AskTally'
import { Button, Card, CardHead, Field, Segmented, Switch } from './ui'

export function AccountCard() {
  const auth = useAuth()
  const sync = useSync((x) => x.state)
  const open = useUI((u) => u.open)
  const [aside, setAside] = useState<{ savedAt: string; value: State } | null>(null)
  useEffect(() => { readCopy<State>(SET_ASIDE_KEY).then(setAside) }, [sync.kind])
  const when = sync.kind === 'synced' ? new Date(sync.at).toLocaleTimeString(undefined, { timeStyle: 'short' }) : ''

  const signOut = () => open({
    type: 'confirm', title: 'Log out of Tally?', label: 'Log out',
    text: 'Your money stays on this device so you can keep using Tally. To remove it from this device too (for example on a shared computer), use "Log out and clear this device" instead.',
    run: () => { void logOut(); toast('Logged out. Your data is still on this device.') },
  })
  const signOutClear = () => open({
    type: 'confirm', title: 'Log out and clear this device?', label: 'Log out and clear',
    text: 'Your data is removed from this browser. Anything already synced stays in your account, but changes made since the last sync will be lost.',
    run: async () => { await logOut(); replaceData(null); useEntry.getState().go('landing') },
  })
  const removeCloud = () => open({
    type: 'confirm', title: 'Delete your cloud copy?', label: 'Delete cloud copy',
    text: 'The copy in your account is deleted and you are logged out. The copy on this device is kept. This cannot be undone.',
    run: async () => { const e = await deleteCloudCopy(); if (e) toast(`Couldn't delete: ${e}`); else { await logOut(); toast('Cloud copy deleted. Your data is still on this device.') } },
  })
  const restore = () => aside && open({
    type: 'confirm', title: 'Bring back the set-aside copy?', label: 'Use that copy',
    text: `This replaces what you see now with the copy set aside on ${new Date(aside.savedAt).toLocaleString()}. You can undo straight after.`,
    run: () => { const prev = useStore.getState().data; replaceData(aside.value); toast('Set-aside copy restored', prev) },
  })

  return (
    <Card className="col-span-12 lg:col-span-6">
      <CardHead title="Account & sync" sub="Optional. Use Tally on more than one device." />
      {auth.status === 'off' ? <ConnectProject /> : auth.status !== 'signed-in' ? (
        <div className="flex flex-col gap-3">
          <p className="text-[14.5px] text-ink2">You're using Tally without an account. Everything is saved in this browser only. Log in to back it up and see it on your phone and laptop.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => useEntry.getState().go('auth', 'login')}><LogIn size={16} />Log in</Button>
            <Button onClick={() => useEntry.getState().go('auth', 'signup')}>Create account</Button>
          </div>
          {!builtInCloud() && <ConnectProject compact />}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-[16px] font-bold text-accent-ink">{(auth.user?.name || auth.user?.email || '?').slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{auth.user?.name || 'Your account'}</p><p className="truncate text-[13px] text-ink2">{auth.user?.email}</p></div>
          </div>
          <div className="flex items-center gap-2.5 text-[14px]" aria-live="polite">
            {sync.kind === 'offline' ? <CloudOff size={18} className="text-warn" /> : sync.kind === 'error' ? <CloudOff size={18} className="text-bad" /> : <Cloud size={18} className="text-good" />}
            <span className="flex-1">
              {sync.kind === 'synced' && <>Up to date · synced at {when}</>}
              {sync.kind === 'syncing' && <>Syncing…</>}
              {sync.kind === 'idle' && <>Signed in</>}
              {sync.kind === 'sample' && <>Example data isn't saved to your account. Set up your own money to start syncing.</>}
              {sync.kind === 'offline' && <>You're offline. Changes are saved here and will sync when you're back online.</>}
              {sync.kind === 'error' && <>Couldn't sync: {sync.message}</>}
              {sync.kind === 'conflict' && <>Waiting for you to choose which copy to keep.</>}
            </span>
            <Button size="sm" onClick={() => void syncNow()}><RefreshCw size={14} />Sync now</Button>
          </div>
          <p className="text-[12.5px] text-muted">Your copy is stored in your Tally cloud database, where only your login can read it. It is not end-to-end encrypted.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={signOut}><LogOut size={16} />Log out</Button>
            <Button variant="ghost" onClick={signOutClear}>Log out and clear this device</Button>
            <Button variant="danger" onClick={removeCloud}><Trash2 size={16} />Delete cloud copy</Button>
          </div>
        </div>
      )}
      {aside && <button type="button" onClick={restore} className="mt-4 flex items-center gap-1.5 text-[13.5px] font-semibold text-accent"><RotateCcw size={14} />Bring back the copy set aside on {new Date(aside.savedAt).toLocaleDateString()}</button>}
    </Card>
  )
}

/** For self-hosted copies: point Tally at your own Supabase project. */
function ConnectProject({ compact = false }: { compact?: boolean }) {
  const cur = cloudConfig()
  const [show, setShow] = useState(!compact)
  const [url, setUrl] = useState(cur?.url ?? '')
  const [key, setKey] = useState(cur?.anonKey ?? '')
  const [err, setErr] = useState('')
  const save = async () => {
    const c = { url: url.trim().replace(/\/$/, ''), anonKey: key.trim() }
    const p = checkCloudConfig(c)
    if (p) return setErr(p)
    setErr(''); saveCloudConfig(c); await restartAuth(); toast('Connected. You can now log in.')
  }
  if (compact && !show) return <button type="button" onClick={() => setShow(true)} className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink2 hover:text-ink"><KeyRound size={14} />Use a different Supabase project</button>
  return (
    <div className="flex flex-col gap-3">
      {!compact && <p className="text-[14.5px] text-ink2">Accounts aren't switched on for this copy of Tally. To add them, create a free Supabase project, run the setup in the README, then enter its details here.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supabase project URL"><input className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcd.supabase.co" /></Field>
        <Field label="Anon public key"><input className="field" value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" /></Field>
      </div>
      {err && <p role="alert" className="text-[13.5px] font-semibold text-bad">{err}</p>}
      <div className="flex gap-2"><Button variant="primary" onClick={save}>Connect</Button>{cur && !builtInCloud() && <Button variant="ghost" onClick={async () => { saveCloudConfig(null); await restartAuth(); setUrl(''); setKey('') }}>Disconnect</Button>}</div>
    </div>
  )
}

export function AiCard() {
  const s = useData()
  const ai = useAi()
  const signedIn = useAuth((a) => a.status === 'signed-in')
  const cloud = !!cloudConfig()
  const [key, setKey] = useState(ai.key)
  const [peek, setPeek] = useState(false)
  const size = contextText(s, { notes: ai.notes }).length
  return (
    <Card i={1} className="col-span-12 lg:col-span-6">
      <CardHead title={<span className="flex items-center gap-2"><Bot size={18} className="text-accent" />Ask Tally (AI)</span>} sub="Plain-language answers about your own money" />
      <Segmented label="How Ask Tally connects" value={ai.mode} onChange={(v) => setAi({ mode: v })}
        options={[['off', 'Off'], ['cloud', 'My account'], ['key', 'My API key']]} />
      <div className="mt-4 flex flex-col gap-3 text-[14px]">
        {ai.mode === 'off' && <p className="text-ink2">Off. Nothing is ever sent to an AI service.</p>}
        {ai.mode === 'cloud' && <p className="text-ink2">{!cloud ? 'Needs accounts switched on (see Account & sync).' : !signedIn ? 'Log in to use Ask Tally through your account.' : 'Questions go through your Tally cloud. The AI key stays on the server.'}</p>}
        {ai.mode === 'key' && (
          <>
            <p className="text-ink2">Your Anthropic API key is kept only in this browser and is never synced or backed up. Anthropic bills your account for each question.</p>
            <div className="flex gap-2">
              <input className="field flex-1" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" aria-label="Anthropic API key" autoComplete="off" />
              <Button variant="primary" onClick={() => { setAi({ key: key.trim() }); toast('API key saved on this device') }} disabled={key.trim() === ai.key}>Save</Button>
            </div>
            {ai.key && <button type="button" className="w-fit text-[13px] font-semibold text-bad" onClick={() => { setAi({ key: '' }); setKey('') }}>Remove key from this device</button>}
          </>
        )}
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-line p-4">
          <div><p className="font-semibold">Include entry descriptions</p><p className="text-[13px] text-ink2">Lets Ask Tally see what recent entries were for (like "Coffee with Sam"). Turn off to share amounts and categories only.</p></div>
          <Switch checked={ai.notes} label="Include entry descriptions" onChange={(v) => setAi({ notes: v })} />
        </div>
        <p className="flex items-center gap-2 text-[13px] text-ink2"><ShieldCheck size={15} className="text-good" />Shared only when you ask: a summary of about {Math.round(size / 1000)} KB. Ask Tally can't change anything.</p>
        <button type="button" onClick={() => setPeek((v) => !v)} className="w-fit text-[13.5px] font-semibold text-accent" aria-expanded={peek}>{peek ? 'Hide' : 'See exactly what is shared'}</button>
        {peek && <pre className="max-h-72 overflow-auto rounded-xl border border-line bg-surface2/60 p-3 text-[11px] leading-snug">{JSON.stringify(JSON.parse(contextText(s, { notes: ai.notes })), null, 2)}</pre>}
        {ai.mode !== 'off' && <Button className="w-fit" onClick={() => openAsk()}><Bot size={16} />Open Ask Tally</Button>}
      </div>
    </Card>
  )
}
