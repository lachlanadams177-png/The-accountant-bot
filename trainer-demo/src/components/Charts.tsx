import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtDM } from '../lib/date'

const INK_MUTED = '#7a817c'
const GRID = '#ece9e2'
const SERIES = '#3f826d'

const axis = { tick: { fill: INK_MUTED, fontSize: 12 }, axisLine: false, tickLine: false } as const

function Tip({ active, payload, unit, label }: { active?: boolean; payload?: { value: number; payload: { date?: string; week?: string; sets?: string; scheduled?: number } }[]; unit: string; label?: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const date = p.payload.date ?? p.payload.week ?? label
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <div className="text-muted">{date ? (p.payload.week ? `Week of ${fmtDM(date)}` : fmtDM(date)) : ''}</div>
      <div className="mt-0.5 font-semibold text-ink text-sm">
        {p.value}
        {unit}
        {p.payload.scheduled != null && <span className="font-normal text-muted"> of {p.payload.scheduled} scheduled</span>}
      </div>
      {p.payload.sets && <div className="mt-0.5 text-muted max-w-[220px]">{p.payload.sets}</div>}
    </div>
  )
}

/** Single-series line over time (body weight, top set). */
export function TrendChart({ data, dataKey, unit, height = 220 }: { data: { date: string }[]; dataKey: string; unit: string; height?: number }) {
  const values = data.map((d) => (d as Record<string, unknown>)[dataKey] as number)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(1, (max - min) * 0.25)
  return (
    <div style={{ height }} role="img" aria-label={`Chart of ${dataKey} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDM} {...axis} minTickGap={24} />
          <YAxis domain={[Math.floor(min - pad), Math.ceil(max + pad)]} {...axis} width={44} />
          <Tooltip content={<Tip unit={unit} />} cursor={{ stroke: '#c9c5ba', strokeDasharray: '3 3' }} />
          <Line type="monotone" dataKey={dataKey} stroke={SERIES} strokeWidth={2} dot={{ r: 4, fill: SERIES, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Completed workouts per week. */
export function WeeklyBars({ data, height = 180 }: { data: { week: string; completed: number; scheduled: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Workouts completed per week">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: -24 }} barCategoryGap="28%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="week" tickFormatter={fmtDM} {...axis} />
          <YAxis allowDecimals={false} {...axis} width={40} />
          <Tooltip content={<Tip unit=" completed" />} cursor={{ fill: 'rgba(31,36,33,0.04)' }} />
          <Bar dataKey="completed" fill={SERIES} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
