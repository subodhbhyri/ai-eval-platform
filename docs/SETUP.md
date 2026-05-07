# AI Evaluation Dashboard — Backend Setup

## Prerequisites
- Python 3.10+
- Docker Desktop (running)
- PyCharm Professional (recommended)

---

## 1. Start infrastructure (PostgreSQL + Redis)

```powershell
cd docker
docker compose -f docker-compose.dev.yml up -d
```

Verify:
```powershell
docker compose -f docker-compose.dev.yml ps
# Both services should show "healthy"
```

---

## 2. Create Python virtual environment

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

> In PyCharm: File → Settings → Project → Python Interpreter → Add → Existing → select `.venv\Scripts\python.exe`

---

## 3. Configure environment

```powershell
copy .env.example .env
```

Edit `.env` and add your API keys:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

You only need keys for the models you want to test. The app works with just one.

---

## 4. Run the server

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open: http://localhost:8000/docs

---

## 5. Run tests

```powershell
pytest tests/ -v
```

---

## 6. Try your first evaluation

POST to `http://localhost:8000/api/v1/evaluations/` with:

```json
{
  "name": "My first eval",
  "models": ["gpt-4o-mini"],
  "dataset": [
    {
      "question": "What causes rain?",
      "ground_truth": "Rain is caused by water vapor condensing into droplets in clouds.",
      "contexts": [
        "Precipitation occurs when water vapor in clouds condenses into water droplets heavy enough to fall."
      ]
    }
  ]
}
```

---

## Project structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app + lifespan
│   ├── core/
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   └── cache.py             # Redis helpers
│   ├── db/
│   │   └── session.py           # Async SQLAlchemy engine
│   ├── models/
│   │   └── evaluation.py        # ORM: EvaluationRun, ModelResult
│   ├── schemas/
│   │   └── evaluation.py        # Pydantic request/response models
│   ├── evaluation/
│   │   └── ragas_engine.py      # RAGAS scoring logic
│   ├── services/
│   │   ├── llm_clients.py       # OpenAI / Anthropic / Gemini wrappers
│   │   ├── kafka_producer.py    # Event streaming (no-op when disabled)
│   │   └── evaluation_service.py# Orchestration layer
│   └── api/routes/
│       └── evaluations.py       # REST endpoints
├── tests/
│   └── test_api.py
├── .env.example
├── requirements.txt
└── pytest.ini
```

---

## Next steps

1. **Add the React frontend** — `cd frontend && pnpm create vite . --template react-ts`
2. **Enable Kafka** — add Kafka to `docker-compose.dev.yml`, set `KAFKA_ENABLED=true`
3. **Add Prometheus/Grafana** — metrics are already exposed at `/metrics`
4. **Add async background runs** — use FastAPI `BackgroundTasks` for large datasets
