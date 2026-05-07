"""
Orchestrates an evaluation run end-to-end:
  1. Persist the run record
  2. Call RAGAS engine across all models
  3. Persist model results
  4. Emit Kafka events
  5. Update Redis cache
"""
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.evaluation import EvaluationRun, ModelResult, RunStatus
from app.schemas.evaluation import EvaluationRunCreate, EvaluationRunOut, EvaluationRunSummary, ModelResultOut
from app.evaluation.ragas_engine import evaluate_all_models
from app.services import kafka_producer
from app.core.cache import cache_set, cache_get, cache_delete


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

async def create_and_run_evaluation(
    payload: EvaluationRunCreate, db: AsyncSession
) -> EvaluationRunOut:
    """Create a run record, execute evaluation, persist results."""

    # 1. Persist pending run
    run = EvaluationRun(
        name=payload.name,
        description=payload.description,
        models=payload.models,
        dataset_size=len(payload.dataset),
        status=RunStatus.pending,
    )
    db.add(run)
    await db.flush()  # get the ID without committing
    run_id_str = str(run.id)

    # 2. Emit started event
    run.status = RunStatus.running
    run.started_at = datetime.utcnow()
    await db.flush()
    await kafka_producer.emit_run_started(run_id_str, payload.models, len(payload.dataset))

    try:
        # 3. Run evaluations
        eval_results = await evaluate_all_models(payload.models, payload.dataset)

        # 4. Persist model results
        composite_scores = {}
        for er in eval_results:
            mr = ModelResult(
                run_id=run.id,
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
            await kafka_producer.emit_model_scored(run_id_str, er.model_name, er.composite_score)

        run.status = RunStatus.completed
        run.completed_at = datetime.utcnow()
        await db.flush()
        await kafka_producer.emit_run_completed(run_id_str, composite_scores)

    except Exception as e:
        run.status = RunStatus.failed
        run.error_message = str(e)[:2000]
        run.completed_at = datetime.utcnow()
        await kafka_producer.emit_run_failed(run_id_str, str(e))
        raise

    finally:
        await db.commit()
        await cache_delete(_runs_list_cache_key())

    # 5. Reload with results and cache
    run = await _get_run_with_results(db, run.id)
    out = _serialize_run(run)
    await cache_set(_run_cache_key(run_id_str), out.model_dump())
    return out


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
