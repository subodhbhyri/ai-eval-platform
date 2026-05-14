"""
Orchestrates an evaluation run end-to-end:
  1. Persist the run record
  2. Call RAGAS engine across all models
  3. Persist model results
  4. Emit Kafka events
  5. Update Redis cache
"""
import uuid
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.evaluation import EvaluationRun, ModelResult, RunStatus
from app.schemas.evaluation import EvaluationRunCreate, EvaluationRunOut, EvaluationRunSummary, ModelResultOut
from app.evaluation.ragas_engine import evaluate_all_models
from app.services import kafka_producer
from app.core.cache import cache_set, cache_get, cache_delete

logger = logging.getLogger(__name__)


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _run_cache_key(run_id: str) -> str:
    return f"eval:run:{run_id}"

def _runs_list_cache_key() -> str:
    return "eval:runs:list"


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _get_run_with_results(db: AsyncSession, run_id: uuid.UUID) -> EvaluationRun | None:
    stmt = (
        select(EvaluationRun)
        .where(EvaluationRun.id == run_id)
        .options(selectinload(EvaluationRun.results))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# ── Public API ────────────────────────────────────────────────────────────────

async def create_evaluation_run(
    payload: EvaluationRunCreate, db: AsyncSession
) -> EvaluationRunOut:
    """Persist a pending run record and return immediately. Fast path for the POST handler."""
    run = EvaluationRun(
        name=payload.name,
        description=payload.description,
        models=payload.models,
        dataset_size=len(payload.dataset),
        status=RunStatus.pending,
    )
    db.add(run)
    # flush to assign a DB-generated ID; the request lifecycle (get_db) commits
    # after the handler returns, which is guaranteed to happen before the
    # background task starts its own session.
    await db.flush()
    await cache_delete(_runs_list_cache_key())

    return EvaluationRunOut(
        id=run.id,
        name=run.name,
        description=run.description,
        status=run.status,
        models=run.models,
        dataset_size=run.dataset_size,
        created_at=run.created_at,
        started_at=None,
        completed_at=None,
        error_message=None,
        results=[],
    )


async def run_evaluation_background(
    run_id: str,
    payload: EvaluationRunCreate,
    session_factory: async_sessionmaker,
) -> None:
    """Full evaluation pipeline. Runs as a FastAPI BackgroundTask with its own DB session."""
    try:
        async with session_factory() as db:
            run_uuid = uuid.UUID(run_id)
            run = await _get_run_with_results(db, run_uuid)
            if not run:
                logger.error("[BG] Run %s not found — aborting", run_id)
                return

            run.status = RunStatus.running
            run.started_at = datetime.utcnow()
            await db.flush()
            await kafka_producer.emit_run_started(run_id, payload.models, len(payload.dataset))

            try:
                eval_results = await evaluate_all_models(payload.models, payload.dataset)

                composite_scores = {}
                for er in eval_results:
                    mr = ModelResult(
                        run_id=run_uuid,
                        model_name=er.model_name,
                        faithfulness=er.faithfulness,
                        answer_relevancy=er.answer_relevancy,
                        context_precision=er.context_precision,
                        context_recall=er.context_recall,
                        composite_score=er.composite_score,
                        latency_ms=er.avg_latency_ms,
                        total_tokens=er.total_tokens,
                        raw_outputs={"answers": er.raw_outputs, "error": er.error},
                    )
                    db.add(mr)
                    composite_scores[er.model_name] = er.composite_score
                    await kafka_producer.emit_model_scored(run_id, er.model_name, er.composite_score)

                run.status = RunStatus.completed
                run.completed_at = datetime.utcnow()
                await db.flush()
                await kafka_producer.emit_run_completed(run_id, composite_scores)

            except Exception as e:
                run.status = RunStatus.failed
                run.error_message = str(e)[:2000]
                run.completed_at = datetime.utcnow()
                await kafka_producer.emit_run_failed(run_id, str(e))

            finally:
                await db.commit()

            # Bust both stale caches, then repopulate from the freshly committed DB state
            await cache_delete(_run_cache_key(run_id))
            await cache_delete(_runs_list_cache_key())
            run = await _get_run_with_results(db, run_uuid)
            out = _serialize_run(run)
            await cache_set(_run_cache_key(run_id), out.model_dump())

    except Exception as e:
        logger.error("[BG] Fatal error in run_evaluation_background %s: %s", run_id, e, exc_info=True)


async def get_run(run_id: str, db: AsyncSession) -> EvaluationRunOut | None:
    cached = await cache_get(_run_cache_key(run_id))
    if cached:
        return EvaluationRunOut(**cached)

    run = await _get_run_with_results(db, uuid.UUID(run_id))
    if not run:
        return None

    out = _serialize_run(run)
    await cache_set(_run_cache_key(run_id), out.model_dump())
    return out


async def list_runs(db: AsyncSession, limit: int = 50) -> list[EvaluationRunSummary]:
    cached = await cache_get(_runs_list_cache_key())
    if cached:
        return [EvaluationRunSummary(**r) for r in cached]

    stmt = select(EvaluationRun).order_by(EvaluationRun.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    runs = result.scalars().all()
    summaries = [EvaluationRunSummary.model_validate(r) for r in runs]
    await cache_set(_runs_list_cache_key(), [s.model_dump() for s in summaries], ttl=60)
    return summaries


def _serialize_run(run: EvaluationRun) -> EvaluationRunOut:
    return EvaluationRunOut(
        id=run.id,
        name=run.name,
        description=run.description,
        status=run.status,
        models=run.models,
        dataset_size=run.dataset_size,
        created_at=run.created_at,
        started_at=run.started_at,
        completed_at=run.completed_at,
        error_message=run.error_message,
        results=[ModelResultOut.from_orm_model(r) for r in (run.results or [])],
    )
