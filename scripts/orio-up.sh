#!/usr/bin/env bash
# Start OrioSearch (SearXNG + Redis + API on :8000). Requires Docker Desktop / docker compose.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ORIO="$ROOT/orio-search"
REPO_URL="https://github.com/vkfolio/orio-search.git"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Install Docker Desktop, then run: npm run orio"
  exit 1
fi

if [ ! -f "$ORIO/docker-compose.yml" ]; then
  echo "Cloning OrioSearch into $ORIO ..."
  git clone --depth 1 "$REPO_URL" "$ORIO"
fi

cd "$ORIO"
echo "Building and starting OrioSearch (API http://localhost:8000) ..."
docker compose up -d --build

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://localhost:8000/health" >/dev/null; then
    echo "OK: $(curl -sf http://localhost:8000/health)"
    exit 0
  fi
  sleep 2
done

echo "Containers started but /health did not respond yet. Check: docker compose -f $ORIO/docker-compose.yml logs -f api"
exit 0
