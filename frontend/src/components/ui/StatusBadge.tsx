import type { RunStatus } from '../../types/evaluation'

const STATUS_STYLES: Record<RunStatus, string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  running:   'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed:    'bg-red-500/10 text-red-400 border-red-500/20',
}

const STATUS_DOTS: Record<RunStatus, string> = {
  pending:   'bg-yellow-400',
  running:   'bg-blue-400',
  completed: 'bg-emerald-400',
  failed:    'bg-red-400',
}

export function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${STATUS_STYLES[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[status]}`} />
      {status}
    </span>
  )
}
