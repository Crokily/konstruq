#!/bin/bash
# Konstruq Ralph Loop — Custom runner with model routing rules
# Planning/decision: claude-opus-4-6 xhigh (via pi)
# Coding: codex CLI (gpt-5.3-codex xhigh)
# Testing: agent-browser E2E
# Notifications: discord-agent (gemini-3-flash)
set -e

cd /home/ubuntu/konstruq

MAX_ITERATIONS=${1:-15}
PRD_FILE="./prd.json"
PROGRESS_FILE="./progress.txt"
PROMPT_TEMPLATE="$HOME/.pi/agent/skills/ralph-loop/scripts/prompt.md"

# Verify prerequisites
command -v pi >/dev/null || { echo "pi not found"; exit 1; }
command -v jq >/dev/null || { echo "jq not found"; exit 1; }
[ -f "$PRD_FILE" ] || { echo "prd.json not found"; exit 1; }

# Create branch if needed
BRANCH=$(jq -r '.branchName' "$PRD_FILE")
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "$BRANCH" ]; then
  git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
fi

notify_discord() {
  local msg="$1"
  pi -m "gemini-3-flash [google-antigravity]" --print <<EOF 2>/dev/null || true
Use the discord-agent skill to send a notification. Run this command:
cd /home/ubuntu/discord-agent && source .venv/bin/activate && python3 -c "
import asyncio, discord, os
from dotenv import load_dotenv
load_dotenv()
intents = discord.Intents.default()
client = discord.Client(intents=intents)
@client.event
async def on_ready():
    ch = client.get_channel(int(os.environ.get('NOTIFY_CHANNEL_ID', '0')))
    if ch: await ch.send('🏗️ **Konstruq Ralph**: $msg')
    await client.close()
client.run(os.environ['DISCORD_TOKEN'])
"
EOF
}

# Notify start
notify_discord "Loop started — $(jq '[.userStories[] | select(.passes==false)] | length' $PRD_FILE) stories remaining"

for i in $(seq 1 $MAX_ITERATIONS); do
  TOTAL=$(jq '.userStories | length' "$PRD_FILE")
  DONE=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE")
  REMAINING=$((TOTAL - DONE))

  if [ "$REMAINING" -eq 0 ]; then
    echo "✅ All stories complete at iteration $i!"
    notify_discord "✅ ALL STORIES COMPLETE after $i iterations!"
    exit 0
  fi

  NEXT=$(jq -r '[.userStories[] | select(.passes == false)] | sort_by(.priority) | .[0] | "\(.id): \(.title)"' "$PRD_FILE")

  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  🔄 Iteration $i/$MAX_ITERATIONS — $REMAINING remaining"
  echo "  📋 Next: $NEXT"
  echo "═══════════════════════════════════════════════════════════"

  # Run pi with claude-opus-4-6 xhigh for decision-making
  OUTPUT=$(pi -m "claude-opus-4-6 • xhigh" --print < "$PROMPT_TEMPLATE" 2>&1 | tee /tmp/ralph-iter-$i.log) || {
    EXIT_CODE=$?
    echo "⚠️ pi exited with code $EXIT_CODE, checking if model quota exhausted..."

    # Fallback to thinking model
    echo "Trying fallback model: claude-opus-4-6-thinking [google-antigravity] high..."
    OUTPUT=$(pi -m "claude-opus-4-6-thinking [google-antigravity] high" --print < "$PROMPT_TEMPLATE" 2>&1 | tee /tmp/ralph-iter-$i-fallback.log) || {
      EXIT_CODE2=$?
      echo "❌ Both models failed. Notifying via Discord and stopping."
      notify_discord "❌ QUOTA EXHAUSTED — both claude-opus-4-6 models failed at iteration $i ($NEXT). Please check."
      exit 1
    }
  }

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo "✅ Ralph completed all tasks at iteration $i!"
    notify_discord "✅ ALL STORIES COMPLETE after $i iterations!"
    exit 0
  fi

  # Brief progress notification every 3 iterations
  if [ $((i % 3)) -eq 0 ]; then
    DONE_NOW=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE")
    notify_discord "Progress: $DONE_NOW/$TOTAL stories done (iteration $i)"
  fi

  echo "  ✓ Iteration $i complete. Next in 5s..."
  sleep 5
done

echo "⚠️ Reached max iterations ($MAX_ITERATIONS)"
DONE_FINAL=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE")
notify_discord "⚠️ Reached max iterations ($MAX_ITERATIONS). $DONE_FINAL/$TOTAL stories complete."
jq '.userStories[] | "\(.id): \(.title) — \(if .passes then "✅" else "❌" end)"' "$PRD_FILE" -r
exit 1
