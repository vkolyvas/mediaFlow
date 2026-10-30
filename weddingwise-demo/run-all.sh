#!/usr/bin/env bash
# WeddingWise demo factory - full end-to-end run.
#
#   ./run-all.sh              # capture + narrate + render every project
#   ./run-all.sh capture      # re-shoot all footage
#   ./run-all.sh tts          # re-narrate (cached: only changed lines re-synthesise)
#   ./run-all.sh render       # re-render from the existing storyboards
#   ./run-all.sh render-vars  # render the overview's vertical / GIF / stems variants
#
# Projects are named <app>-<topic>-<YYYY-MM-DD-HHMM>; retakes reuse the same
# folder, which keeps the TTS cache warm.

set -euo pipefail

WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ultrademo"
APP_REPO="${APP_REPO:-/home/onchaine3r/auth-weddingwise}"

PROJECTS=(
  weddingwise-public-2026-10-30
  weddingwise-overview-2026-10-30
  weddingwise-couples-2026-10-30
  weddingwise-vendors-2026-10-30
  weddingwise-planners-2026-10-30
)

STAGE="${1:-all}"

cd "$WORKSPACE"

# 0. The demo seed is the source of truth for the footage. Re-running it is
#    idempotent, so it is safe to replay before every capture.
seed_demo_data() {
  echo "== seeding demo accounts =="
  for s in screenshot-auth.js screenshot-auth-vendor.js screenshot-auth-planner.js; do
    (cd "$APP_REPO" && node "tests/e2e/$s")
  done
}

run_capture() {
  for p in "${PROJECTS[@]}"; do
    echo "== capture $p =="
    npm run capture -- "$p"
  done
}

run_tts() {
  for p in "${PROJECTS[@]}"; do
    echo "== tts $p =="
    npm run tts -- "$p"
  done
}

run_render() {
  for p in "${PROJECTS[@]}"; do
    echo "== render $p =="
    npm run render -- "$p"
  done
}

run_render_variants() {
  p="${PROJECTS[1]}" # overview
  npm run render -- "$p" --vertical
  npm run render -- "$p" --gif
  npm run render -- "$p" --stems
}

case "$STAGE" in
  capture)     seed_demo_data; run_capture ;;
  tts)         run_tts ;;
  render)      run_render ;;
  render-vars) run_render_variants ;;
  all)         seed_demo_data; run_capture; run_tts; run_render ;;
  *) echo "usage: $0 [all|capture|tts|render|render-vars]"; exit 1 ;;
esac

echo
echo "== outputs =="
for p in "${PROJECTS[@]}"; do
  find "projects/$p/out" -name '*.mp4' -o -name '*.gif' 2>/dev/null | while read -r f; do
    printf '%-72s %s\n' "$f" "$(du -h "$f" | cut -f1)"
  done
done
