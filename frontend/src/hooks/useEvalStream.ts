import { useState, useEffect } from 'react'

export interface EvalEvent {
  event_type: string
  run_id: string
  timestamp: string
  // run.started
  models?: string[]
  dataset_size?: number
  // run.completed
  composite_scores?: Record<string, number>
  // run.failed
  error?: string
  // model.scored
  model?: string
  composite_score?: number | null
}

const MAX_EVENTS = 50
const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1') as string

export function useEvalStream(): EvalEvent[] {
  const [events, setEvents] = useState<EvalEvent[]>([])

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/evaluations/stream`)

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as EvalEvent
        if (!event.event_type) return
        setEvents((prev) => [...prev.slice(-(MAX_EVENTS - 1)), event])
      } catch {
        // ignore malformed frames
      }
    }

    // EventSource reconnects automatically on error — no manual handling needed
    return () => es.close()
  }, [])

  return events
}
