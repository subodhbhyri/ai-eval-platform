import { useState } from 'react'
import { evaluationApi } from '../../api/client'
import type { CreateEvaluationPayload } from '../../types/evaluation'

const EXAMPLE_PAYLOAD: CreateEvaluationPayload = {
  name: 'My eval run',
  description: 'Testing faithfulness on RAG dataset',
  models: ['claude-sonnet-4-5'],
  dataset: [
    {
      question: 'What is the capital of France?',
      ground_truth: 'Paris',
      contexts: ['France is a country in Western Europe. Its capital is Paris.'],
    },
  ],
}

interface Props {
  onSubmitted: (id: string) => void
}

export function SubmitEvalForm({ onSubmitted }: Props) {
  const [json, setJson] = useState(JSON.stringify(EXAMPLE_PAYLOAD, null, 2))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      const payload = JSON.parse(json) as CreateEvaluationPayload
      const run = await evaluationApi.create(payload)
      onSubmitted(run.id)
    } catch (e: any) {
      setError(e.response?.data?.detail ? JSON.stringify(e.response.data.detail) : e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono text-slate-300 uppercase tracking-widest">Submit Evaluation</h2>
        <span className="text-xs text-slate-600 font-mono">JSON payload</span>
      </div>

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={16}
        className="w-full rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs p-4 resize-none focus:outline-none focus:border-emerald-500/50 transition-colors"
        spellCheck={false}
      />

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs font-mono text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-mono font-bold text-sm tracking-wider transition-all duration-200 uppercase"
      >
        {loading ? 'Running evaluation...' : 'Run Evaluation →'}
      </button>
    </div>
  )
}
