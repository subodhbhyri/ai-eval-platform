import { useState, useEffect, useCallback } from 'react'
import { evaluationApi } from '../api/client'
import type { EvaluationRun, EvaluationRunSummary } from '../types/evaluation'

export function useEvaluationRuns(pollInterval = 5000) {
  const [runs, setRuns] = useState<EvaluationRunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    try {
      const data = await evaluationApi.list()
      setRuns(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, pollInterval)
    return () => clearInterval(id)
  }, [fetch, pollInterval])

  return { runs, loading, error, refetch: fetch }
}

export function useEvaluationRun(id: string | null) {
  const [run, setRun] = useState<EvaluationRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await evaluationApi.get(id)
      setRun(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetch()
    // Poll while run is active
    const id_interval = setInterval(async () => {
      if (!id) return
      const data = await evaluationApi.get(id).catch(() => null)
      if (data) {
        setRun(data)
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(id_interval)
        }
      }
    }, 2000)
    return () => clearInterval(id_interval)
  }, [fetch, id])

  return { run, loading, error, refetch: fetch }
}
