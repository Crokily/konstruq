#!/bin/bash
# Konstruq Phase 2 — Discord progress reporter
# Polls prd.json every 3 minutes and sends updates when stories complete

cd /home/ubuntu/konstruq
LAST_DONE=0
DB="/home/ubuntu/discord-agent/discord_agent.db"
CHANNEL1="1469314641984229580"
CHANNEL2="1476846416138604595"

send_discord() {
  local msg="$1"
  python3 -c "
import sqlite3, time
conn = sqlite3.connect('$DB')
cur = conn.cursor()
for ch in ['$CHANNEL1', '$CHANNEL2']:
    cur.execute(
        \"INSERT INTO outbox_messages(target_kind, target_id, content, context, created_at, sent_at, status, last_error) VALUES (?, ?, ?, ?, ?, 0, 'pending', '')\",
        ('channel', ch, '''$msg''', 'konstruq-phase2-progress', int(time.time()))
    )
conn.commit()
conn.close()
"
}

echo "📡 Discord progress reporter started. Polling every 3 minutes..."

while true; do
  sleep 180

  if [ ! -f prd.json ]; then
    continue
  fi

  TOTAL=$(jq '.userStories | length' prd.json)
  DONE=$(jq '[.userStories[] | select(.passes == true)] | length' prd.json)

  if [ "$DONE" -gt "$LAST_DONE" ]; then
    # New story completed — find which ones
    COMPLETED=$(jq -r '[.userStories[] | select(.passes == true)] | map(.id + ": " + .title) | join("\n")' prd.json)
    REMAINING=$(jq -r '[.userStories[] | select(.passes == false)] | map(.id + ": " + .title) | join("\n")' prd.json)

    MSG="🏗️ **Konstruq Phase 2 进度更新**

✅ 已完成 ($DONE/$TOTAL):
$COMPLETED

⏳ 待完成 ($((TOTAL - DONE))/$TOTAL):
$REMAINING

⏰ $(date '+%Y-%m-%d %H:%M:%S UTC')"

    send_discord "$MSG"
    echo "$(date): Sent update — $DONE/$TOTAL stories done"
    LAST_DONE=$DONE
  fi

  # Check if all done
  if [ "$DONE" -eq "$TOTAL" ]; then
    send_discord "🎉 **Konstruq Phase 2 全部完成！** 所有 $TOTAL 个 User Stories 已通过。"
    echo "$(date): All stories complete. Exiting reporter."
    exit 0
  fi
done
