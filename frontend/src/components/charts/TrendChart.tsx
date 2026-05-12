import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { format } from 'date-fns'
import type { EvaluationRunSummary, ModelResult } from '../../types/evaluation'

interface Props {
  runs: EvaluationRunSummary[]
  results: Record<string, ModelResult[]>
}

const PALETTE = ['#00ff88', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe']

const FONT = { fontFamily: 'DM Mono, monospace', fontSize: 11 }

interface TooltipPayloadEntry {
  dataKey: string
  value: number
  color: string
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const runName = (payload[0] as any)?.payload?.runName as string | undefined
  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 8,
        padding: '8px 12px',
        ...FONT,
      }}
    >
      {runName && (
        <p style={{ color: '#94a3b8', marginBottom: 6 }}>{runName}</p>
      )}
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color, margin: '2px 0' }}>
          {entry.dataKey}: {entry.value != null ? `${entry.value.toFixed(1)}%` : '—'}
        </p>
      ))}
    </div>
  )
}

export function TrendChart({ runs, results }: Props) {
  if (runs.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-xs font-mono text-slate-600">
        Not enough data — need at least 2 completed runs
      </div>
    )
  }

  // Collect unique model names across all runs
  const modelSet = new Set<string>()
  Object.values(results).forEach(modelResults =>
    modelResults.forEach(r => modelSet.add(r.model_name))
  )
  const models = Array.from(modelSet)

  // Build one data point per run, sorted oldest → newest
  const sorted = [...runs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const data = sorted.map(run => {
    const point: Record<string, unknown> = {
      label: format(new Date(run.created_at), 'MMM d'),
      runName: run.name,
    }
    const modelResults = results[run.id] ?? []
    modelResults.forEach(r => {
      if (r.metrics.composite_score != null) {
        point[r.model_name] = parseFloat((r.metrics.composite_score * 100).toFixed(1))
      }
    })
    return point
  })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ ...FONT, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ ...FONT, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ ...FONT, color: '#94a3b8', paddingTop: 12 }}
        />
        {models.map((model, i) => (
          <Line
            key={model}
            type="monotone"
            dataKey={model}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3, fill: PALETTE[i % PALETTE.length] }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
