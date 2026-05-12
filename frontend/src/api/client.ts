import axios from 'axios'
import type { EvaluationRun, EvaluationRunSummary, CreateEvaluationPayload } from '../types/evaluation'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

export const evaluationApi = {
  list: async (limit = 50): Promise<EvaluationRunSummary[]> => {
    const { data } = await api.get(`/evaluations/?limit=${limit}`)
    return data
  },

  get: async (id: string): Promise<EvaluationRun> => {
    const { data } = await api.get(`/evaluations/${id}`)
    return data
  },

  create: async (payload: CreateEvaluationPayload): Promise<EvaluationRun> => {
    const { data } = await api.post('/evaluations/', payload)
    return data
  },

  getResults: async (ids: string[]): Promise<Record<string, EvaluationRun>> => {
    const results = await Promise.all(ids.map(id => evaluationApi.get(id)))
    return Object.fromEntries(results.map(r => [r.id, r]))
  },
}
