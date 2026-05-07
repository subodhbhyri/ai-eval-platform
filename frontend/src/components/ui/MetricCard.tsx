interface Props {
  label: string
  value: number | null
  unit?: string
  highlight?: boolean
}

export function MetricCard({ label, value, unit = '%', highlight = false }: Props) {
  const display = value != null ? `${Math.round(value * 100)}${unit}` : '—'
  const score = value ?? 0

  const color =
    value == null ? 'text-slate-500' :
    score >= 0.8 ? 'text-emerald-400' :
    score >= 0.5 ? 'text-yellow-400' :
    'text-red-400'

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${
      highlight ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/50'
    }`}>
      <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">{label}</span>
      <span className={`text-3xl font-mono font-bold tracking-tight ${color}`}>{display}</span>
      {value != null && (
        <div className="mt-2 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              score >= 0.8 ? 'bg-emerald-400' : score >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
            }`}
            style={{ width: `${Math.round(score * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
