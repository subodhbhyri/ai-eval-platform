import { useState, useEffect, useRef } from 'react'
import { useEvaluationRuns } from '../hooks/useEvaluations'
import { useEvalStream, type EvalEvent } from '../hooks/useEvalStream'
import { evaluationApi } from '../api/client'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SubmitEvalForm } from '../components/ui/SubmitEvalForm'
import { TrendChart } from '../components/charts/TrendChart'
import { formatDistanceToNow } from 'date-fns'
import type { EvaluationRun, ModelResult } from '../types/evaluation'

interface Props {
  onSelectRun: (id: string) => void
}

const DOT_COLOR: Record<string, string> = {
  'run.started': 'bg-blue-400',
  'run.completed': 'bg-emerald-400',
  'run.failed': 'bg-red-400',
  'model.scored': 'bg-yellow-400',
}

function eventLabel(event: EvalEvent, runName: string | undefined): string {
  const name = runName ? `"${runName}"` : event.run_id.slice(0, 8)
  switch (event.event_type) {
    case 'run.started':
      return `${name} started (${event.models?.length ?? 0} models, ${event.dataset_size ?? 0} items)`
    case 'run.completed': {
      const scores = event.composite_scores
        ? Object.entries(event.composite_scores)
            .map(([m, s]) => `${m.split('-')[0]}:${s?.toFixed(2) ?? '—'}`)
            .join(' ')
        : ''
      return `${name} completed${scores ? '  ' + scores : ''}`
    }
    case 'run.failed':
      return `${name} failed — ${event.error ?? 'unknown error'}`
    case 'model.scored':
      return `${event.model ?? '?'} scored ${event.composite_score?.toFixed(2) ?? '—'} on ${name}`
    default:
      return `${event.event_type} on ${name}`
  }
}

export function DashboardPage({ onSelectRun }: Props) {
  const { runs, loading, error, refetch } = useEvaluationRuns(5000)
  const [showForm, setShowForm] = useState(false)
  const events = useEvalStream()
  const feedRef = useRef<HTMLDivElement>(null)

  // Full run details keyed by run ID, for the trend chart
  const [runDetails, setRunDetails] = useState<Record<string, EvaluationRun>>({})
  const [resultsLoading, setResultsLoading] = useState(false)
  const fetchedIds = useRef(new Set<string>())

  const handleSubmitted = (id: string) => {
    setShowForm(false)
    refetch()
    onSelectRun(id)
  }

  // Fetch full results for the last 10 completed runs, incrementally
  useEffect(() => {
    const completedIds = runs
      .filter(r => r.status === 'completed')
      .slice(0, 10)
      .map(r => r.id)

    const missing = completedIds.filter(id => !fetchedIds.current.has(id))
    if (missing.length === 0) return

    missing.forEach(id => fetchedIds.current.add(id))
    setResultsLoading(true)
    evaluationApi
      .getResults(missing)
      .then(newDetails => setRunDetails(prev => ({ ...prev, ...newDetails })))
      .catch(() => {})
      .finally(() => setResultsLoading(false))
  }, [runs])

  // Auto-scroll live feed to latest event
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [events])

  const runNameById = Object.fromEntries(runs.map((r) => [r.id, r.name]))
  const visibleEvents = events.slice(-10)

  // Derive data for the trend chart
  const completedRuns = runs.filter(r => r.status === 'completed').slice(0, 10)
  const trendResults: Record<string, ModelResult[]> = {}
  completedRuns.forEach(run => {
    if (runDetails[run.id]) trendResults[run.id] = runDetails[run.id].results
  })
  const runsWithResults = completedRuns.filter(r => Boolean(trendResults[r.id]))

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

      {/* Trend chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Composite score over time
          </span>
        </div>
        <div className="p-4">
          {resultsLoading && runsWithResults.length === 0 ? (
            <div className="h-48 rounded-lg bg-slate-800/50 animate-pulse" />
          ) : (
            <TrendChart runs={runsWithResults} results={trendResults} />
          )}
        </div>
      </div>

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

      {/* Live events feed */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Live events</span>
          <span className="flex items-center gap-1.5 text-xs font-mono text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            streaming
          </span>
        </div>

        <div
          ref={feedRef}
          className="max-h-52 overflow-y-auto px-4 py-2 flex flex-col gap-1 scroll-smooth"
        >
          {visibleEvents.length === 0 ? (
            <p className="text-xs font-mono text-slate-700 py-4 text-center">
              Waiting for events…
            </p>
          ) : (
            visibleEvents.map((ev, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLOR[ev.event_type] ?? 'bg-slate-500'}`}
                />
                <span className="text-xs font-mono text-slate-300 flex-1 truncate">
                  {eventLabel(ev, runNameById[ev.run_id])}
                </span>
                <span className="text-xs font-mono text-slate-600 flex-shrink-0 tabular-nums">
                  {new Date(ev.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
