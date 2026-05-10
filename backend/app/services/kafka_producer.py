"""
Kafka producer — emits evaluation lifecycle events.
Gracefully no-ops when Kafka is disabled (KAFKA_ENABLED=false).
"""
import json
import asyncio
from datetime import datetime
from typing import Any, Optional
from app.core.config import get_settings

settings = get_settings()
_producer = None


def _build_kafka_cfg() -> dict:
    """Base client config, with SASL_SSL added when credentials are present."""
    cfg: dict = {"bootstrap.servers": settings.kafka_bootstrap_servers}
    if settings.kafka_sasl_username:
        cfg.update({
            "security.protocol": "SASL_SSL",
            "sasl.mechanism": "PLAIN",
            "sasl.username": settings.kafka_sasl_username,
            "sasl.password": settings.kafka_sasl_password,
        })
    return cfg


def _get_producer():
    global _producer
    if _producer is None and settings.kafka_enabled:
        from confluent_kafka import Producer
        _producer = Producer(_build_kafka_cfg())
    return _producer


def _delivery_report(err, msg):
    if err:
        print(f"[Kafka] Delivery failed: {err}")


async def emit_event(event_type: str, payload: dict[str, Any]) -> None:
    """Non-blocking event emission. Silently skips if Kafka is disabled."""
    producer = _get_producer()
    if not producer:
        return

    event = {
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        **payload,
    }
    await asyncio.to_thread(
        producer.produce,
        settings.kafka_topic_eval_events,
        key=str(payload.get("run_id", "unknown")),
        value=json.dumps(event, default=str),
        callback=_delivery_report,
    )
    await asyncio.to_thread(producer.poll, 0)


# Event helpers

async def emit_run_started(run_id: str, models: list[str], dataset_size: int):
    await emit_event("run.started", {"run_id": run_id, "models": models, "dataset_size": dataset_size})

async def emit_run_completed(run_id: str, composite_scores: dict[str, float]):
    await emit_event("run.completed", {"run_id": run_id, "composite_scores": composite_scores})

async def emit_run_failed(run_id: str, error: str):
    await emit_event("run.failed", {"run_id": run_id, "error": error})

async def emit_model_scored(run_id: str, model: str, composite_score: Optional[float]):
    await emit_event("model.scored", {"run_id": run_id, "model": model, "composite_score": composite_score})
