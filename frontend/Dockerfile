# React frontend image (locked decision: React 19 + TS + Vite + Tailwind).
#
# Layered deliberately so a code-only change (most commits) skips the slow dependency-install layer:
#   1. package.json + lockfile  -> changes rarely  -> `npm ci` layer (slow, cached)
#   2. src/ + everything else   -> changes often   -> `vite build` layer (fast, re-runs every change)

FROM node:22-alpine AS build
WORKDIR /build

# Dependency layer — invalidated only when package.json/package-lock.json change.
COPY package.json package-lock.json ./
RUN npm ci

# Source layer — invalidated on every code change; reuses the dependency layer above.
COPY . .

# Vite bakes VITE_* vars in at build time (not runtime), so the API origin for a non-local deploy
# (e.g. Railway) is a build arg, not an env var read by the running container. Defaults to the same
# localhost:8080 the frontend already falls back to (see src/api/client.ts).
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/dist /usr/share/nginx/html
EXPOSE 80
