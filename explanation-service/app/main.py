"""FastAPI application for the stub explanation service.

Exposes two endpoints: ``POST /explain`` (render a canned explanation for a frozen decision) and
``GET /health`` (liveness for the docker-compose healthcheck). The app is stateless — all persistence
lives in the Java core; this process only turns decision facts into prose.

Where it fits: the Java core's async explanation handler is the sole caller (the one Java→Python
call). This module wires HTTP to the pure :func:`canned_explanations.compose_explanation`; the routing
layer stays thin so the composition logic is unit-testable without a server.
"""

from __future__ import annotations

import asyncio
import logging
import os

from fastapi import FastAPI

from app.canned_explanations import PROVIDER, compose_explanation
from app.schemas import ExplainRequest, ExplainResponse

logger = logging.getLogger("explanation-service")

# Simulated generation latency (ms). A real LLM takes time; adding a small, configurable delay makes
# the core's async "pending → attached" transition observable in the UI instead of resolving before the
# first poll. Set to 0 to disable. This is a demo aid, not load-bearing behaviour.
_DELAY_MS = int(os.getenv("EXPLANATION_DELAY_MS", "500"))

app = FastAPI(
    title="SuitabilityGate Explanation Service",
    description="Phase-1 stub: renders canned plain-language explanations for frozen decisions.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe for the container healthcheck.

    Returns:
        A fixed ``{"status": "ok"}`` payload; presence of a 200 is the signal.
    """
    return {"status": "ok"}


@app.post("/explain", response_model=ExplainResponse)
async def explain(request: ExplainRequest) -> ExplainResponse:
    """Render the canned explanation for a decision.

    Side effect: sleeps ``EXPLANATION_DELAY_MS`` to simulate model latency (see module note). The
    handler is async so this wait never blocks the event loop.

    Args:
        request: The decision facts (verdict + failed rule ids). PII-free by contract.

    Returns:
        The provider id and the explanation prose.
    """
    if _DELAY_MS > 0:
        await asyncio.sleep(_DELAY_MS / 1000)

    text = compose_explanation(request.verdict, request.failed_rules)
    logger.info(
        "Explained %s verdict=%s failedRules=%d",
        request.certificate_number,
        request.verdict,
        len(request.failed_rules),
    )
    return ExplainResponse(provider=PROVIDER, explanation_text=text)
