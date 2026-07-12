# Explanation service image — one of the three docker-compose processes (locked decision D7).
# Uses uv (never pip) for reproducible installs from the committed uv.lock.

FROM python:3.11-slim

# uv binary, pinned by copying from its published image (no curl-pipe-sh).
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /bin/

WORKDIR /app

# Install dependencies first (cached unless the manifests change), from the frozen lockfile.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Then the application code.
COPY app ./app

# Non-root for defense-in-depth.
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

# Bind all interfaces so the core container can reach it over the compose network.
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
