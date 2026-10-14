/**
 * Local-first storage. Data lives in this browser's IndexedDB (falling back to localStorage),
 * is never sent anywhere, and is NOT encrypted. Writes are batched so rapid edits cost one save.
 */
const DB = 'tally', STORE = 'kv'
let dbp: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE) }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error('blocked'))
    } catch (e) { reject(e) }
  })
  dbp.catch(() => { dbp = null })
  return dbp
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(r.result)
    t.onerror = () => reject(t.error ?? r.error)
    t.onabort = () => reject(t.error ?? new Error('aborted'))
  }))
}
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { localStorage.setItem(k, v) },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}

export type SaveListener = (ok: boolean, where: 'idb' | 'local' | 'none', error?: string) => void
let listener: SaveListener = () => {}
export const onSave = (f: SaveListener) => { listener = f }

let pending: { key: string; value: unknown } | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let writing: Promise<void> = Promise.resolve()

async function write(key: string, value: string) {
  try {
    await tx('readwrite', (s) => s.put(value, key))
    ls.del(key) // migrated: the old copy is no longer needed
    listener(true, 'idb')
  } catch (e) {
    try { ls.set(key, value); listener(true, 'local') }
    catch (e2) { listener(false, 'none', (e2 as Error)?.name === 'QuotaExceededError' ? 'quota' : String((e as Error)?.message ?? e)) }
  }
}
export function flush() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!pending) return writing
  const { key, value } = pending
  pending = null
  // turning the data into text happens here, after the screen has already updated
  let text: string
  try { text = JSON.stringify(value) } catch (e) { listener(false, 'none', String(e)); return writing }
  writing = writing.then(() => write(key, text))
  return writing
}
const idle = (f: () => void) => ('requestIdleCallback' in window ? (window as unknown as { requestIdleCallback: (f: () => void, o: { timeout: number }) => void }).requestIdleCallback(f, { timeout: 1000 }) : setTimeout(f, 0))
if (typeof window !== 'undefined') {
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  addEventListener('pagehide', () => { flush() })
}

/**
 * zustand persist storage: async reads; writes keep only a reference to the latest data and
 * serialise it once, in idle time, a moment after the last change.
 */
export const localFirstStorage = {
  async getItem<T>(key: string): Promise<T | null> {
    let text: string | null = null
    try {
      const v = await tx<string | undefined>('readonly', (s) => s.get(key) as IDBRequest<string | undefined>)
      if (v != null) text = v
    } catch { /* IndexedDB unavailable: fall through to localStorage */ }
    if (text == null) text = ls.get(key) // first run after the upgrade, or no IndexedDB
    if (text == null) return null
    try { return JSON.parse(text) as T } catch { return null }
  },
  setItem(key: string, value: unknown) {
    pending = { key, value }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => idle(flush), 250)
  },
  async removeItem(key: string) {
    pending = null
    try { await tx('readwrite', (s) => s.delete(key)) } catch { /* ignore */ }
    ls.del(key)
  },
}

/** Keep an extra copy under its own key (e.g. data set aside during a sync choice). */
export async function keepCopy(key: string, value: unknown) {
  const text = JSON.stringify({ savedAt: new Date().toISOString(), value })
  try { await tx('readwrite', (s) => s.put(text, key)) } catch { try { ls.set(key, text) } catch { /* nothing more we can do */ } }
}
export async function readCopy<T>(key: string): Promise<{ savedAt: string; value: T } | null> {
  let text: string | null = null
  try { const v = await tx<string | undefined>('readonly', (s) => s.get(key) as IDBRequest<string | undefined>); if (v != null) text = v } catch { /* fall back */ }
  text ??= ls.get(key)
  try { return text ? JSON.parse(text) : null } catch { return null }
}

/** Ask the browser not to evict our data under storage pressure (best effort). */
export async function askPersistent() {
  try { return (await navigator.storage?.persist?.()) ?? false } catch { return false }
}
export async function storageEstimate() {
  try { const e = await navigator.storage?.estimate?.(); return e ? { used: e.usage ?? 0, quota: e.quota ?? 0 } : null } catch { return null }
}
