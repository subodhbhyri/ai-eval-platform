"""
In-process pub/sub hub: Kafka consumer writes here, SSE endpoints read from here.
Each SSE connection gets its own asyncio.Queue so events are broadcast to all clients.
"""
import asyncio
from typing import Set

_subscribers: Set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=200)
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _subscribers.discard(q)


async def publish(event: dict) -> None:
    for q in list(_subscribers):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass  # slow consumer — drop rather than block the producer
