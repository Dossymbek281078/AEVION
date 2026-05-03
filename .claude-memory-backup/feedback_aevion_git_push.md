---
name: AEVION — commit + push on feature branches without asking
description: For AEVION feature branches, auto-commit and auto-push logical units of work without pausing to ask
type: feedback
originSessionId: 4752411a-39b8-44ba-87e6-58685ffdc29a
---
On AEVION worktrees (bureau / qsign / qright / bank / qcore / core), after completing a **logically coherent unit of work** (a feature, a bugfix, a refactor that stands alone), commit and push to the existing feature branch **without asking**. The user explicitly asked why I wasn't doing this (2026-04-24) — the gate-every-commit pattern slows them down and clutters the chat.

**When to do it:**
- Coherent feature or fix that compiles, typechecks, and has tests (or at minimum doesn't break existing tests)
- Working on a feature branch that's already tracking an origin remote (`feat/*`, `fix/*`, etc.)
- Changes are scoped: only the files that belong to this unit, nothing sprawled

**When to still ask / pause:**
- `main` / `master` / `develop` — any long-lived shared branch
- Force-push, amend of pushed commits, rewriting history
- Branch deletions, tag creation, new remote setup
- Opening / merging / closing PRs or issues (visible to others)
- First commit containing a new dependency with license ambiguity, or a secret-shaped string
- "Wip" / broken-build commits — commit only green states to feature branches

**How:**
1. `git add` only the files that belong to this unit (no `git add .` / `-A` — avoids sweeping up `.env`, `.claude/`, unrelated tooling).
2. Commit message follows the repo's existing style (check `git log --oneline -3` for format — prefixes like `feat(qright-v2):`, `fix(bureau):`, `chore(...):`).
3. Push to the tracked remote branch immediately.
4. Report the commit SHA + push result in one line, move on.

**Why:** pushing each coherent unit keeps origin current, lets the user review via GitHub UI when convenient, gives natural revert points, and avoids the "giant monolith commit at the end" failure mode. Feature-branch pushes are inherently low-blast-radius — the user can always `git reset --hard origin/main` on the feature branch if something went sideways.

Scope: AEVION feature branches only. Other projects default back to "ask before committing and pushing".
