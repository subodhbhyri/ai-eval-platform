from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from app.models.evaluation import RunStatus


# --- Dataset item ---

class DatasetItem(BaseModel):
    question: str
    ground_truth: str
    contexts: List[str] = Field(..., min_length=1)


# --- Evaluation run ---

class EvaluationRunCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    models: List[str] = Field(..., min_length=1, description="Model IDs to benchmark")
    dataset: List[DatasetItem] = Field(..., min_length=1, max_length=100)

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "GPT-4o vs Claude 3.5 — June 2025",
                "description": "Faithfulness comparison on RAG QA dataset",
                "models": ["gpt-4o", "claude-3-5-sonnet-20241022"],
                "dataset": [
                    {
                        "question": "What is the capital of France?",
                        "ground_truth": "Paris",
                        "contexts": ["France is a country in Western Europe. Its capital is Paris."]
                    }
                ]
            }
        }
    }


class MetricScores(BaseModel):
    faithfulness: Optional[float] = None
    answer_relevancy: Optional[float] = None
    context_precision: Optional[float] = None
    context_recall: Optional[float] = None
    composite_score: Optional[float] = None


class ModelResultOut(BaseModel):
    id: UUID
    model_name: str
    metrics: MetricScores
    latency_ms: Optional[int] = None
    total_tokens: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, m):
        return cls(
            id=m.id,
            model_name=m.model_name,
            metrics=MetricScores(
                faithfulness=m.faithfulness,
                answer_relevancy=m.answer_relevancy,
                context_precision=m.context_precision,
                context_recall=m.context_recall,
                composite_score=m.composite_score,
            ),
            latency_ms=m.latency_ms,
            total_tokens=m.total_tokens,
            created_at=m.created_at,
        )


class EvaluationRunOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    status: RunStatus
    models: List[str]
    dataset_size: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    results: List[ModelResultOut] = []

    model_config = {"from_attributes": True}


class EvaluationRunSummary(BaseModel):
    id: UUID
    name: str
    status: RunStatus
    models: List[str]
    dataset_size: int
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}
