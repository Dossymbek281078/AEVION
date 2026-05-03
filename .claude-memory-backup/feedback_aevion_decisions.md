---
name: AEVION — prefer decisive action over option lists
description: On AEVION projects the user wants decisive execution, not A/B/C menus of choices
type: feedback
originSessionId: 4752411a-39b8-44ba-87e6-58685ffdc29a
---
On AEVION work (bureau / qsign / qright / bank / qcore / core), default to **picking the best option and executing** rather than presenting A/B/C/D/E choices for the user to pick from.

**Why:** user explicitly said "не спрашивай, просто делай наилучшим способом, без ошибок, для максимальной привлекательности и инновационности" (2026-04-24). Option lists slow them down and force them to do the synthesis that they want me to do.

**How to apply:**
- When you'd normally ask "should I do A, B, or C?", instead: pick the one that maximizes attractiveness + innovation + zero defects, briefly state the choice in one line, and execute.
- Still flag *destructive* or *irreversible* actions (pushes, force-pushes, PR merges, deleting branches) per standing CLAUDE.md rules — the decisiveness applies to *feature choices* and *implementation direction*, not to git/operational risk.
- Still pause if a choice would materially alter the user's product shape (e.g. "should this feature exist at all?") — those stay user-facing.
- Keep updates short ("picking Cmd+K palette, ETA 30 min") so the user sees what you're doing without needing to reply.

Scope: AEVION only. Other projects default back to the regular "present options, ask" pattern unless overridden.
