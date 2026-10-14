/**
 * The 3D scenes. This file (and three.js) is only downloaded when a scene is actually shown,
 * and scenes render on demand: nothing redraws while the picture is still.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/** Resolve a CSS colour like var(--s2) to something three.js understands. */
function cssColor(v: string) {
  const m = v.match(/var\((--[^)]+)\)/)
  const raw = m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : v
  return new THREE.Color(raw || '#888')
}

/* ---------------- money allocation ring ---------------- */
type Seg = { value: number; color: string; label: string }

function Ring({ segs, themeKey }: { segs: Seg[]; themeKey: string }) {
  const group = useRef<THREE.Group>(null)
  const { invalidate, pointer } = useThree()
  const t0 = useRef(performance.now())
  const total = segs.reduce((a, s) => a + Math.max(0, s.value), 0) || 1
  const pieces = useMemo(() => {
    const gap = segs.filter((s) => s.value > 0).length > 1 ? 0.05 : 0
    let a = Math.PI / 2
    return segs.filter((s) => s.value > 0).map((s) => {
      const arc = (s.value / total) * Math.PI * 2
      const p = { start: a - arc + gap / 2, arc: Math.max(0.02, arc - gap), color: cssColor(s.color) }
      a -= arc
      return p
    })
  }, [segs, total, themeKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { t0.current = performance.now(); invalidate() }, [pieces, invalidate])
  useFrame(() => {
    const g = group.current
    if (!g) return
    const k = Math.min(1, (performance.now() - t0.current) / 1100)
    const e = 1 - Math.pow(1 - k, 3)
    g.scale.setScalar(0.6 + 0.4 * e)
    g.rotation.z = (1 - e) * -1.2
    // lean gently towards the pointer
    const tx = -0.55 + pointer.y * 0.18, ty = pointer.x * 0.25
    g.rotation.x += (tx - g.rotation.x) * 0.12
    g.rotation.y += (ty - g.rotation.y) * 0.12
    if (k < 1 || Math.abs(tx - g.rotation.x) > 0.001 || Math.abs(ty - g.rotation.y) > 0.001) invalidate()
  })
  return (
    <group ref={group} rotation={[-0.55, 0, 0]}>
      {pieces.map((p, i) => (
        <mesh key={i} rotation={[0, 0, p.start]}>
          <torusGeometry args={[1.35, 0.3, 28, 96, p.arc]} />
          <meshStandardMaterial color={p.color} metalness={0.35} roughness={0.28} emissive={p.color} emissiveIntensity={0.18} />
        </mesh>
      ))}
      <mesh position={[0, 0, -0.05]}>
        <torusGeometry args={[1.35, 0.33, 12, 96]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.12} />
      </mesh>
    </group>
  )
}

export function AllocationRing({ segs }: { segs: Seg[] }) {
  const themeKey = typeof document !== 'undefined' ? (document.documentElement.dataset.theme ?? 'system') : ''
  return (
    <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ position: [0, 0, 4.4], fov: 42 }} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} aria-hidden>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <pointLight position={[-3, -2, 3]} intensity={18} color="#9185ff" />
      <Ring segs={segs} themeKey={themeKey} />
      <Invalidator />
    </Canvas>
  )
}
/** Redraw while the pointer moves over the scene (demand rendering stays idle otherwise). */
function Invalidator() {
  const { invalidate, gl } = useThree()
  useEffect(() => {
    const el = gl.domElement
    const h = () => invalidate()
    el.addEventListener('pointermove', h)
    el.addEventListener('pointerleave', h)
    return () => { el.removeEventListener('pointermove', h); el.removeEventListener('pointerleave', h) }
  }, [gl, invalidate])
  return null
}

/* ---------------- floating coins for the welcome screen ---------------- */
function Coins() {
  const g = useRef<THREE.Group>(null)
  const coins = useMemo(() => Array.from({ length: 9 }, (_, i) => ({
    r: 1.6 + (i % 3) * 0.45, a: (i / 9) * Math.PI * 2, y: ((i * 37) % 10) / 10 - 0.5, s: 0.22 + ((i * 13) % 5) * 0.03, gold: i % 3 !== 1,
  })), [])
  useFrame((st) => {
    if (!g.current) return
    const t = st.clock.elapsedTime
    g.current.rotation.y = t * 0.25
    g.current.children.forEach((c, i) => {
      if (i === 0) return
      c.position.y = coins[i - 1].y + Math.sin(t * 1.2 + i) * 0.12
      c.rotation.x = t * 0.9 + i
      c.rotation.z = t * 0.4 + i
    })
  })
  return (
    <group ref={g}>
      <mesh rotation={[1.15, 0, 0]}>
        <torusGeometry args={[1.05, 0.13, 24, 96]} />
        <meshStandardMaterial color="#9185ff" metalness={0.5} roughness={0.25} emissive="#5847d6" emissiveIntensity={0.35} />
      </mesh>
      {coins.map((c, i) => (
        <mesh key={i} position={[Math.cos(c.a) * c.r, c.y, Math.sin(c.a) * c.r]} scale={c.s}>
          <cylinderGeometry args={[1, 1, 0.22, 40]} />
          <meshStandardMaterial color={c.gold ? '#f6c46e' : '#4fd5b2'} metalness={0.35} roughness={0.3} emissive={c.gold ? '#7a4d0c' : '#0d4f40'} emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  )
}
export function CoinScene() {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.6, 5], fov: 42 }} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} aria-hidden>
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#ffffff', '#7565ea', 0.8]} />
      <directionalLight position={[2, 5, 4]} intensity={2} />
      <pointLight position={[-3, 1, 2]} intensity={20} color="#9185ff" />
      <Coins />
    </Canvas>
  )
}
