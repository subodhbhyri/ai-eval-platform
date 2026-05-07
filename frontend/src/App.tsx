import { useState } from 'react'
import { DashboardPage } from './pages/DashboardPage'
import { RunDetailPage } from './pages/RunDetailPage'

export default function App() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top nav */}
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono font-bold text-slate-100 text-sm tracking-wider uppercase">
              LLM Eval
            </span>
            <span className="text-slate-700 font-mono text-xs">/ dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
            >
              API docs ↗
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {selectedRunId ? (
          <RunDetailPage
            runId={selectedRunId}
            onBack={() => setSelectedRunId(null)}
          />
        ) : (
          <DashboardPage onSelectRun={setSelectedRunId} />
        )}
      </main>
    </div>
  )
}
