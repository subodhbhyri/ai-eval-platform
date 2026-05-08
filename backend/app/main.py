from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import get_settings
from app.db.session import create_tables
from app.core.cache import close_redis
from app.api.routes import evaluations

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):

    # Startup
    await create_tables()
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
