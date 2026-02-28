#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# Konstruq V3 — Ralph Loop Driver
# Executes user stories one at a time via Codex CLI, with quality gates,
# agent-browser e2e testing, and discord progress reporting.
###############################################################################

PROJECT_DIR="/home/ubuntu/konstruq"
PRD_FILE="$PROJECT_DIR/prd.json"
PROGRESS_FILE="$PROJECT_DIR/progress-v3.txt"
MAX_ITERATIONS="${1:-14}"
ITERATION=0

cd "$PROJECT_DIR"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Konstruq V3 — Ralph Loop Starting                      ║"
echo "║  Max iterations: $MAX_ITERATIONS                                  ║"
echo "╚══════════════════════════════════════════════════════════╝"

while [ "$ITERATION" -lt "$MAX_ITERATIONS" ]; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ITERATION $ITERATION / $MAX_ITERATIONS — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Find next incomplete story
  NEXT_STORY=$(python3 -c "
import json, sys
with open('$PRD_FILE') as f:
    prd = json.load(f)
for story in sorted(prd['userStories'], key=lambda s: s['priority']):
    if not story.get('passes', False):
        print(story['id'])
        sys.exit(0)
print('COMPLETE')
")

  if [ "$NEXT_STORY" = "COMPLETE" ]; then
    echo "✅ ALL STORIES COMPLETE!"
    # Send completion notification to Discord
    python3 /home/ubuntu/discord-agent/send_notification.py \
      "🎉 **Konstruq V3 — ALL 14 STORIES COMPLETE!** Ralph loop finished successfully." 2>/dev/null || true
    break
  fi

  # Extract story details
  STORY_TITLE=$(python3 -c "
import json
with open('$PRD_FILE') as f:
    prd = json.load(f)
for s in prd['userStories']:
    if s['id'] == '$NEXT_STORY':
        print(s['title'])
        break
")

  # ENFORCE correct branch before each iteration
  EXPECTED_BRANCH="ralph/konstruq-v3"
  CURRENT_BRANCH=$(git branch --show-current)
  if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
    echo "⚠️  Branch drift detected: $CURRENT_BRANCH → switching to $EXPECTED_BRANCH"
    git checkout "$EXPECTED_BRANCH" 2>/dev/null || true
  fi

  echo "📋 Story: $NEXT_STORY — $STORY_TITLE"

  # Send start notification to Discord
  python3 /home/ubuntu/discord-agent/send_notification.py \
    "🔧 **Konstruq V3** — Starting **$NEXT_STORY**: $STORY_TITLE (iteration $ITERATION/$MAX_ITERATIONS)" 2>/dev/null || true

  #---------------------------------------------------------------------------
  # STEP 1: Build Codex prompt
  #---------------------------------------------------------------------------
  PROMPT_FILE=$(mktemp /tmp/codex-prompt.XXXXXX.md)
  RESULT_FILE=$(mktemp /tmp/codex-result.XXXXXX.txt)
  LOG_FILE=$(mktemp /tmp/codex-run.XXXXXX.log)

  # Extract full story JSON
  STORY_JSON=$(python3 -c "
import json
with open('$PRD_FILE') as f:
    prd = json.load(f)
for s in prd['userStories']:
    if s['id'] == '$NEXT_STORY':
        print(json.dumps(s, indent=2))
        break
")

  # Read progress patterns
  PATTERNS=$(head -30 "$PROGRESS_FILE")

  cat > "$PROMPT_FILE" <<PROMPT_EOF
# Task: Implement $NEXT_STORY for Konstruq V3

## Project Context
- Working directory: /home/ubuntu/konstruq
- Branch: ralph/konstruq-v3
- Framework: Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui
- Auth: Clerk (auth() → resolveAppUserId())
- Database: Neon Postgres + Drizzle ORM (schema at src/lib/db/schema.ts)
- AI: Mistral via @ai-sdk/mistral

## Codebase Patterns
$PATTERNS

## Story to Implement
$STORY_JSON

## Requirements
1. Implement ONLY this one story — nothing else.
2. Follow all acceptance criteria exactly.
3. Use existing code patterns from the codebase.
4. If you need to add shadcn components, run: npx shadcn@latest add <component> --yes
5. CRITICAL: Do NOT switch git branches. Stay on the current branch (ralph/konstruq-v3). Do NOT run git checkout, git switch, or any branch-changing command. ALL work must happen on the current branch.
6. Do NOT modify prd.json — the loop script handles that.
7. After implementation, run these quality checks:
   - \`npx tsc --noEmit\` (must pass)
   - \`npx eslint . --fix\` (must pass)
6. Fix any errors until both pass.

## Validation
- Run: cd /home/ubuntu/konstruq && npx tsc --noEmit
- Run: cd /home/ubuntu/konstruq && npx eslint . --fix
- Both must exit 0.

## Deliverables
- List all modified/created files
- Describe what changed and why
- Note any patterns discovered or gotchas
PROMPT_EOF

  echo "🤖 Delegating to Codex CLI..."

  #---------------------------------------------------------------------------
  # STEP 2: Execute via Codex CLI
  #---------------------------------------------------------------------------
  CODEX_START=$(date +%s)

  # Use config defaults: model=gpt-5.3-codex, effort=xhigh (from ~/.codex/config.toml)
  codex exec \
    --yolo \
    --output-last-message "$RESULT_FILE" \
    - < "$PROMPT_FILE" > "$LOG_FILE" 2>&1
  CODEX_EXIT=$?

  CODEX_END=$(date +%s)
  CODEX_DURATION=$((CODEX_END - CODEX_START))
  echo "⏱  Codex finished in ${CODEX_DURATION}s (exit: $CODEX_EXIT)"

  # POST-CODEX: Force correct branch (Codex sometimes drifts)
  CURRENT_BRANCH=$(git branch --show-current)
  if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
    echo "⚠️  Branch drift after Codex: $CURRENT_BRANCH → stashing and switching back"
    git stash 2>/dev/null || true
    git checkout "$EXPECTED_BRANCH" 2>/dev/null
    git stash pop 2>/dev/null || true
  fi

  if [ "$CODEX_EXIT" -ne 0 ]; then
    echo "❌ Codex failed! Checking log..."
    tail -30 "$LOG_FILE"
    # Report failure to Discord
    python3 /home/ubuntu/discord-agent/send_notification.py \
      "❌ **Konstruq V3** — $NEXT_STORY FAILED (codex exit $CODEX_EXIT). Retrying next iteration." 2>/dev/null || true
    continue
  fi

  #---------------------------------------------------------------------------
  # STEP 3: Quality gate verification
  #---------------------------------------------------------------------------
  echo "🔍 Running quality checks..."

  TYPECHECK_OK=true
  cd "$PROJECT_DIR" && npx tsc --noEmit 2>&1 | tail -20 || TYPECHECK_OK=false

  LINT_OK=true
  cd "$PROJECT_DIR" && npx eslint . --fix 2>&1 | tail -10 || LINT_OK=false

  if [ "$TYPECHECK_OK" = false ] || [ "$LINT_OK" = false ]; then
    echo "⚠️  Quality checks failed after Codex. Attempting auto-fix via second Codex pass..."

    FIX_PROMPT=$(mktemp /tmp/codex-fix.XXXXXX.md)
    FIX_RESULT=$(mktemp /tmp/codex-fix-result.XXXXXX.txt)
    FIX_LOG=$(mktemp /tmp/codex-fix-run.XXXXXX.log)

    # Capture actual errors
    TSC_ERRORS=$(cd "$PROJECT_DIR" && npx tsc --noEmit 2>&1 | tail -40 || true)
    LINT_ERRORS=$(cd "$PROJECT_DIR" && npx eslint . 2>&1 | tail -40 || true)

    cat > "$FIX_PROMPT" <<FIX_EOF
# Task: Fix TypeScript and ESLint errors in Konstruq

Working directory: /home/ubuntu/konstruq

## TypeScript errors:
\`\`\`
$TSC_ERRORS
\`\`\`

## ESLint errors:
\`\`\`
$LINT_ERRORS
\`\`\`

Fix ALL errors. Run \`npx tsc --noEmit\` and \`npx eslint . --fix\` to verify.
Do not change any business logic — only fix type/lint errors.
FIX_EOF

    codex exec \
      --yolo \
      --output-last-message "$FIX_RESULT" \
      - < "$FIX_PROMPT" > "$FIX_LOG" 2>&1 || true

    # Re-check
    TYPECHECK_OK=true
    cd "$PROJECT_DIR" && npx tsc --noEmit 2>&1 | tail -5 || TYPECHECK_OK=false

    LINT_OK=true
    cd "$PROJECT_DIR" && npx eslint . --fix 2>&1 | tail -5 || LINT_OK=false

    if [ "$TYPECHECK_OK" = false ] || [ "$LINT_OK" = false ]; then
      echo "❌ Quality checks still failing. Skipping commit for $NEXT_STORY."
      python3 /home/ubuntu/discord-agent/send_notification.py \
        "❌ **Konstruq V3** — $NEXT_STORY quality checks failed after fix attempt. Manual review needed." 2>/dev/null || true
      continue
    fi
  fi

  echo "✅ Quality checks passed!"

  #---------------------------------------------------------------------------
  # STEP 4: Browser verification for UI stories
  #---------------------------------------------------------------------------
  HAS_BROWSER_CHECK=$(python3 -c "
import json
with open('$PRD_FILE') as f:
    prd = json.load(f)
for s in prd['userStories']:
    if s['id'] == '$NEXT_STORY':
        for ac in s.get('acceptanceCriteria', []):
            if 'Verify in browser' in ac:
                print('yes')
                break
        break
" || echo "no")

  if [ "$HAS_BROWSER_CHECK" = "yes" ]; then
    echo "🌐 Running browser verification..."
    # Check if dev server is running
    if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
      echo "⚠️  Dev server not running, skipping browser check"
    else
      agent-browser open http://localhost:3000 2>/dev/null || true
      sleep 2
      agent-browser screenshot /tmp/konstruq-$NEXT_STORY.png 2>/dev/null || true
      agent-browser close 2>/dev/null || true
      echo "📸 Screenshot saved: /tmp/konstruq-$NEXT_STORY.png"
    fi
  fi

  #---------------------------------------------------------------------------
  # STEP 5: Commit and update tracking
  #---------------------------------------------------------------------------
  cd "$PROJECT_DIR"
  git add -A
  git commit -m "feat: $NEXT_STORY - $STORY_TITLE" || true

  # Update prd.json — mark story as passed
  python3 -c "
import json
with open('$PRD_FILE', 'r') as f:
    prd = json.load(f)
for s in prd['userStories']:
    if s['id'] == '$NEXT_STORY':
        s['passes'] = True
        break
with open('$PRD_FILE', 'w') as f:
    json.dump(prd, f, indent=2)
    f.write('\n')
"

  # Append to progress log
  CODEX_SUMMARY=$(head -20 "$RESULT_FILE" 2>/dev/null || echo "No result captured")
  TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')

  cat >> "$PROGRESS_FILE" <<LOG_EOF

## $TIMESTAMP - $NEXT_STORY: $STORY_TITLE
- Codex execution: ${CODEX_DURATION}s
- Files changed: $(git diff --name-only HEAD~1 2>/dev/null | tr '\n' ', ' || echo "unknown")
- Summary: $(echo "$CODEX_SUMMARY" | head -5 | tr '\n' ' ')
---
LOG_EOF

  git add -A
  git commit -m "chore: mark $NEXT_STORY as passed" || true

  # Report success to Discord
  python3 /home/ubuntu/discord-agent/send_notification.py \
    "✅ **Konstruq V3** — **$NEXT_STORY** complete: $STORY_TITLE (${CODEX_DURATION}s) [$ITERATION/$MAX_ITERATIONS]" 2>/dev/null || true

  echo "✅ $NEXT_STORY committed and tracked."

  # Cleanup temp files
  rm -f "$PROMPT_FILE" "$RESULT_FILE" "$LOG_FILE" 2>/dev/null || true

done

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Ralph Loop Complete — $ITERATION iterations executed     ║"
echo "╚══════════════════════════════════════════════════════════╝"
