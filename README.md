# LLM Eval Dashboard

A platform that benchmarks and evaluates LLM outputs across multiple models in real time, displays RAGAS metrics on a React dashboard, and exposes results via a REST API.

![Dashboard Screenshot](docs/screenshot.png)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│              React + TypeScript (Vite) on Vercel                │
│         Charts · Real-time polling · Run submission             │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP (REST)
┌────────────────────────▼────────────────────────────────────────┐
│                        API Layer                                 │
│                   FastAPI on Render                              │
│          /api/v1/evaluations  ·  /health  ·  /metrics           │
└──────┬─────────────────┬──────────────────┬─────────────────────┘
       │                 │                  │
┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────────────────────┐
│    Redis    │  │  Evaluation   │  │         Kafka                │
│   Cache     │  │   Pipeline    │  │   Event streaming            │
│  (Render)   │  │   (RAGAS)     │  │   (optional)                 │
└─────────────┘  └───────┬──────┘  └──────────────────────────────┘
                         │ concurrent calls
          ┌──────────────┼──────────────┐
    ┌─────▼─────┐  ┌─────▼─────┐  ┌────▼──────┐
    │  Anthropic │  │  OpenAI   │  │  Gemini   │
    │  Claude    │  │  GPT-4o   │  │  2.5 Flash│
    └─────────── ┘  └───────────┘  └───────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      PostgreSQL                                  │
│                    Supabase (prod)                               │
│           evaluation_runs · model_results                        │
└─────────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│               Prometheus + Grafana (optional)                    │
│                  Pipeline observability                          │
└─────────────────────────────────────────────────────────────────┘
```

## RAGAS Metrics

| Metric | Description |
|--------|-------------|
| **Faithfulness** | Does the answer stick to what the context says? |
| **Answer Relevancy** | Is the answer on-topic for the question? (requires OpenAI embeddings) |
| **Context Precision** | Is the most relevant context ranked first? |
| **Context Recall** | Does the answer cover everything in the ground truth? |
| **Composite Score** | Average of all available metrics |

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async) |
| Evaluation | RAGAS 0.1.9, LangChain |
| Database | PostgreSQL (Supabase in prod, Docker locally) |
| Cache | Redis |
| Streaming | Apache Kafka (optional) |
| Observability | Prometheus + Grafana |
| Deployment | Vercel (frontend), Render (backend), Supabase (DB) |

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker Desktop

### 1. Clone and set up backend

```bash
git clone https://github.com/your-username/ai-eval-platform.git
cd ai-eval-platform

# Start PostgreSQL + Redis
cd docker
docker compose -f docker-compose.dev.yml up -d

# Set up Python env
cd ../backend
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Mac/Linux

pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your API keys

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at `http://localhost:8000/docs`

### 2. Set up frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard available at `http://localhost:5173`

### 3. Run your first evaluation

POST to `http://localhost:8000/api/v1/evaluations/`:

```json
{
  "name": "My first eval",
  "models": ["claude-sonnet-4-5", "gpt-4o", "gemini-2.5-flash"],
  "dataset": [
    {
      "question": "What is photosynthesis?",
      "ground_truth": "Photosynthesis converts sunlight, water and CO2 into glucose and oxygen.",
      "contexts": ["Plants use sunlight, water, and CO2 to produce glucose and oxygen via photosynthesis."]
    }
  ]
}
```

## Deployment

### Supabase (Database)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database → Connection string**
3. Copy the **Session mode** URI (port 5432)
4. Replace `postgresql://` with `postgresql+asyncpg://`

### Render (Backend)

1. Push this repo to GitHub
2. New Web Service → connect repo → select **Docker** runtime
3. Set root directory to `.` (uses `render.yaml`)
4. Add environment variables in Render dashboard:
   - `DATABASE_URL` — Supabase connection string
   - `REDIS_URL` — Render Redis internal URL
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `GOOGLE_API_KEY`

### Vercel (Frontend)

1. Import repo at [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   - `VITE_API_URL` = `https://your-app.onrender.com/api/v1`
4. Deploy

### CORS

Once deployed, add your Vercel URL to the CORS origins in `backend/app/main.py`:

```python
allow_origins=[
    "http://localhost:5173",
    "https://your-app.vercel.app",  # add this
]
```

## Project Structure

```
ai-eval-platform/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # FastAPI route handlers
│   │   ├── core/            # Config, cache (Redis)
│   │   ├── db/              # SQLAlchemy session
│   │   ├── evaluation/      # RAGAS engine
│   │   ├── models/          # ORM models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # LLM clients, Kafka, orchestration
│   │   └── main.py          # App entrypoint
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client
│   │   ├── components/      # Charts, UI components
│   │   ├── hooks/           # Data fetching hooks
│   │   ├── pages/           # Dashboard, run detail
│   │   └── types/           # TypeScript types
│   └── vercel.json
├── docker/
│   └── docker-compose.dev.yml
├── docs/
│   └── SETUP.md
└── render.yaml
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/evaluations/` | Submit a new evaluation run |
| `GET` | `/api/v1/evaluations/` | List all runs |
| `GET` | `/api/v1/evaluations/{id}` | Get run with results |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/docs` | Swagger UI |

## Supported Models

| Provider | Models |
|----------|--------|
| Anthropic | `claude-sonnet-4-5`, `claude-opus-4-6`, any `claude-*` |
| OpenAI | `gpt-4o`, `gpt-4o-mini`, any `gpt-*` or `o1-*` |
| Google | `gemini-2.5-flash`, `gemini-2.5-pro`, any `gemini-*` |
