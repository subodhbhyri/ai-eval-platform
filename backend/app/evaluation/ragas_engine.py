"""
RAGAS evaluation engine.
Scores model answers using faithfulness, answer_relevancy,
context_precision, and context_recall.

RAGAS requires an LLM judge to compute metrics — we configure it
explicitly using whichever API key is available (Anthropic → OpenAI → Gemini).
"""
import asyncio
import traceback
from typing import Optional
from dataclasses import dataclass, field

from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)

from app.schemas.evaluation import DatasetItem
from app.services.llm_clients import call_llm, LLMResponse


@dataclass
class EvalResult:
    model_name: str
    faithfulness: Optional[float]
    answer_relevancy: Optional[float]
    context_precision: Optional[float]
    context_recall: Optional[float]
    composite_score: Optional[float]
    avg_latency_ms: int
    total_tokens: int
    raw_outputs: list = field(default_factory=list)
    error: Optional[str] = None


def _configure_ragas_llm():
    """
    Wire up RAGAS's internal LLM judge.
    RAGAS uses LangChain wrappers — pick the first available key.
    """
    from app.core.config import get_settings
    settings = get_settings()

    if settings.anthropic_api_key:
        from langchain_anthropic import ChatAnthropic
        from ragas.llms import LangchainLLMWrapper
        llm = ChatAnthropic(
            model="claude-haiku-4-5-20251001",  # fast + cheap for judging
            api_key=settings.anthropic_api_key,
        )
        return LangchainLLMWrapper(llm)

    if settings.openai_api_key:
        from langchain_openai import ChatOpenAI
        from ragas.llms import LangchainLLMWrapper
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.openai_api_key)
        return LangchainLLMWrapper(llm)

    raise RuntimeError(
        "No LLM API key found for RAGAS judge. "
        "Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your .env file."
    )


def _configure_ragas_embeddings():
    """Embeddings are needed for answer_relevancy."""
    from app.core.config import get_settings
    settings = get_settings()

    if settings.openai_api_key:
        from langchain_openai import OpenAIEmbeddings
        from ragas.embeddings import LangchainEmbeddingsWrapper
        return LangchainEmbeddingsWrapper(OpenAIEmbeddings(api_key=settings.openai_api_key))

    if settings.anthropic_api_key:
        # Anthropic has no embeddings API — fall back to a free HuggingFace model
        from langchain_community.embeddings import HuggingFaceEmbeddings
        from ragas.embeddings import LangchainEmbeddingsWrapper
        return LangchainEmbeddingsWrapper(
            HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        )

    raise RuntimeError("No embeddings provider available.")


async def _gather_answers(
    model: str, dataset: list[DatasetItem]
) -> tuple[list, list[str]]:
    """Call model on every dataset item concurrently (max 5 at a time)."""
    sem = asyncio.Semaphore(5)

    async def _call(item: DatasetItem) -> LLMResponse:
        async with sem:
            return await call_llm(model, item.question, item.contexts)

    responses = await asyncio.gather(*[_call(item) for item in dataset], return_exceptions=True)

    answers = []
    for r in responses:
        if isinstance(r, Exception):
            answers.append(f"[ERROR: {r}]")
        else:
            answers.append(r.answer)
    return responses, answers


def _compute_composite(scores: dict) -> float:
    """Average of non-None metric values."""
    values = [v for v in scores.values() if v is not None]
    return round(sum(values) / len(values), 4) if values else 0.0


def _run_ragas(hf_dataset: Dataset) -> dict:
    """Synchronous RAGAS evaluation - runs in a thread pool."""
    from app.core.config import get_settings
    settings = get_settings()

    ragas_llm = _configure_ragas_llm()

    # answer_relevancy requires embeddings - only include with a valid OpenAI key
    use_answer_relevancy = False
    ragas_embeddings = None
    openai_key = settings.openai_api_key or ""
    if openai_key and not openai_key.startswith("sk-...") and len(openai_key) > 20:
        try:
            ragas_embeddings = _configure_ragas_embeddings()
            use_answer_relevancy = True
        except Exception:
            pass

    metrics = [faithfulness, context_precision, context_recall]
    if use_answer_relevancy:
        metrics.append(answer_relevancy)

    for metric in metrics:
        metric.llm = ragas_llm
        if ragas_embeddings and hasattr(metric, "embeddings"):
            metric.embeddings = ragas_embeddings

    result = evaluate(hf_dataset, metrics=metrics)
    return result.to_pandas().mean(numeric_only=True).to_dict()

async def evaluate_model(model: str, dataset: list[DatasetItem]) -> EvalResult:
    """Run a full RAGAS evaluation for one model against the dataset."""
    try:
        responses, answers = await _gather_answers(model, dataset)

        # Build RAGAS Dataset
        hf_dataset = Dataset.from_dict({
            "question": [item.question for item in dataset],
            "answer": answers,
            "contexts": [item.contexts for item in dataset],
            "ground_truth": [item.ground_truth for item in dataset],
        })

        # Run scoring in thread pool (blocking)
        scores = await asyncio.to_thread(_run_ragas, hf_dataset)

        def _safe(key: str) -> Optional[float]:
            v = scores.get(key)
            return round(float(v), 4) if v is not None and str(v) != "nan" else None

        metric_scores = {
            "faithfulness": _safe("faithfulness"),
            "answer_relevancy": _safe("answer_relevancy"),
            "context_precision": _safe("context_precision"),
            "context_recall": _safe("context_recall"),
        }
        composite = _compute_composite(metric_scores)

        valid = [r for r in responses if isinstance(r, LLMResponse)]
        avg_latency = int(sum(r.latency_ms for r in valid) / len(valid)) if valid else 0
        total_tokens = sum(r.total_tokens for r in valid)

        return EvalResult(
            model_name=model,
            **metric_scores,
            composite_score=composite,
            avg_latency_ms=avg_latency,
            total_tokens=total_tokens,
            raw_outputs=[r.answer if isinstance(r, LLMResponse) else str(r) for r in responses],
        )

    except Exception as e:
        # Surface the full traceback so it appears in the API response
        full_error = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
        print(f"[RAGAS ERROR] {model}:\n{full_error}")
        return EvalResult(
            model_name=model,
            faithfulness=None,
            answer_relevancy=None,
            context_precision=None,
            context_recall=None,
            composite_score=None,
            avg_latency_ms=0,
            total_tokens=0,
            error=f"{type(e).__name__}: {e}",
        )


async def evaluate_all_models(
    models: list[str], dataset: list[DatasetItem]
) -> list[EvalResult]:
    """Evaluate all models concurrently (respects max_concurrent_evaluations)."""
    from app.core.config import get_settings
    settings = get_settings()
    sem = asyncio.Semaphore(settings.max_concurrent_evaluations)

    async def _guarded(model):
        async with sem:
            return await evaluate_model(model, dataset)

    return await asyncio.gather(*[_guarded(m) for m in models])