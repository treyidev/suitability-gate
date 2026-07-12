#!/usr/bin/env bash
# SuitabilityGate — shared shell helpers for scripts/launch.sh and scripts/launch_docker.sh.
#
# WHY a sourced file rather than duplicating this in both scripts: the two launchers share
# presentation (colors, step/ok/fail logging) and process-lifecycle logic (port checks, killing by
# port, waiting for an HTTP health check). Copy-pasting that between two files means a fix to one
# silently doesn't reach the other; sourcing keeps them a single source of truth.
#
# Not meant to be run directly — `source` this from an entry script after it has set
# READINESS_TIMEOUT_SECONDS / READINESS_POLL_INTERVAL_SECONDS / HEARTBEAT_EVERY_SECONDS, or accept
# the defaults below.
: "${READINESS_TIMEOUT_SECONDS:=90}"
: "${READINESS_POLL_INTERVAL_SECONDS:=1}"
: "${HEARTBEAT_EVERY_SECONDS:=5}"

# ── Colors — real terminal only. Piped/redirected output (e.g. into a log file) stays plain, and
# NO_COLOR is honoured. Palette reuses the project's own locked brand tokens (D17: primary teal
# #00836C, accent orange #F58220) rather than inventing new ones. ──────────────────────────────
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
    TEAL=$'\033[38;2;0;131;108m'
    ORANGE=$'\033[38;2;245;130;32m'
    GREEN=$'\033[0;32m'
    RED=$'\033[0;31m'
    YELLOW=$'\033[0;33m'
    DIM=$'\033[2m'
    BOLD=$'\033[1m'
    RESET=$'\033[0m'
else
    TEAL=""; ORANGE=""; GREEN=""; RED=""; YELLOW=""; DIM=""; BOLD=""; RESET=""
fi

step()  { printf '\n%s%s▶ %s%s\n' "$BOLD" "$TEAL" "$1" "$RESET"; }
info()  { printf '  %s%s\n' "$DIM" "$1$RESET"; }
ok()    { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
warn()  { printf '  %s!%s %s\n' "$YELLOW" "$RESET" "$1"; }
fail()  { printf '  %s✗ ERROR:%s %s\n' "$RED$BOLD" "$RESET" "$1" >&2; exit 1; }

banner() {
    local subtitle="$1"
    printf '\n%s%s' "$TEAL" "$BOLD"
    printf '   ┌─────────────────────────────────────┐\n'
    printf '   │  SuitabilityGate — %-18s│\n' "$subtitle"
    printf '   └─────────────────────────────────────┘\n'
    printf '%s\n' "$RESET"
}

port_in_use() {
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

pid_on_port() {
    lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

kill_by_port() {
    local port="$1" pid
    pid="$(pid_on_port "$port")"
    if [[ -n "$pid" ]]; then
        kill "$pid" 2>/dev/null || true
    fi
}

# Poll a URL until it answers (any HTTP response, even an error status, counts as "reachable").
# If pid_to_watch is non-empty, a dead process fails fast instead of waiting out the full timeout.
wait_for_http() {
    local url="$1" pid_to_watch="$2" what="$3" elapsed=0
    until curl -s -o /dev/null "$url"; do
        if [[ -n "$pid_to_watch" ]] && ! kill -0 "$pid_to_watch" 2>/dev/null; then
            fail "$what exited before becoming ready — see its log for the real error."
        fi
        sleep "$READINESS_POLL_INTERVAL_SECONDS"
        elapsed=$((elapsed + READINESS_POLL_INTERVAL_SECONDS))
        if [[ "$elapsed" -ge "$READINESS_TIMEOUT_SECONDS" ]]; then
            fail "$what did not become ready within ${READINESS_TIMEOUT_SECONDS}s."
        fi
        if (( elapsed % HEARTBEAT_EVERY_SECONDS == 0 )); then
            info "… still waiting on $what (${elapsed}s)"
        fi
    done
    ok "$what ready (${elapsed}s)"
}

# Start a local process in the background, wait for it to answer on its health path, and stash its
# PID into the caller-named variable ($1). Must run directly in the entry script's shell (NOT via
# command substitution / `$(...)`) — backgrounding inside a command-substitution subshell would
# make the child a grandchild the top-level `wait` builtin can't see, breaking Ctrl+C/--stop.
start_local_service() {
    local __outvar="$1" what="$2" port="$3" health_path="$4" workdir="$5" log="$6"
    shift 6
    info "log: $log"
    ( cd "$workdir" && exec "$@" ) >"$log" 2>&1 &
    printf -v "$__outvar" '%s' "$!"
    wait_for_http "http://localhost:$port$health_path" "${!__outvar}" "$what"
}
