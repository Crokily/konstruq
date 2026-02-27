#!/bin/bash
# Konstruq Ralph Loop — Custom runner
# Model rules:
#   Planning/orchestration: claude-opus-4-6 • xhigh (fallback: claude-opus-4-6-thinking [google-antigravity] high)
#   Coding: delegated to codex CLI inside pi session (gpt-5.3-codex • xhigh)
#   Testing: agent-browser E2E inside pi session
#   Notifications: discord-agent with gemini-3-flash (background, non-blocking)
set -e

cd /home/ubuntu/konstruq

MAX_ITERATIONS=${1:-15}
PRD_FILE="./prd.json"
PROGRESS_FILE="./progress.txt"
PROMPT_TEMPLATE="/home/ubuntu/konstruq/scripts/prompt.md"

command -v pi >/dev/null || { echo "pi not found"; exit 1; }
command -v jq >/dev/null || { echo "jq not found"; exit 1; }
[ -f "$PRD_FILE" ] || { echo "prd.json not found"; exit 1; }

# Create branch
BRANCH=$(jq -r '.branchName' "$PRD_FILE")
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "$BRANCH" ]; then
  git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
fi

echo "╔═══════════════════════════════════════════════════════╗"
echo "║           🏗️  Konstruq Ralph Loop Started             ║"
echo "╚═══════════════════════════════════════════════════════╝"

for i in $(seq 1 $MAX_ITERATIONS); do
  TOTAL=$(jq '.userStories | length' "$PRD_FILE")
  DONE=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE")
  REMAINING=$((TOTAL - DONE))

  if [ "$REMAINING" -eq 0 ]; then
    echo ""
    echo "✅ All $TOTAL stories complete at iteration $i!"
    exit 0
  fi

  NEXT=$(jq -r '[.userStories[] | select(.passes == false)] | sort_by(.priority) | .[0] | "\(.id): \(.title)"' "$PRD_FILE")

  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  🔄 Iteration $i/$MAX_ITERATIONS — $DONE/$TOTAL done, $REMAINING remaining"
  echo "  📋 Next: $NEXT"
  echo "  ⏰ $(date '+%H:%M:%S')"
  echo "═══════════════════════════════════════════════════════"

  ITER_LOG="/tmp/ralph-iter-$i.log"

  # Primary model: claude-opus-4-6 xhigh
  pi -m "claude-opus-4-6 • xhigh" --print < "$PROMPT_TEMPLATE" > "$ITER_LOG" 2>&1
  EXIT_CODE=$?

  if [ $EXIT_CODE -ne 0 ]; then
    echo "  ⚠️ Primary model failed (exit $EXIT_CODE). Trying fallback..."
    pi -m "claude-opus-4-6-thinking [google-antigravity] high" --print < "$PROMPT_TEMPLATE" > "$ITER_LOG" 2>&1
    EXIT_CODE=$?

    if [ $EXIT_CODE -ne 0 ]; then
      echo "  ❌ Both models failed. Stopping."
      echo "  Last log: $ITER_LOG"
      tail -20 "$ITER_LOG"
      exit 1
    fi
  fi

  # Show result summary
  echo "  --- Iteration $i result (last 15 lines) ---"
  tail -15 "$ITER_LOG"

  # Check completion
  if grep -q "<promise>COMPLETE</promise>" "$ITER_LOG"; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║  ✅ All stories COMPLETE at iteration $i!             ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    exit 0
  fi

  echo "  ✓ Iteration $i done. Next in 3s..."
  sleep 3
done

echo ""
echo "⚠️ Max iterations ($MAX_ITERATIONS) reached."
DONE_FINAL=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE")
echo "Status: $DONE_FINAL/$TOTAL stories complete"
jq -r '.userStories[] | "\(.id): \(.title) — \(if .passes then "✅" else "❌" end)"' "$PRD_FILE"
exit 1
