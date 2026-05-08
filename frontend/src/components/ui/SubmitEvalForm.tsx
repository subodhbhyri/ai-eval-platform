import { useState, useRef } from 'react'
import { evaluationApi } from '../../api/client'

const PRESET_MODELS = [
  'claude-sonnet-4-5',
  'claude-opus-4-6',
  'gpt-4o',
  'gpt-4o-mini',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]

interface DatasetItemState {
  question: string
  ground_truth: string
  contexts: string
}

interface Props {
  onSubmitted: (id: string) => void
}

export function SubmitEvalForm({ onSubmitted }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [customModel, setCustomModel] = useState('')
  const [dataset, setDataset] = useState<DatasetItemState[]>([
    { question: '', ground_truth: '', contexts: '' },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const customModelRef = useRef<HTMLInputElement>(null)

  const addModel = (model: string) => {
    const trimmed = model.trim()
    if (trimmed && !selectedModels.includes(trimmed)) {
      setSelectedModels((prev) => [...prev, trimmed])
    }
  }

  const removeModel = (model: string) => {
    setSelectedModels((prev) => prev.filter((m) => m !== model))
  }

  const handleCustomModelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addModel(customModel)
      setCustomModel('')
    }
  }

  const addDatasetItem = () => {
    setDataset((prev) => [...prev, { question: '', ground_truth: '', contexts: '' }])
  }

  const removeDatasetItem = (index: number) => {
    setDataset((prev) => prev.filter((_, i) => i !== index))
  }

  const updateDatasetItem = (index: number, field: keyof DatasetItemState, value: string) => {
    setDataset((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const handleSubmit = async () => {
    setError(null)

    if (!name.trim()) {
      setError('Run name is required.')
      return
    }
    if (selectedModels.length === 0) {
      setError('Select at least one model.')
      return
    }
    const filledItems = dataset.filter((item) => item.question.trim() || item.ground_truth.trim())
    if (filledItems.length === 0) {
      setError('Add at least one dataset item with a question and ground truth.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        models: selectedModels,
        dataset: dataset.map((item) => ({
          question: item.question.trim(),
          ground_truth: item.ground_truth.trim(),
          contexts: item.contexts
            .split('\n')
            .map((c) => c.trim())
            .filter(Boolean),
        })),
      }
      const run = await evaluationApi.create(payload)
      onSubmitted(run.id)
    } catch (e: any) {
      setError(
        e.response?.data?.detail
          ? JSON.stringify(e.response.data.detail)
          : e.message ?? 'Submission failed.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-6 font-mono">
      <h2 className="text-sm text-slate-300 uppercase tracking-widest">Submit Evaluation</h2>

      {/* Run Metadata */}
      <section className="flex flex-col gap-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Run Metadata</p>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">
            Run name <span className="text-emerald-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My eval run"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2 placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-400">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2 placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
      </section>

      {/* Model Selector */}
      <section className="flex flex-col gap-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">
          Models <span className="text-emerald-500">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_MODELS.map((m) => {
            const active = selectedModels.includes(m)
            return (
              <button
                key={m}
                type="button"
                onClick={() => (active ? removeModel(m) : addModel(m))}
                className={`px-3 py-1 rounded-full text-xs border transition-all duration-150 ${
                  active
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
                    : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {m}
              </button>
            )
          })}
        </div>

        {/* Custom model input */}
        <div className="flex gap-2">
          <input
            ref={customModelRef}
            type="text"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            onKeyDown={handleCustomModelKeyDown}
            placeholder="Custom model ID — press Enter to add"
            className="flex-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2 placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          <button
            type="button"
            onClick={() => {
              addModel(customModel)
              setCustomModel('')
              customModelRef.current?.focus()
            }}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
          >
            Add
          </button>
        </div>

        {/* Selected pills */}
        {selectedModels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedModels.map((m) => (
              <span
                key={m}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs"
              >
                {m}
                <button
                  type="button"
                  onClick={() => removeModel(m)}
                  className="text-emerald-600 hover:text-emerald-300 leading-none transition-colors"
                  aria-label={`Remove ${m}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Dataset Builder */}
      <section className="flex flex-col gap-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">
          Dataset <span className="text-emerald-500">*</span>
        </p>
        <div className="flex flex-col gap-4">
          {dataset.map((item, i) => (
            <div
              key={i}
              className="relative rounded-lg border border-slate-800 bg-slate-950/50 p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-600">Question {i + 1}</span>
                {dataset.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDatasetItem(i)}
                    className="text-xs text-slate-600 hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-500">Question</label>
                <input
                  type="text"
                  value={item.question}
                  onChange={(e) => updateDatasetItem(i, 'question', e.target.value)}
                  placeholder="What is the capital of France?"
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs px-3 py-2 placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-500">Ground truth</label>
                <input
                  type="text"
                  value={item.ground_truth}
                  onChange={(e) => updateDatasetItem(i, 'ground_truth', e.target.value)}
                  placeholder="Paris"
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs px-3 py-2 placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-500">
                  Contexts{' '}
                  <span className="text-slate-700">(one per line)</span>
                </label>
                <textarea
                  value={item.contexts}
                  onChange={(e) => updateDatasetItem(i, 'contexts', e.target.value)}
                  placeholder={"France is a country in Western Europe.\nIts capital city is Paris."}
                  rows={3}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs px-3 py-2 placeholder-slate-700 resize-none focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addDatasetItem}
          className="self-start text-xs text-emerald-500 hover:text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 px-3 py-1.5 rounded-lg transition-all duration-150"
        >
          + Add question
        </button>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold text-sm tracking-wider transition-all duration-200 uppercase"
      >
        {loading ? 'Running evaluation…' : 'Run Evaluation →'}
      </button>
    </div>
  )
}
