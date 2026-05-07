import { useEvaluationRun } from '../hooks/useEvaluations'
import { MetricCard } from '../components/ui/MetricCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { MetricsRadarChart } from '../components/charts/MetricsRadarChart'
import { CompositeScoreChart } from '../components/charts/CompositeScoreChart'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  runId: string
  onBack: () => void
}

export function RunDetailPage({ runId, onBack }: Props) {
  const { run, loading } = useEvaluationRun(runId)

  if (loading || !run) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 font-mono text-sm animate-pulse">loading run...</div>
      </div>
    )
  }

  const duration = run.started_at && run.completed_at
    ? ((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)
    : null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <button
            onClick={onBack}
            className="text-xs font-mono text-slate-500 hover:text-emerald-400 transition-colors w-fit"
          >
            ← back to runs
          </button>
          <h1 className="text-xl font-mono font-bold text-slate-100">{run.name}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={run.status} />
            <span className="text-xs font-mono text-slate-500">
              {run.dataset_size} items · {run.models.length} model{run.models.length > 1 ? 's' : ''}
              {duration && ` · ${duration}s`}
            </span>
            <span className="text-xs font-mono text-slate-600">
              {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>

      {run.status === 'running' && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs font-mono text-blue-400 animate-pulse">
          ⟳ Evaluation in progress — results will appear automatically
        </div>
      )}

      {run.error_message && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs font-mono text-red-400">
          {run.error_message}
        </div>
      )}

      {run.results.length > 0 && (
        <>
          {/* Per-model metric cards */}
          {run.results.map((result) => (
            <div key={result.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                  {result.model_name}
                </span>
                {result.latency_ms && (
                  <span className="text-xs font-mono text-slate-600">{result.latency_ms}ms · {result.total_tokens} tokens</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Composite" value={result.metrics.composite_score} highlight />
                <MetricCard label="Faithfulness" value={result.metrics.faithfulness} />
                <MetricCard label="Precision" value={result.metrics.context_precision} />
                <MetricCard label="Recall" value={result.metrics.context_recall} />
              </div>
            </div>
          ))}

          {/* Charts — only show if multiple models or metrics */}
          {run.results.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Composite Score</h3>
                <CompositeScoreChart results={run.results} />
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Metrics Radar</h3>
                <MetricsRadarChart results={run.results} />
              </div>
            </div>
          )}

          {run.results.length === 1 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Metrics Radar</h3>
              <MetricsRadarChart results={run.results} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
