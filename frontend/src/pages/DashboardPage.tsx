import { useState } from 'react'
import { useEvaluationRuns } from '../hooks/useEvaluations'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SubmitEvalForm } from '../components/ui/SubmitEvalForm'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  onSelectRun: (id: string) => void
}

export function DashboardPage({ onSelectRun }: Props) {
  const { runs, loading, error, refetch } = useEvaluationRuns(5000)
  const [showForm, setShowForm] = useState(false)

  const handleSubmitted = (id: string) => {
    setShowForm(false)
    refetch()
    onSelectRun(id)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-slate-100 tracking-tight">Eval Dashboard</h1>
          <p className="text-xs font-mono text-slate-500 mt-1">
            {runs.length} run{runs.length !== 1 ? 's' : ''} · auto-refreshes every 5s
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs tracking-wider transition-all duration-200 uppercase"
        >
          {showForm ? '✕ Cancel' : '+ New Run'}
        </button>
      </div>

      {/* Submit form */}
      {showForm && (
        <SubmitEvalForm onSubmitted={handleSubmitted} />
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs font-mono text-red-400">
          Cannot reach backend: {error}
        </div>
      )}

      {/* Runs table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <span className="col-span-4 text-xs font-mono text-slate-500 uppercase tracking-widest">Name</span>
          <span className="col-span-2 text-xs font-mono text-slate-500 uppercase tracking-widest">Status</span>
          <span className="col-span-3 text-xs font-mono text-slate-500 uppercase tracking-widest">Models</span>
          <span className="col-span-2 text-xs font-mono text-slate-500 uppercase tracking-widest">Items</span>
          <span className="col-span-1 text-xs font-mono text-slate-500 uppercase tracking-widest">Age</span>
        </div>

        {loading && (
          <div className="px-4 py-8 text-center text-xs font-mono text-slate-600 animate-pulse">
            loading runs...
          </div>
        )}

        {!loading && runs.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-slate-500 font-mono text-sm">No evaluation runs yet</p>
            <p className="text-slate-600 font-mono text-xs mt-1">Click "+ New Run" to get started</p>
          </div>
        )}

        {runs.map((run, i) => (
          <div
            key={run.id}
            onClick={() => onSelectRun(run.id)}
            className={`grid grid-cols-12 gap-4 px-4 py-3.5 cursor-pointer transition-colors hover:bg-slate-800/50 ${
              i < runs.length - 1 ? 'border-b border-slate-800/50' : ''
            }`}
          >
            <div className="col-span-4 flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-mono text-slate-200 truncate">{run.name}</span>
            </div>
            <div className="col-span-2 flex items-center">
              <StatusBadge status={run.status} />
            </div>
            <div className="col-span-3 flex items-center gap-1 flex-wrap">
              {run.models.map((m) => (
                <span key={m} className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                  {m}
                </span>
              ))}
            </div>
            <div className="col-span-2 flex items-center">
              <span className="text-xs font-mono text-slate-400">{run.dataset_size}</span>
            </div>
            <div className="col-span-1 flex items-center">
              <span className="text-xs font-mono text-slate-600">
                {formatDistanceToNow(new Date(run.created_at), { addSuffix: false })
                  .replace('about ', '')
                  .replace(' hours', 'h')
                  .replace(' hour', 'h')
                  .replace(' minutes', 'm')
                  .replace(' minute', 'm')
                  .replace(' seconds', 's')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
