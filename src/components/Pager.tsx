import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export const PAGE_SIZES = [10, 25, 50, 100] as const

/**
 * Pages any list. Goes back to page 1 when `resetKey` changes (new search, filter or sort),
 * and stays on the nearest valid page when rows disappear (for example after a delete).
 */
export function usePaged<T>(items: T[], resetKey: string, initialSize = 25) {
  const [size, setSize] = useState(initialSize)
  const [page, setPage] = useState(1)
  const last = useRef(resetKey)
  if (last.current !== resetKey) { last.current = resetKey; if (page !== 1) setPage(1) }
  const pages = Math.max(1, Math.ceil(items.length / size))
  const cur = Math.min(page, pages)
  useEffect(() => { if (page > pages) setPage(pages) }, [page, pages])
  const rows = useMemo(() => items.slice((cur - 1) * size, cur * size), [items, cur, size])
  return { rows, page: cur, pages, size, total: items.length, setPage, setSize: (n: number) => { setSize(n); setPage(1) } }
}

/** Page numbers with ellipses: 1 … 4 5 6 … 20 */
function numbers(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const lo = Math.max(2, page - 1), hi = Math.min(pages - 1, page + 1)
  if (lo > 2) out.push('…')
  for (let i = lo; i <= hi; i++) out.push(i)
  if (hi < pages - 1) out.push('…')
  out.push(pages)
  return out
}

const btn = 'grid h-9 min-w-9 place-items-center rounded-xl px-2 text-[13.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35'

export function Pager({ page, pages, size, total, setPage, setSize, noun = 'items' }: {
  page: number; pages: number; size: number; total: number; setPage: (n: number) => void; setSize: (n: number) => void; noun?: string
}) {
  if (total === 0) return null
  const from = (page - 1) * size + 1, to = Math.min(total, page * size)
  const nf = new Intl.NumberFormat()
  return (
    <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <p className="text-[13.5px] text-ink2" aria-live="polite">Showing <b className="tnum text-ink">{nf.format(from)}–{nf.format(to)}</b> of <b className="tnum text-ink">{nf.format(total)}</b> {noun}</p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={`${btn} hidden hover:bg-surface2 sm:grid`} onClick={() => setPage(1)} disabled={page === 1} aria-label="First page"><ChevronsLeft size={16} /></button>
          <button type="button" className={`${btn} hover:bg-surface2`} onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={16} /><span className="sr-only">Previous</span></button>
          <span className="px-2 text-[13.5px] font-semibold sm:hidden">{page} / {pages}</span>
          <span className="hidden items-center gap-1 sm:flex">
            {numbers(page, pages).map((n, i) => n === '…'
              ? <span key={`e${i}`} className="px-1 text-muted" aria-hidden>…</span>
              : <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`}
                  className={`${btn} ${n === page ? 'bg-accent text-accent-ink' : 'hover:bg-surface2'}`}>{n}</button>)}
          </span>
          <button type="button" className={`${btn} hover:bg-surface2`} onClick={() => setPage(page + 1)} disabled={page === pages} aria-label="Next page"><ChevronRight size={16} /><span className="sr-only">Next</span></button>
          <button type="button" className={`${btn} hidden hover:bg-surface2 sm:grid`} onClick={() => setPage(pages)} disabled={page === pages} aria-label="Last page"><ChevronsRight size={16} /></button>
        </div>
      )}
      <label className="flex items-center gap-2 text-[13px] text-ink2">Per page
        <select className="field !w-auto !py-1.5" value={size} onChange={(e) => setSize(+e.target.value)}>{PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
    </nav>
  )
}
