# Java Modulith core image (locked decision D1/D8). Build context is the REPO ROOT (not core/) so
# this stage can also bake in the versioned ruleset from ../ruleset — see .dockerignore at the root.
#
# Layered deliberately so a code-only change (most commits) only re-runs the fast "source" layer, not
# the slow dependency-download layer:
#   1. wrapper + pom.xml        -> changes rarely  -> `dependency:go-offline` layer (slow, cached)
#   2. src/                     -> changes often   -> `package` layer (fast, re-runs every code change)
#   3. ruleset/ + jar copy      -> runtime stage, independent of the build stage's cache

FROM azul/zulu-openjdk:21 AS build
WORKDIR /build

COPY core/.mvn/ .mvn/
COPY core/mvnw ./
RUN chmod +x mvnw

# Dependency layer — invalidated only when pom.xml or the wrapper changes.
COPY core/pom.xml ./
RUN ./mvnw -B -q dependency:go-offline

# Source layer — invalidated on every code change; reuses the dependency layer above.
COPY core/src ./src
RUN ./mvnw -B -q clean package -DskipTests

FROM azul/zulu-openjdk:21-jre
WORKDIR /app

RUN useradd --create-home appuser

# Versioned ruleset baked into the image (locked decision D13 — thresholds live here, never in code,
# and the ruleset version is stamped into every DecisionRecord). Immutable image, not a host mount.
COPY --chown=appuser:appuser ruleset/ ./ruleset/
COPY --chown=appuser:appuser --from=build /build/target/*.jar app.jar

# Pre-create the H2 data directory with correct ownership so a fresh named volume mounted here
# (docker-compose.yml) inherits appuser ownership instead of defaulting to root.
RUN mkdir -p /app/data && chown appuser:appuser /app/data

USER appuser

ENV RULESET_PATH=/app/ruleset/ruleset-2026.07.1.yaml
EXPOSE 8080

# No Actuator in Phase 1 (scope: brief §18) — a bare TCP check on the app port is enough to prove
# the JVM is up and accepting connections; Phase 2 can swap this for a real /actuator/health.
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
  CMD bash -c 'echo > /dev/tcp/127.0.0.1/8080' || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
