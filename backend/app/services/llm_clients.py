import time
import asyncio
from typing import Optional
from dataclasses import dataclass
from app.core.config import get_settings

settings = get_settings()


@dataclass
class LLMResponse:
    answer: str
    latency_ms: int
    total_tokens: int
    model_name: str


# Map of model ID prefix -> provider
MODEL_PROVIDERS = {
    "gpt": "openai",
    "o1": "openai",
    "o3": "openai",
    "claude": "anthropic",
    "gemini": "google",
}


def get_provider(model_name: str) -> str:
    for prefix, provider in MODEL_PROVIDERS.items():
        if model_name.lower().startswith(prefix):
            return provider
    raise ValueError(f"Unknown model provider for: {model_name}")


async def call_openai(model: str, question: str, context: str) -> LLMResponse:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    prompt = f"Context:\n{context}\n\nQuestion: {question}\nAnswer concisely based only on the context."
    start = time.monotonic()
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    latency_ms = int((time.monotonic() - start) * 1000)
    return LLMResponse(
        answer=response.choices[0].message.content,
        latency_ms=latency_ms,
        total_tokens=response.usage.total_tokens,
        model_name=model,
    )


async def call_anthropic(model: str, question: str, context: str) -> LLMResponse:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    prompt = f"Context:\n{context}\n\nQuestion: {question}\nAnswer concisely based only on the context."
    start = time.monotonic()
    response = await client.messages.create(
        model=model,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    latency_ms = int((time.monotonic() - start) * 1000)
    return LLMResponse(
        answer=response.content[0].text,
        latency_ms=latency_ms,
        total_tokens=response.usage.input_tokens + response.usage.output_tokens,
        model_name=model,
    )


async def call_gemini(model: str, question: str, context: str) -> LLMResponse:
    import google.generativeai as genai
    genai.configure(api_key=settings.google_api_key)
    gemini = genai.GenerativeModel(model)

    prompt = f"Context:\n{context}\n\nQuestion: {question}\nAnswer concisely based only on the context."
    start = time.monotonic()
    response = await asyncio.to_thread(gemini.generate_content, prompt)
    latency_ms = int((time.monotonic() - start) * 1000)
    return LLMResponse(
        answer=response.text,
        latency_ms=latency_ms,
        total_tokens=0,  # Gemini doesn't always return token counts
        model_name=model,
    )


async def call_llm(model: str, question: str, contexts: list[str]) -> LLMResponse:
    """Unified entry point — routes to the right provider."""
    context_str = "\n\n".join(contexts)
    provider = get_provider(model)
    if provider == "openai":
        return await call_openai(model, question, context_str)
    elif provider == "anthropic":
        return await call_anthropic(model, question, context_str)
    elif provider == "google":
        return await call_gemini(model, question, context_str)
    else:
        raise ValueError(f"Unsupported provider: {provider}")
