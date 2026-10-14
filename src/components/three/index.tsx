import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { effectsOn } from '../ui'

const Scenes = lazy(() => import('./Scenes').then((m) => ({ default: m.AllocationRing })))
const Coins = lazy(() => import('./Scenes').then((m) => ({ default: m.CoinScene })))

let webgl: boolean | null = null
/** True when the browser can draw WebGL. Checked once. */
export function hasWebGL() {
  if (webgl != null) return webgl
  try {
    const c = document.createElement('canvas')
    webgl = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch { webgl = false }
  return webgl
}

/** Only mount a 3D scene while it is on screen, and only when 3D is available and wanted. */
function use3D(minWidth = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [ok] = useState(() => effectsOn() && hasWebGL() && window.innerWidth >= minWidth)
  useEffect(() => {
    if (!ok || !ref.current) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '100px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [ok])
  return { ref, show: ok && visible, ok }
}

/** 3D ring of where this month's money goes. Falls back to `fallback` (an SVG) without WebGL or with reduced effects. */
export function AllocationRing3D({ segs, fallback, className = '' }: { segs: { value: number; color: string; label: string }[]; fallback: ReactNode; className?: string }) {
  const { ref, show, ok } = use3D()
  return (
    <div ref={ref} className={`relative ${className}`}>
      {ok ? (show ? <Suspense fallback={fallback}><Scenes segs={segs} /></Suspense> : fallback) : fallback}
    </div>
  )
}

export function CoinScene3D({ fallback, className = '' }: { fallback: ReactNode; className?: string }) {
  // phones get the flat illustration: smaller download, smoother scrolling
  const { ref, show, ok } = use3D(640)
  return <div ref={ref} className={`relative ${className}`}>{ok ? (show ? <Suspense fallback={fallback}><Coins /></Suspense> : fallback) : fallback}</div>
}
