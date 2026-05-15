# QBuild v2 — polish & extension layer

**Branch:** `feat/qbuild-v1` → `main`
**Volume:** ~140 commits since the v1 squash-merge (`b05bacc`).
**State:** backend `tsc` clean (qbuild scope), frontend `tsc` clean, **vitest 71/71 PASS** (48 from v1 + 16 round-24 + 7 round-25).

This PR is the polish & extension work since the original QBuild v1 ship (PR #108). Nothing renames or removes existing v1 surfaces — all changes are additive or tighten existing behaviour. All schema changes use `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` so the migration is idempotent.

## Highlights — what's new since v1

### ATS / recruiter workflow
- **5-stage pipeline labels** (`TOP_PICK / SHORTLIST / INTERVIEW / OFFER / HOLD`) with hotkeys 1–5 in review-mode
- **`/build/pipeline`** kanban board across all owner's PENDING applications
- **`/build/calendar`** interview view (next/past 7d, anchored on label timestamp)
- **Bulk accept/reject** toolbar on review screen with multi-select + select-all
- **Snooze** PENDING applications until a date — out of the default queue, easy to bring back
- **Vacancy team notes** — private, recruiter-only thread of notes about the role itself (separate from per-applicant notes)
- **Vacancy edit history** — append-only changelog of recruiter edits
- **Vacancy +30d extend** button when expiring within 7 days
- **Vacancy republish** — reset closed vacancy back to OPEN with new expiry
- **Vacancy clone** + **save as template** + **bulk import** via CSV
- **Vacancy ARCHIVE** state + ARCHIVED status filter
- **Application flag + admin moderation queue** for problem candidates
- **Recruiter onboarding wizard** at `/build/onboarding` — 5 steps that read existing API state to detect what's done

### AI / data surfaces
- **`/ai/vacancy-feedback`** — Claude scores the vacancy 0–100 + strengths + concrete suggestions
- **`/ai/dm-suggest`** — three reply suggestions for the current chat thread
- **`/ai/why-match`** — bullet explanation of why a candidate fits a vacancy (cached on the application row)
- **AI shortlist + cover-letter + interview-prep + translate-vacancy** — already in v1, all kept
- **Today digest tile** on dashboard — last 24h applications + closing-soon + stale pending
- **Weekly digest tile** on dashboard — apps/vacancies/hires this week vs prior week
- **Boost ROI tile** on vacancy detail — applications during boost vs same-length window before
- **Apply-rate chip** on vacancy detail — applications/views ratio when ≥20 views
- **Hot vacancies 🔥 chip** on feed — recent + top-quartile applicant interest
- **First-hire celebration banner** on dashboard with confetti

### Admin / platform
- **`/build/admin/insights`** — weekly platform metrics: new users / apps / vacancies / hires + top-5 employers + top-5 vacancies + conversion rate
- **`/build/admin/weekly-preview/:userId`** — render the weekly digest email body for a given recruiter (no SMTP send yet — proof content first)
- **`/build/admin/flags`** — application moderation queue
- **Partner API key registry** at `/build/admin/partner-keys` — mint + revoke + rotate (revoke + mint new with same label) + 14d usage sparkline (new daily-aggregate table)
- **Bulk-revoke** keys via multi-select toolbar
- **Vacancy auto-close-expired** admin endpoint

### Public / SEO / sharing
- **Drop-in widget** at `/api/build/public/widget.js` for partner sites + key-gated `/api/build/public/v1/vacancies` JSON
- **`/build/developers`** API docs page
- **`/build/changelog`** product updates page
- **RSS 2.0 feed** at `/api/build/public/rss/vacancies.xml`
- **Skill SEO landing pages** at `/build/skill/[slug]`
- **Featured employers** carousel on home + `/build/employer/[id]` overview
- **Vacancy `?embed=1`** mode — strips BuildShell for iframe embeds
- **Vacancy `?preview=candidate`** mode for owners to self-test
- **Personal share-links** at `/build/r/[token]` with localStorage attribution (30d TTL)
- **Quick-share** to Telegram / WhatsApp / LinkedIn / X next to the existing copy-link
- **PWA manifest** + iOS standalone meta + service worker offline shell (prod only)
- **JSON-LD coverage** — JobPosting / Organization / WebSite / SearchAction / BreadcrumbList
- **Sitemap** — adds employer + skill routes
- **Mobile bottom-nav** in `BuildShell` (sm:hidden, safe-area inset)

### Messaging
- **Read receipts** ✓ / ✓✓ + "Read" label on the latest own message
- **Schedule interview 📅** in chat composer — generates Google/Outlook/.ics calendar links
- **AI reply chips** + **3 quick-template chips** (decline / will-get-back / schedule-call)
- **Last-active pill** in inbox (online <5m / Nm ago / Nh ago / Nd ago)
- **Bulk-DM templates** (recruiter-saved, max 30) at `/build/messages/templates`

### Profile / candidate
- **Profile completeness meter v2** with priority chips
- **Personal share link** with attribution
- **`/build/u/[id]/resume`** print-friendly resume + QR
- **`/build/u/[id]` OG image** generator
- **Saved talent searches** + cross-session alerts on dashboard
- **`/build/compare`** side-by-side up to 3 vacancies

### Misc & DX
- **`/build/help`** search-as-you-type with auto-open results
- **`/build/why-aevion`** RU/EN landing + email lead capture
- **`/build/leaderboard`** referral leaderboard
- **`/build/loyalty`** AEV cashback claim
- **`/build/notifications`** preferences page
- **Dashboard loading skeleton** instead of plain text
- **First-project CTA** on `/build` for new owners
- **Bookmark scale-pop animation** on save
- **Sentry-aware error reporter** + custom `error.tsx`
- **Friendly `not-found.tsx`** with popular links

## Schema changes (idempotent)

New tables (all `CREATE TABLE IF NOT EXISTS`):
- `BuildPartnerApiKey` — partner read-only API keys
- `BuildPartnerApiKeyHit` — daily usage aggregate per key
- `BuildVacancyTemplate` — saved vacancy templates per owner
- `BuildVacancyEdit` — append-only edit changelog
- `BuildVacancyNote` — private team notes per vacancy
- `BuildApplicationFlag` — moderation queue
- `BuildBulkTemplate` — bulk-DM templates per owner
- `BuildNotifPrefs` — per-user email opt-in/out

New columns (all `ADD COLUMN IF NOT EXISTS`):
- `BuildApplication.aiWhyMatch` — cached AI explanation
- `BuildApplication.snoozedUntil` — snooze hidden-until timestamp
- `BuildApplication.sourceTag` — UTM/ref/widget bucket
- `BuildApplication.labelKey` — recruiter pipeline label
- `BuildApplicationNote.isPinned` — pin-to-top notes

`VacancyStatus` extended: `OPEN | CLOSED | ARCHIVED`.
`ApplicationLabel` extended: `TOP_PICK | SHORTLIST | INTERVIEW | OFFER | HOLD`.

## Tests

- `tests/build.integration.test.ts` — 48 cases (v1 surface)
- `tests/build.round24.test.ts` — 16 cases for extend / boost-roi / weekly / insights / team-notes / partner-keys-usage / interview-feed / rotate
- `tests/build.round25.test.ts` — 7 cases for OFFER label / pipeline / weekly-preview

**71/71 PASS.** Run with `npx vitest run tests/build.*.test.ts` from `aevion-globus-backend/`.

## Test plan (post-merge)

- [ ] Railway redeploys cleanly; idempotent migrations apply with no errors
- [ ] `GET /api/build/health` returns 200 with numeric counters
- [ ] `GET /api/build/public/v1/vacancies` returns JSON with valid X-Build-Key
- [ ] `/build` loads, projects list renders
- [ ] `/build/vacancies` filters work (status / city / salary / skill / sort)
- [ ] `/build/dashboard` loads for a logged-in recruiter, shows skeleton then real tiles
- [ ] `/build/pipeline` shows applications grouped by labelKey
- [ ] `/build/calendar` shows INTERVIEW-labeled apps in 7-day grid
- [ ] `/build/onboarding` correctly detects which of 5 steps are done
- [ ] `/build/admin/insights` works for ADMIN, 403 for others
- [ ] `/build/admin/partner-keys` mint + rotate + revoke + sparkline render
- [ ] Vacancy detail: extend +30d works, boost-roi panel renders when boost active, AI feedback popover loads
- [ ] Review screen: bulk accept/reject works, OFFER label assigns via key 4
- [ ] DM: AI suggest button + 3 template chips + 📅 scheduler all work
- [ ] PWA: `/build-manifest.webmanifest` returns 200, install prompt appears on supported browsers
- [ ] Service worker registers (prod only) and `/build` works offline after first visit
- [ ] OG images render for vacancy + employer + profile share

## Known gaps (out of scope here)

- **SMTP cron** for weekly digest — endpoint is built (`/admin/weekly-preview`), Resend integration exists for transactional emails, but the recurring cron job isn't wired. Add when actual user volume justifies it.
- **WebSocket presence** — chat polls every 8s. Real-time "is typing" requires `ws` lib install + WebSocket route. Defer until users complain about polling latency.
- **Vacancy auto-translate** — translate-on-demand exists; persistent multi-locale cache (RU/EN/KK pre-rendered) deferred.

## How to roll back

Revert the squash-merge commit. All schema additions are idempotent and additive — leaving them in place after revert is safe (no v1 code references the new columns).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
