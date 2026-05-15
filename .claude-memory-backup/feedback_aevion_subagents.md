---
name: AEVION subagent permissions + skill pivots
description: AEVION worktree subagents need Edit/Write/Read in per-worktree settings.local.json, AND must be told explicitly not to invoke skills like fewer-permission-prompts when blocked
type: feedback
originSessionId: 107e9048-6e9a-44aa-bf9e-8e70ff9aeef2
---
When dispatching subagents to AEVION worktrees, two failure modes are easy to hit:

**1. Per-worktree settings.local.json is narrow.** Each AEVION worktree (`aevion-bureau`, `aevion-qsign`, `aevion-backend-modules`, `aevion-core/frontend-*`) has its own `.claude/settings.local.json` with a specific allowlist accumulated from past sessions. The home-level `~/.claude/settings.local.json` allowlist (with `Bash(git *)` etc) does NOT propagate down. Subagents launched into a worktree silently get denied for missing patterns.

**Required minimum to add to each worktree's settings.local.json before dispatching subagents:**
- `Bash(git *)` — git ops (status/log/diff/branch/push)
- `Bash(npm run *)`, `Bash(npx tsc*)`, `Bash(npm install *)`, `Bash(node *)`, `Bash(npx *)` — build/typecheck
- `Edit(**)`, `Write(**)`, `Read(**)` — file mutation (subagents need this even when parent has it implicitly)

**2. Skill-pivot trap.** When a subagent hits a permission denial AND sees the `fewer-permission-prompts` skill in its available list, it abandons the task to "helpfully" generate an allowlist analysis instead of completing the work. Result: 360s of transcript scanning, zero shipped code.

**How to apply:**
- Before dispatching parallel subagents to AEVION worktrees, patch all relevant `.claude/settings.local.json` with the above rules. The Node one-liner works:
  ```bash
  node -e "const j=require('fs').readFileSync(p);const o=JSON.parse(j);o.permissions.allow.push(...need);require('fs').writeFileSync(p,JSON.stringify(o,null,2))"
  ```
- In every subagent prompt, include: "**DO NOT invoke any skill** (especially `fewer-permission-prompts`). If you hit a permission denial, STOP and report — don't pivot to a tangential task."

**Why:** Lost a full round of 10 parallel agents (~6 min wall time, ~500K tokens) on permission/skill-pivot issues. Bureau agent succeeded because its task was clear-cut and didn't trip the path.
