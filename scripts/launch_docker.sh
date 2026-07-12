#!/usr/bin/env bash
# SuitabilityGate — docker-based launcher.
#
# The containerized alternative to scripts/launch.sh's local `uv run` explanation-service. Scoped
# honestly to what's actually dockerized today: only the explanation-service has a Dockerfile —
# the Java core and React frontend don't yet (that's the still-pending "Day-3 delivery spine" work
# tracked in .claude/SESSION.md). This is the natural place to extend once they do, at which point
# this script's default action becomes `docker compose up -d` for all three.
#
# docker manages the container's lifecycle independently of this script — unlike launch.sh, there
# is nothing running in this script's own process tree to `wait` on or reap on Ctrl+C. Run this,
# it brings the container up (or confirms it's already healthy) and exits; the container keeps
# running until you --stop it or `docker compose down` yourself.
#
# Usage: scripts/launch_docker.sh [--stop]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

EXPLANATION_PORT=11111
READINESS_TIMEOUT_SECONDS=90
READINESS_POLL_INTERVAL_SECONDS=1
HEARTBEAT_EVERY_SECONDS=5

# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

usage() {
    cat <<USAGE
Usage: $(basename "$0") [--stop]

  (no args)   Start explanation-service via docker compose (idempotent — a no-op if it's
              already up and healthy).
  --stop      docker compose down explanation-service.
USAGE
}

case "${1:-}" in
    --stop)
        step "Stopping explanation-service (docker)"
        ( cd "$REPO_ROOT" && docker compose down explanation-service )
        ok "stopped"
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

banner "docker"

step "Preflight"
command -v docker >/dev/null 2>&1 || fail "docker not found."
ok "docker available"

step "Explanation service (docker compose)"
( cd "$REPO_ROOT" && docker compose up -d explanation-service ) | sed "s/^/  ${DIM}/;s/\$/${RESET}/"
wait_for_http "http://localhost:$EXPLANATION_PORT/health" "" "explanation-service"

printf '\n%s%s' "$GREEN" "$BOLD"
printf '  ────────────────────────────────────────────────────────────────────\n'
printf '   explanation-service is up (docker).\n'
printf '  ────────────────────────────────────────────────────────────────────%s\n\n' "$RESET"
printf '  %sExplanation service%s    %shttp://localhost:%s%s\n\n' \
    "$BOLD" "$RESET" "$ORANGE" "$EXPLANATION_PORT" "$RESET"
printf '  Running in docker independently of this shell — %s%s --stop%s or\n' "$BOLD" "$0" "$RESET"
printf '  %sdocker compose down explanation-service%s to stop it.\n\n' "$DIM" "$RESET"
