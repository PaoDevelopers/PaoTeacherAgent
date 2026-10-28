#!/usr/bin/env bash
# Wraps docker compose with the upstream Lite stack + our overlay. Usage: deploy/compose.sh up -d
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DC="$ROOT/deployment/docker_compose"
EXTRA=()
[[ "${PAO_ENV:-local}" == prod ]] && EXTRA=(-f "$ROOT/deploy/docker-compose.prod.yml")
exec docker compose \
  -f "$DC/docker-compose.yml" \
  -f "$DC/docker-compose.onyx-lite.yml" \
  -f "$ROOT/deploy/docker-compose.override.yml" \
  ${EXTRA[@]+"${EXTRA[@]}"} \
  --env-file "$ROOT/deploy/.env" \
  "$@"
