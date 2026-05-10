import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import get_settings
from app.db.session import create_tables
from app.core.cache import close_redis
from app.api.routes import evaluations
from app.services import kafka_consumer
from app.services.kafka_producer import _build_kafka_cfg

logger = logging.getLogger(__name__)
settings = get_settings()


def _ensure_topic_sync() -> None:
    """Create the eval-events topic if it doesn't already exist."""
    from confluent_kafka.admin import AdminClient, NewTopic
    from confluent_kafka import KafkaException

    topic = settings.kafka_topic_eval_events
    admin = AdminClient(_build_kafka_cfg())

    existing = admin.list_topics(timeout=10)
    if topic in existing.topics:
        logger.info("[Kafka] Topic '%s' already exists", topic)
        return

    futures = admin.create_topics([NewTopic(topic, num_partitions=1, replication_factor=3)])
    for t, f in futures.items():
        try:
            f.result()
            logger.info("[Kafka] Topic '%s' created", t)
        except KafkaException as exc:
            logger.warning("[Kafka] create_topics '%s': %s", t, exc)


async def _ensure_kafka_topic() -> None:
    if not settings.kafka_enabled:
        return
    await asyncio.to_thread(_ensure_topic_sync)


@asynccontextmanager
async def lifespan(app: FastAPI):

    # Startup
    await create_tables()
    await _ensure_kafka_topic()
    await kafka_consumer.start_consumer()
    yield
    # Shutdown
    await close_redis()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Benchmark LLM outputs across multiple models using RAGAS metrics.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Prometheus metrics at /metrics
Instrumentator().instrument(app).expose(app)

# Routers
app.include_router(evaluations.router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "app": settings.app_name}
