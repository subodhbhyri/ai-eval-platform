import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db, AsyncSessionLocal
from app.schemas.evaluation import EvaluationRunCreate, EvaluationRunOut, EvaluationRunSummary
from app.services import evaluation_service, event_bus

router = APIRouter(prefix="/evaluations", tags=["evaluations"])
settings = get_settings()


@router.post(
    "/",
    response_model=EvaluationRunOut,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a dataset and run multi-model evaluation",
)
async def create_evaluation(
    payload: EvaluationRunCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Creates the run record (status: pending) and returns immediately.
    The evaluation executes as a background task; poll GET /{run_id} for progress.
    """
    try:
        run = await evaluation_service.create_evaluation_run(payload, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    background_tasks.add_task(
        evaluation_service.run_evaluation_background,
        str(run.id),
        payload,
        AsyncSessionLocal,
    )
    return run


@router.get(
    "/",
    response_model=list[EvaluationRunSummary],
    summary="List recent evaluation runs",
)
async def list_evaluations(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    return await evaluation_service.list_runs(db, limit=limit)


@router.get(
    "/stream",
    summary="Server-Sent Events stream of real-time evaluation lifecycle events",
)
async def stream_eval_events():
    """
    SSE endpoint — each connected client gets every event published by the Kafka consumer.
    Returns an empty keepalive stream when KAFKA_ENABLED=false so the frontend
    can connect safely without crashing.
    """
    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }

    if not settings.kafka_enabled:
        async def _keepalive():
            while True:
                yield ": keepalive\n\n"
                await asyncio.sleep(15)

        return StreamingResponse(_keepalive(), media_type="text/event-stream", headers=headers)

    q = event_bus.subscribe()

    async def _generate():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {json.dumps(event, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            event_bus.unsubscribe(q)

    return StreamingResponse(_generate(), media_type="text/event-stream", headers=headers)


@router.get(
    "/{run_id}",
    response_model=EvaluationRunOut,
    summary="Get a single run with all model results",
)
async def get_evaluation(
    run_id: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    run = await evaluation_service.get_run(run_id, db)
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    response.headers["Cache-Control"] = "no-cache"
    return run
