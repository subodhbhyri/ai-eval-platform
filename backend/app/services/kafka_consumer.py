"""
Kafka consumer — reads from eval-events topic and broadcasts to the SSE event bus.
Runs as a background asyncio task; no-ops when KAFKA_ENABLED=false.
"""
import json
import asyncio
import logging
from app.core.config import get_settings
from app.services import event_bus
from app.services.kafka_producer import _build_kafka_cfg

logger = logging.getLogger(__name__)
settings = get_settings()

HANDLED_TYPES = {"run.started", "run.completed", "run.failed", "model.scored"}


async def _consume_loop() -> None:
    from confluent_kafka import Consumer, KafkaError

    cfg = _build_kafka_cfg()
    cfg.update({
        "group.id": "eval-dashboard-sse",
        "auto.offset.reset": "latest",
        "enable.auto.commit": True,
    })
    consumer = Consumer(cfg)
    consumer.subscribe([settings.kafka_topic_eval_events])
    logger.info("[Kafka] Consumer started — topic=%s", settings.kafka_topic_eval_events)

    try:
        while True:
            msg = await asyncio.to_thread(consumer.poll, 1.0)

            if msg is None:
                continue

            if msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    logger.error("[Kafka] Consumer error: %s", msg.error())
                continue

            try:
                raw = msg.value()
                if not raw:
                    continue
                event = json.loads(raw.decode("utf-8"))
                event_type = event.get("event_type", "unknown")

                if event_type in HANDLED_TYPES:
                    logger.info(
                        "[Kafka] %s  run_id=%s", event_type, event.get("run_id", "?")
                    )

                await event_bus.publish(event)

            except Exception as exc:
                logger.error("[Kafka] Failed to process message: %s", exc)

    finally:
        await asyncio.to_thread(consumer.close)
        logger.info("[Kafka] Consumer closed")


async def start_consumer() -> None:
    """Start the background consumer task. No-op when KAFKA_ENABLED=false."""
    if not settings.kafka_enabled:
        logger.info("[Kafka] KAFKA_ENABLED=false — consumer not started")
        return
    asyncio.create_task(_consume_loop(), name="kafka-consumer")
    logger.info("[Kafka] Consumer task scheduled")
