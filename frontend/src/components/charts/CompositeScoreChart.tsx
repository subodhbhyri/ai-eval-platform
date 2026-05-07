import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { ModelResult } from '../../types/evaluation'

const COLORS = ['#00ff88', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe']

interface Props {
  results: ModelResult[]
}

export function CompositeScoreChart({ results }: Props) {
  const data = results.map((r) => ({
    model: r.model_name.split('-').slice(0, 3).join('-'), // truncate long names
    score: r.metrics.composite_score != null ? Math.round(r.metrics.composite_score * 100) : 0,
    latency: r.latency_ms ?? 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="model"
          tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontFamily: 'DM Mono, monospace' }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={(val: number) => [`${val}%`, 'Composite Score']}
          cursor={{ fill: '#1e293b' }}
        />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
