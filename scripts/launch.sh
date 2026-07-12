#!/usr/bin/env bash
# SuitabilityGate — local dev launcher (fully local, no docker).
#
# Brings up all three Phase-1 processes as plain local processes, in dependency order: the
# explanation-service (`uv run` — the async LLM-in-a-box seam, D3/D7), the Java core (Spring Boot,
# H2-backed by default per locked decision D8), and the frontend (Vite dev server). Waits for each
# to become reachable before starting the next, so a broken core never leaves the frontend pointed
# at nothing.
#
# For the docker-based alternative (currently just the explanation-service — core/frontend have no
# Dockerfile yet), see scripts/launch_docker.sh.
#
# Cleanup targets the PID actually bound to each port, not the launcher's own child PID — Maven's
# spring-boot:run and the mvnw wrapper both fork intermediate processes, so killing only the
# immediate child can leave the real JVM orphaned on the port (this bit us once already this
# project). Ctrl+C, exit, or `--stop` all reap by port, so nothing is left running for next time.
#
# Usage: scripts/launch.sh [--stop]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

CORE_PORT=8080
FRONTEND_PORT=5173
# Deliberately off the well-trodden 8000/8080/8888/9000 dev ports (matches docker-compose.yml /
# application.properties defaults) to avoid clashing with whatever else is running locally.
EXPLANATION_PORT=11111
READINESS_TIMEOUT_SECONDS=90
READINESS_POLL_INTERVAL_SECONDS=1
HEARTBEAT_EVERY_SECONDS=5

CORE_LOG="$LOG_DIR/core.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
EXPLANATION_LOG="$LOG_DIR/explanation.log"

CORE_PID=""
FRONTEND_PID=""
EXPLANATION_PID=""

# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

usage() {
    cat <<USAGE
Usage: $(basename "$0") [--stop]

  (no args)   Start explanation-service, core, and frontend — all as local processes.
  --stop      Stop all three (by port).
USAGE
}

# ── --stop / --help run BEFORE the launch-mode cleanup trap is registered, so they do their own
# explicit teardown once and exit — no double "shutting down" from an EXIT trap firing after. ──
case "${1:-}" in
    --stop)
        step "Stopping SuitabilityGate"
        for entry in "core:$CORE_PORT" "frontend:$FRONTEND_PORT" "explanation-service:$EXPLANATION_PORT"; do
            name="${entry%%:*}"; port="${entry##*:}"
            if [[ -n "$(pid_on_port "$port")" ]]; then
                kill_by_port "$port"
                ok "$name stopped (was on :$port)"
            else
                info "$name was not running on :$port"
            fi
        done
        printf '\n'
        exit 0
        ;;
    -h|--help)
        usage
        exit 0
        ;;
    "")
        ;; # normal launch path, falls through below
    *)
        usage >&2
        fail "unknown option: $1"
        ;;
esac

cleanup() {
    step "Shutting down"
    kill_by_port "$FRONTEND_PORT"
    kill_by_port "$CORE_PORT"
    kill_by_port "$EXPLANATION_PORT"
}
trap cleanup EXIT INT TERM

banner "dev (local)"

# ── Preflight ──────────────────────────────────────────────────────────────────────────────────
step "Preflight"

command -v uv >/dev/null 2>&1 || fail "uv not found — needed for the explanation-service (see explanation-service/pyproject.toml)."
ok "uv available"

command -v npm >/dev/null 2>&1 || fail "npm not found — needed for the frontend."
ok "npm available"

JAVA_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null)" \
    || fail "Java 21 not found (checked via /usr/libexec/java_home -v 21)."
export JAVA_HOME
ok "Java 21 found ($JAVA_HOME)"

for entry in "$CORE_PORT" "$FRONTEND_PORT" "$EXPLANATION_PORT"; do
    if port_in_use "$entry"; then
        fail "Port $entry is already in use — stop whatever is running there first, or run: $(basename "$0") --stop"
    fi
done
ok "ports $CORE_PORT, $FRONTEND_PORT, $EXPLANATION_PORT all free"

# ── 1) Explanation service (uv run, local) ─────────────────────────────────────────────────────
step "1/3 · Explanation service (uv run)"
start_local_service EXPLANATION_PID "explanation-service" "$EXPLANATION_PORT" "/health" \
    "$REPO_ROOT/explanation-service" "$EXPLANATION_LOG" \
    uv run uvicorn app.main:app --host 127.0.0.1 --port "$EXPLANATION_PORT"

# ── 2) Java core (H2-backed by default; offline Maven) ────────────────────────────────────────
step "2/3 · Core (Spring Boot, H2-backed)"
start_local_service CORE_PID "core" "$CORE_PORT" "/auth/login" \
    "$REPO_ROOT/core" "$CORE_LOG" \
    ./mvnw -o spring-boot:run

# ── 3) Frontend (Vite dev server, pinned to :5173) ─────────────────────────────────────────────
step "3/3 · Frontend (Vite)"
start_local_service FRONTEND_PID "frontend" "$FRONTEND_PORT" "/" \
    "$REPO_ROOT/frontend" "$FRONTEND_LOG" \
    npm run dev

printf '\n%s%s' "$GREEN" "$BOLD"
printf '  ────────────────────────────────────────────────────────────────────\n'
printf '   SuitabilityGate is up (all local — no docker).\n'
printf '  ────────────────────────────────────────────────────────────────────%s\n\n' "$RESET"

printf '  %sRM Workbench · Compliance · Customer portal%s   %s%shttp://localhost:%s%s\n' \
    "$BOLD" "$RESET" "$ORANGE" "$BOLD" "$FRONTEND_PORT" "$RESET"
printf '    %srm.demo%s / password   ·   %ssupervisor.demo%s / password   ·   %scustomer.demo%s / password\n' \
    "$TEAL" "$RESET" "$TEAL" "$RESET" "$TEAL" "$RESET"
printf '\n'
printf '  %sAPI%s                    %shttp://localhost:%s%s\n' \
    "$BOLD" "$RESET" "$ORANGE" "$CORE_PORT" "$RESET"
printf '  %sExplanation service%s    %shttp://localhost:%s%s\n' \
    "$BOLD" "$RESET" "$ORANGE" "$EXPLANATION_PORT" "$RESET"
printf '\n'
printf '  %sLogs%s   %s\n' "$DIM" "$RESET" "$CORE_LOG"
printf '          %s\n' "$FRONTEND_LOG"
printf '          %s\n' "$EXPLANATION_LOG"
printf '\n'
printf '  %sCtrl+C%s or %s%s --stop%s stops all three.\n\n' "$BOLD" "$RESET" "$0" "$BOLD" "$RESET"

wait "$CORE_PID" "$FRONTEND_PID" "$EXPLANATION_PID"
