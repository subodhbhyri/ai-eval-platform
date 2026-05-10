from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    app_name: str = "AI Eval Dashboard"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/eval_dashboard"

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 300

    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic_eval_events: str = "eval-events"
    kafka_enabled: bool = False  # set True when Kafka is running
    kafka_sasl_username: Optional[str] = None
    kafka_sasl_password: Optional[str] = None

    # LLM API keys
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    google_api_key: Optional[str] = None

    # Evaluation
    max_concurrent_evaluations: int = 3
    evaluation_timeout_seconds: int = 120

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
