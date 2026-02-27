#!/bin/bash
# Konstruq Ralph Loop
# Model rules:
#   Primary: anthropic/claude-opus-4-6:xhigh
#   Fallback: google-antigravity/claude-opus-4-6-thinking
#   Coding: codex CLI (gpt-5.3-codex-xhigh) — delegated by pi
#   Testing: agent-browser — used by pi
cd /home/ubuntu/konstruq

MAX_ITERATIONS=${1:-15}
PRD_FILE="./prd.json"
PROMPT_TEMPLATE="/home/ubuntu/konstruq/scripts/prompt.md"

command -v pi >/dev/null || { echo "pi not found"; exit 1; }
command -v jq >/dev/null || { echo "jq not found"; exit 1; }
[ -f "$PRD_FILE" ] || { echo "prd.json not found"; exit 1; }

BRANCH=$(jq -r '.branchName' "$PRD_FILE")
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "$BRANCH" ]; then
  git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
fi

echo "╔═══════════════════════════════════════════════════════╗"
echo "║           🏗️  Konstruq Ralph Loop Started             ║"
echo "╚═══════════════════════════════════════════════════════╝"

PRIMARY_MODEL="anthropic/claude-opus-4-6:xhigh"
FALLBACK_MODEL="google-antigravity/claude-opus-4-6-thinking"

for i in $(seq 1 $MAX_ITERATIONS); do
  TOTAL=$(jq '.userStories | length' "$PRD_FILE")
  DONE=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE")
  REMAINING=$((TOTAL - DONE))

  if [ "$REMAINING" -eq 0 ]; then
    echo ""; echo "✅ All $TOTAL stories complete at iteration $i!"
    exit 0
  fi

  NEXT=$(jq -r '[.userStories[] | select(.passes == false)] | sort_by(.priority) | .[0] | "\(.id): \(.title)"' "$PRD_FILE")

  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  🔄 Iteration $i/$MAX_ITERATIONS — $DONE/$TOTAL done, $REMAINING remaining"
  echo "  📋 Next: $NEXT"
  echo "  ⏰ $(date '+%H:%M:%S')"
  echo "  🤖 Model: $PRIMARY_MODEL"
  echo "═══════════════════════════════════════════════════════"

  ITER_LOG="/tmp/ralph-iter-$i.log"

  # Primary model
  timeout 900 pi -m "$PRIMARY_MODEL" --print < "$PROMPT_TEMPLATE" > "$ITER_LOG" 2>&1
  EXIT_CODE=$?

  if [ $EXIT_CODE -ne 0 ]; then
    echo "  ⚠️ Primary model failed (exit $EXIT_CODE). Trying fallback: $FALLBACK_MODEL"
    timeout 900 pi -m "$FALLBACK_MODEL" --print < "$PROMPT_TEMPLATE" > "$ITER_LOG" 2>&1
    EXIT_CODE=$?

    if [ $EXIT_CODE -ne 0 ]; then
      echo "  ❌ Both models failed at iteration $i. Exit code: $EXIT_CODE"
      echo "  Last 20 lines of log:"
      tail -20 "$ITER_LOG" 2>/dev/null
      exit 1
    fi
  fi

  echo "  --- Iteration $i result (last 20 lines) ---"
  tail -20 "$ITER_LOG"

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

echo ""; echo "⚠️ Max iterations ($MAX_ITERATIONS) reached."
DONE_FINAL=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE")
echo "Status: $DONE_FINAL/$TOTAL stories complete"
jq -r '.userStories[] | "\(.id): \(.title) — \(if .passes then "✅" else "❌" end)"' "$PRD_FILE"
exit 1
