from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.evaluation import EvaluationRunCreate, EvaluationRunOut, EvaluationRunSummary
from app.services import evaluation_service

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


@router.post(
    "/",
    response_model=EvaluationRunOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a dataset and run multi-model evaluation",
)
async def create_evaluation(
    payload: EvaluationRunCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Triggers a synchronous evaluation run across all specified models.
    For large datasets consider the async background variant below.
    """
    try:
        return await evaluation_service.create_and_run_evaluation(payload, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    "/{run_id}",
    response_model=EvaluationRunOut,
    summary="Get a single run with all model results",
)
async def get_evaluation(
    run_id: str,
    db: AsyncSession = Depends(get_db),
):
    run = await evaluation_service.get_run(run_id, db)
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    return run
