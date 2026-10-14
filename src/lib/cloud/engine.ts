/**
 * Keeps this device and the cloud copy in step, without ever silently throwing away changes.
 *
 * Each save to the cloud carries the revision it was based on. If another device saved in
 * between, the save is refused and, when both sides changed, the person chooses which copy to
 * keep. The copy not chosen is set aside on this device, so it can still be recovered.
 *
 * Pure logic with its dependencies passed in, so it can be tested without a server.
 */
import type { State } from '../types'

export interface RemoteCopy { data: State; rev: number; updated_at?: string; device?: string | null }
export interface Remote {
  get(): Promise<RemoteCopy | null>
  /** Returns the new revision, or -1 if the cloud copy is no longer at `expected`. */
  save(data: State, expected: number): Promise<number>
}
export interface Meta { rev: number; dirty: boolean; last?: string }
export interface Deps {
  remote: Remote
  local(): State | null
  /** Put the cloud copy on screen (and in this browser's storage). */
  apply(d: State): void
  /** Keep a copy that is about to be replaced, so nothing is lost. */
  setAside(d: State): void
  loadMeta(): Meta | null
  saveMeta(m: Meta): void
  now(): string
}
export type SyncState =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'synced'; at: string }
  | { kind: 'sample' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string }
  | { kind: 'conflict'; remote: RemoteCopy }

export function createEngine(d: Deps, onState: (s: SyncState) => void) {
  let meta: Meta = d.loadMeta() ?? { rev: 0, dirty: true }
  const known = d.loadMeta() != null
  let busy: Promise<void> = Promise.resolve()
  let conflict: RemoteCopy | null = null
  const set = (m: Partial<Meta>) => { meta = { ...meta, ...m }; d.saveMeta(meta) }
  const synced = () => { set({ last: d.now() }); onState({ kind: 'synced', at: meta.last! }) }
  const fail = (e: unknown) => {
    const msg = String((e as Error)?.message ?? e)
    onState(/fetch|network|offline/i.test(msg) || (typeof navigator !== 'undefined' && navigator.onLine === false) ? { kind: 'offline' } : { kind: 'error', message: msg })
  }
  const queue = (f: () => Promise<void>) => (busy = busy.then(f, f))

  async function push() {
    const local = d.local()
    if (!local) return
    if (local.sample) { onState({ kind: 'sample' }); return } // example data is never uploaded
    onState({ kind: 'syncing' })
    const rev = await d.remote.save(local, meta.rev)
    if (rev > 0) {
      // only clear "dirty" if nothing changed while we were saving
      set({ rev, dirty: d.local() !== local ? true : false })
      if (meta.dirty) return push()
      return synced()
    }
    // someone else saved first
    const remote = await d.remote.get()
    if (!remote) { set({ rev: 0 }); return push() }
    conflict = remote
    onState({ kind: 'conflict', remote })
  }

  return {
    /** First contact after signing in, or when the app opens signed in. */
    start: () => queue(async () => {
      try {
        onState({ kind: 'syncing' })
        const remote = await d.remote.get()
        const local = d.local()
        if (!remote) { if (local) { set({ rev: 0, dirty: true }); await push() } else onState({ kind: 'idle' }); return }
        if (!local || local.sample) { d.apply(remote.data); set({ rev: remote.rev, dirty: false }); return synced() }
        if (known && remote.rev === meta.rev) { if (meta.dirty) await push(); else synced(); return }
        if (known && remote.rev > meta.rev && !meta.dirty) { d.apply(remote.data); set({ rev: remote.rev, dirty: false }); return synced() }
        // both this device and the cloud have changes (or this device has never synced)
        conflict = remote
        onState({ kind: 'conflict', remote })
      } catch (e) { fail(e) }
    }),
    /** Something changed on this device. */
    changed: () => { set({ dirty: true }) },
    /** Send this device's changes, if any. */
    push: () => queue(async () => {
      if (conflict || !meta.dirty) return
      try { await push() } catch (e) { fail(e) }
    }),
    /** The person chose which copy to keep. */
    resolve: (keep: 'cloud' | 'device') => queue(async () => {
      if (!conflict) return
      const remote = conflict
      conflict = null
      try {
        const local = d.local()
        if (keep === 'cloud') {
          if (local && !local.sample) d.setAside(local)
          d.apply(remote.data)
          set({ rev: remote.rev, dirty: false })
          return synced()
        }
        d.setAside(remote.data)
        set({ rev: remote.rev, dirty: true })
        await push()
      } catch (e) { fail(e) }
    }),
    get meta() { return meta },
    get conflict() { return conflict },
  }
}
export type Engine = ReturnType<typeof createEngine>
