export type RunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface MetricScores {
  faithfulness: number | null
  answer_relevancy: number | null
  context_precision: number | null
  context_recall: number | null
  composite_score: number | null
}

export interface ModelResult {
  id: string
  model_name: string
  metrics: MetricScores
  latency_ms: number | null
  total_tokens: number | null
  created_at: string
}

export interface EvaluationRun {
  id: string
  name: string
  description: string | null
  status: RunStatus
  models: string[]
  dataset_size: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  results: ModelResult[]
}

export interface EvaluationRunSummary {
  id: string
  name: string
  status: RunStatus
  models: string[]
  dataset_size: number
  created_at: string
  completed_at: string | null
}

export interface DatasetItem {
  question: string
  ground_truth: string
  contexts: string[]
}

export interface CreateEvaluationPayload {
  name: string
  description?: string
  models: string[]
  dataset: DatasetItem[]
}
