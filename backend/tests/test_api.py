"""
Basic smoke tests — run with: pytest tests/ -v
Requires a running PostgreSQL + Redis (use docker-compose.dev.yml).
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture(scope="module")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_list_evaluations_empty(client):
    r = await client.get("/api/v1/evaluations/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_create_evaluation_invalid_payload(client):
    r = await client.post("/api/v1/evaluations/", json={})
    assert r.status_code == 422  # validation error


@pytest.mark.asyncio
async def test_get_nonexistent_run(client):
    r = await client.get("/api/v1/evaluations/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
