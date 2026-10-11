import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useReducedMotion } from 'framer-motion'
import { money, moneyShort } from '../lib/money'

const axis = { fill: 'var(--muted)', fontSize: 11.5 }
export interface Series { key: string; name: string; color: string; dashed?: boolean; area?: boolean }

function Tip({ active, payload, label, series, title }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string | number; series: Series[]; title?: (l: string | number) => string }) {
  if (!active || !payload?.length) return null
  const rows = series.filter((s) => payload.some((p) => p.dataKey === s.key && p.value != null)).reverse()
  return (
    <div className="min-w-[170px] rounded-2xl border border-line2 bg-surface px-3.5 py-2.5 text-[13px] text-ink shadow-pop">
      <div className="mb-1 font-bold">{title ? title(label ?? '') : label}</div>
      {rows.map((s) => {
        const v = payload.find((p) => p.dataKey === s.key)!.value
        return (
          <div key={s.key} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-ink2"><i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />{s.name}</span>
            <b className="tnum">{money(v)}</b>
          </div>
        )
      })}
    </div>
  )
}

/** Line/area chart over time. Dashed series are references (plan, last month). */
export function TimeChart({ data, x, series, height = 240, title, xTicks }: { data: Record<string, number | string | null>[]; x: string; series: Series[]; height?: number | string; title?: (l: string | number) => string; xTicks?: (string | number)[] }) {
  const reduce = useReducedMotion()
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
          <defs>
            {series.filter((s) => s.area).map((s) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line2)' }} ticks={xTicks} interval={xTicks ? 0 : 'preserveStartEnd'} minTickGap={14} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={58} tickFormatter={(v) => moneyShort(v)} />
          <Tooltip content={<Tip series={series} title={title} />} cursor={{ stroke: 'var(--line2)', strokeWidth: 1 }} />
          {series.map((s) =>
            s.area ? (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} fill={`url(#g-${s.key})`}
                dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={!reduce} animationDuration={1100} connectNulls={false} />
            ) : (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 5' : undefined}
                dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={!reduce} animationDuration={1100} />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Grouped bars per month; the selected month gets a soft highlight. */
export function MonthBars({ data, series, selected, onSelect, height = 240, title }: { data: Record<string, number | string>[]; series: Series[]; selected?: number; onSelect?: (i: number) => void; height?: number; title?: (l: string | number) => string }) {
  const reduce = useReducedMotion()
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%"
          onClick={(e) => { if (onSelect && e && typeof e.activeTooltipIndex === 'number') onSelect(e.activeTooltipIndex) }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line2)' }} interval="preserveStartEnd" minTickGap={6} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={58} tickFormatter={(v) => moneyShort(v)} />
          <Tooltip content={<Tip series={series} title={title} />} cursor={{ fill: 'var(--surface2)', radius: 10 } as object} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[5, 5, 0, 0]} isAnimationActive={!reduce} animationDuration={900} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
              {data.map((_, i) => <Cell key={i} fillOpacity={selected == null || selected === i ? 1 : 0.72} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Spark({ values, color, height = 44 }: { values: number[]; color: string; height?: number }) {
  const id = `sp${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <div style={{ height }} className="w-full" aria-hidden>
      <ResponsiveContainer>
        <AreaChart data={values.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 4, bottom: 2, left: 4 }}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Donut with a big total in the middle. Items are drawn in the order given. */
export function Donut({ items, center, sub, size = 200 }: { items: { name: string; value: number; color: string }[]; center: string; sub?: string; size?: number }) {
  const reduce = useReducedMotion()
  const total = items.reduce((a, b) => a + b.value, 0) || 1
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={items} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={items.length > 1 ? 1.5 : 0} stroke="var(--surface)" strokeWidth={2}
            startAngle={90} endAngle={-270} isAnimationActive={!reduce} animationDuration={900}>
            {items.map((it) => <Cell key={it.name} fill={it.color} />)}
          </Pie>
          <Tooltip content={({ active, payload }) => active && payload?.length ? (
            <div className="rounded-2xl border border-line2 bg-surface px-3.5 py-2.5 text-[13px] text-ink shadow-pop">
              <b>{String(payload[0].name)}</b><div className="tnum">{money(Number(payload[0].value))} · {Math.round((Number(payload[0].value) / total) * 100)}%</div>
            </div>) : null} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div><div className="font-display text-[22px] font-bold leading-tight">{center}</div>{sub && <div className="text-[12px] text-muted">{sub}</div>}</div>
      </div>
    </div>
  )
}
