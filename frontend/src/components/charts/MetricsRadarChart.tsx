import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import type { ModelResult } from '../../types/evaluation'

const METRIC_LABELS: Record<string, string> = {
  faithfulness: 'Faithfulness',
  answer_relevancy: 'Relevancy',
  context_precision: 'Precision',
  context_recall: 'Recall',
}

const MODEL_COLORS = ['#00ff88', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe']

interface Props {
  results: ModelResult[]
}

export function MetricsRadarChart({ results }: Props) {
  const metrics = Object.keys(METRIC_LABELS)

  const data = metrics.map((key) => {
    const entry: Record<string, string | number> = { metric: METRIC_LABELS[key] }
    results.forEach((r) => {
      const val = r.metrics[key as keyof typeof r.metrics]
      entry[r.model_name] = val != null ? Math.round(val * 100) : 0
    })
    return entry
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data}>
        <PolarGrid stroke="#1e293b" />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: '#94a3b8', fontSize: 12, fontFamily: 'DM Mono, monospace' }}
        />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontFamily: 'DM Mono, monospace' }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={(val) => [`${val ?? 0}%`] as [string]}
        />
        <Legend
          wrapperStyle={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#94a3b8' }}
        />
        {results.map((r, i) => (
          <Radar
            key={r.model_name}
            name={r.model_name}
            dataKey={r.model_name}
            stroke={MODEL_COLORS[i % MODEL_COLORS.length]}
            fill={MODEL_COLORS[i % MODEL_COLORS.length]}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  )
}
