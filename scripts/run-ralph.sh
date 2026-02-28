#!/bin/bash
# Konstruq Ralph Loop — Phase 2: AI Chat
cd /home/ubuntu/konstruq

MAX_ITERATIONS=${1:-15}
PRD_FILE="./prd.json"
PROMPT_TEMPLATE="/home/ubuntu/konstruq/scripts/prompt.md"

BRANCH=$(jq -r '.branchName' "$PRD_FILE")
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "$BRANCH" ]; then
  git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
fi

echo "╔═══════════════════════════════════════════════════════╗"
echo "║      🏗️  Konstruq Phase 2 Ralph Loop                  ║"
echo "╚═══════════════════════════════════════════════════════╝"

PRIMARY_MODEL="anthropic/claude-opus-4-6:xhigh"

for i in $(seq 1 $MAX_ITERATIONS); do
  TOTAL=$(jq '.userStories | length' "$PRD_FILE")
  DONE=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE")
  REMAINING=$((TOTAL - DONE))

  if [ "$REMAINING" -eq 0 ]; then
    echo "✅ All $TOTAL stories complete!"
    exit 0
  fi

  NEXT=$(jq -r '[.userStories[] | select(.passes == false)] | sort_by(.priority) | .[0] | "\(.id): \(.title)"' "$PRD_FILE")

  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  🔄 Iteration $i/$MAX_ITERATIONS — $DONE/$TOTAL done"
  echo "  📋 Next: $NEXT"
  echo "  ⏰ $(date '+%Y-%m-%d %H:%M:%S')"
  echo "═══════════════════════════════════════════════════════"

  ITER_LOG="/tmp/ralph-phase2-iter-$i-$(date +%s).log"

  # Run pi with prompt from stdin, capture all output
  cat "$PROMPT_TEMPLATE" | timeout 1200 pi -m "$PRIMARY_MODEL" --print > "$ITER_LOG" 2>&1
  EXIT_CODE=$?

  echo "  pi exit code: $EXIT_CODE"
  echo "  Log size: $(wc -c < "$ITER_LOG") bytes"
  echo "  Last 20 lines:"
  tail -20 "$ITER_LOG" 2>/dev/null

  # Check if COMPLETE
  if grep -q "COMPLETE" "$ITER_LOG" 2>/dev/null; then
    echo "✅ Phase 2 ALL STORIES COMPLETE!"
    exit 0
  fi

  # Small pause
  sleep 5
done

echo "⚠️ Max iterations ($MAX_ITERATIONS) reached."
jq -r '.userStories[] | "\(.id) — \(if .passes then "✅" else "❌" end)"' "$PRD_FILE"
