# AEVION Bank — Session Handoff (last updated 2026-04-23)

Snapshot to pick up work on the bank track. Read this first next session, then [`CLAUDE.md`](./CLAUDE.md) for session rules.

---

## Branch / repo state

- **Worktree:** `C:\Users\user\aevion-core\frontend-bank` (git worktree of ветка `bank-payment-layer` — не отдельное приложение, дерево совпадает со всем `aevion-core`).
- **Ветка:** `bank-payment-layer`.
- **Remote:** `github.com/Dossymbek281078/AEVION` — pushed through `1f77158`.
- **Last commit:** `1f77158 feat(bank): wallet snapshot export — downloadable SVG + text summary`.
- **Ahead of `main`:** 39 commits (1 modular rewrite + 28 features + 5 refactors + 5 polish/fix).
- **PR URL (unmerged):** https://github.com/Dossymbek281078/AEVION/pull/new/bank-payment-layer
- **Build:** green. `npm run verify` (from `aevion-core` root) passes.

## Shipped feature list (chronological)

| # | Commit | Feature |
|---|--------|---------|
| 00 | `1124bc7` | Modular rewrite — 800-line monolith → 5 lib + 2 hooks + 8 components |
| 01 | `684a7f0` | Total AEVION Earnings dashboard (pie + stacked area, 30d/90d/1y) |
| 02 | `f9e28c2` | QRight royalty stream (live feed, estimated30d forecast, top-5 works) |
| 03 | `e738a65` | CyberChess tournament winnings (results + upcoming, rating sparkline) |
| 04 | `6190e00` | Ecosystem Trust Score v2 (8-factor radar chart) |
| 05 | `14cf46b` | Recurring payments (executor каждые 30s, auto-pause on failure) |
| 06 | `e4ff8d3` | Savings goals (8 icons, forecast по rate) |
| 07 | `7bd4110` | Spending insights (auto-categorisation, month-vs-month) |
| 08 | `865710f` | Split bills (equal/custom, copy-link per share) |
| 09 | `763eb35` | Multi-currency display (AEC/USD/EUR/KZT via CurrencyContext) |
| 10 | `9a69619` | Biometric protection — настоящий WebAuthn, guard на переводы > threshold |
| 11 | `c1c64cb` | Transaction signing через QSign + audit log с verify-all |
| 12 | `f8421a6` | Activity timeline с anomaly flags (large / newRecipient / burst / lateNight) |
| 13 | `9e5bcd2` | Device / session management (real fingerprint + seeded mocks) |
| 14 | `f6d7a32` | CoinTower — SVG 3D-style gold stack animation в WalletSummary |
| 15 | `3573d06` | Social Circles — group chats с inline send + request |
| 16 | `8f8e089` | Gift mode — 6 themed cards с live preview |
| 17 | `1c96f7e` | Salary Advance — Trust-Score-gated credit, real topup, auto-repay tick |
| 18 | `eb5f140` | AI Advisor chat — QCoreAI с system prompt из полного контекста |
| polish | `f00a26f` | "Register IP" → "Protect your work" (CTA clarity) |
| refactor | `66d0313` | useLocalList + formPrimitives + .gitattributes (eol=lf) |
| refactor | `cf50655` | EcosystemDataProvider (fetch fan-out) + mockCatalog dedup |
| refactor | `470fe8f` | Money component universal (currency switcher everywhere) |
| 19 | `d55cd63` | Trust Score v3 — nonlinear curve + path-to-next-tier UI |
| 20 | `cfd43c6` | Wealth Forecast — 3 scenarios × 3 horizons + goal ETAs |
| 21 | `487bf47` | Achievements — 18 unlockable badges across 4 tracks |
| 22 | `3b9b6f7` | Animated balance ticker + direction indicator |
| fix | `fd0cd7a` | Runtime hardening — SSR load, NaN guards, responsive grids |
| 23 | `e4817fb` | `?demo=1` seed mode + /bank route error boundary |
| fix | `406ab91` | Demo Reset purges seeded contacts + handoff docs |
| 24 | `17a7bc0` | Ecosystem Pulse + shimmer skeletons + goal confetti |
| 25 | `3cf6708` | Peer Standing — network-rank widget across 4 dimensions |
| fix | `9c640ae` | Real auto-repay on incoming transfers (tech-debt #9 closed) |
| 26 | `e395124` | Onboarding tour — 5-step first-visit modal with scroll-to-anchor |
| 27 | `1f77158` | Snapshot export — downloadable SVG + text summary |

## Architecture

```
frontend/src/app/bank/
├── page.tsx                               ← только композиция + auth states
├── _lib/
│   ├── types.ts      api.ts      format.ts     random.ts
│   ├── currency.ts   CurrencyContext.tsx
│   ├── biometric.ts  BiometricContext.tsx
│   ├── ecosystem.ts  royalties.ts  chess.ts    trust.ts
│   ├── contacts.ts   paymentRequest.ts
│   ├── recurring.ts  savings.ts    splits.ts
│   ├── signatures.ts spending.ts   anomaly.ts  devices.ts
│   ├── circles.ts    gifts.ts      advance.ts
├── _hooks/
│   ├── useAuthMe.ts  useBank.ts
│   ├── useRecurring.ts useSavings.ts  useSplits.ts
│   ├── useSignatures.ts useCircles.ts useAdvance.ts
└── _components/
    ├── primitives.tsx   charts.tsx       Money.tsx
    ├── BankHero.tsx     WalletSummary.tsx CoinTower.tsx
    ├── TotalEarningsDashboard.tsx  TrustScoreCard.tsx
    ├── AdvisorChat.tsx  SalaryAdvance.tsx
    ├── RoyaltyStream.tsx  ChessWinnings.tsx
    ├── AccountIdCard.tsx  QRCode.tsx  PaymentRequestPanel.tsx
    ├── BiometricCard.tsx  AuditPanel.tsx
    ├── TopupForm.tsx     SendForm.tsx
    ├── RecurringPayments.tsx  SavingsGoals.tsx
    ├── SpendingInsights.tsx   SplitBills.tsx
    ├── SocialCircles.tsx  GiftMode.tsx
    ├── ActivityTimeline.tsx   DeviceManagement.tsx
    ├── TransactionList.tsx    StaticSections.tsx
```

## Tech debt (tracked)

Cleared this session (2026-04-23):
1. ~~Fetch duplication~~ — `EcosystemDataProvider` + `useEcosystemData()` fan-out; 6 consumers dropped their individual fetches.
2. ~~Form primitives duplication~~ — `_components/formPrimitives.tsx` (Field, inputStyle, btnSecondary, btnDanger); 5 components now share.
3. ~~localStorage hook pattern~~ — `_hooks/useLocalList.ts`; `useRecurring/useSavings/useSplits/useCircles` delegate storage.
4. ~~Money everywhere~~ — RecurringPayments, SavingsGoals, SplitBills, SpendingInsights now use `<Money>` (or `formatCurrency(n, code)` in string contexts). CurrencySwitcher is universal.
5. ~~Trust Score linear~~ — v3 with sub-linear `pow(r, 0.55)` curve, weighted factors, softer targets, engagement bonus. Adds `nextTier`, `pointsToNextTier`, `checklist` fields.
6. ~~Mock catalog duplication~~ — `_lib/mockCatalog.ts` exports `QRIGHT_WORKS_BY_KIND`, `QRIGHT_FLAT_WORKS`, `CHESS_TOURNAMENT_NAMES`, `PLANET_TASKS`.
8. ~~CRLF warnings~~ — `.gitattributes` with `* text=auto eol=lf`.

Closed 2026-04-23 evening:
9. ~~`useAdvance` auto-repay~~ — теперь sweep'ит 50% каждого incoming transfer в outstanding (commit `9c640ae`).

Still open:
7. **Audit panel retention** — хранит 50 подписей; нет экспорта в файл.
11. **AchievementsPanel: shared refresh signal** — сейчас polls every 15s + focus/storage events. Было бы чище: emit events из useSavings/useSplits/useCircles/useSignatures по записи в storage.
12. **Discoverability of re-run for Tour** — сейчас `?tour=1` работает, но нет in-page кнопки «Take the tour» (кроме первого автозапуска). Можно добавить в Help-меню или footer.

## Backend dependencies queue (другая сессия)

Пометки «TBD» в коде. Когда backend-сессия возьмётся:

- `/api/qtrade/*` — **JWT middleware** + фильтрация по `req.user.sub` (сейчас security-дыра: любой клиент видит чужие балансы).
- `/api/qtrade/operations` + `/transfers` — пагинация `?limit=&before=`.
- **email → accountId resolver** для P2P по email.
- `/api/qtrade/rates` — live FX rates.
- `/api/qtrade/recurring` + server cron — чтобы schedules бегали когда вкладка закрыта.
- `/api/qtrade/goals` — subaccounts с real escrow.
- `/api/qtrade/advance` — реальный credit line + hook на incoming для авто-repay.
- `/api/ecosystem/earnings` — агрегация со всех модулей (пока mock).
- `/api/qright/royalties` + webhook `qright.verify → qtrade.transfer(0.01 AEC)`.
- `/api/cyberchess/{results,upcoming}` + webhook `tournament.finalized → qtrade.transfer(prize)`.
- `/api/auth/sessions` + `DELETE /:id` — real device tracking.
- `/api/circles` + WebSocket для multi-user chat.
- `/api/gifts` + `/bank/gift/[id]` frontend route — recipient pickup experience.
- **WebAuthn server-side** — сейчас `navigator.credentials.get()` проверяется только фактом успеха; в проде backend должен верифицировать assertion against stored public key.

## Running locally

```powershell
# Backend (port 4001):
cd C:\Users\user\aevion-core\aevion-globus-backend ; npm run dev

# Frontend (port 3000):
cd C:\Users\user\aevion-core\frontend ; npm run dev
```

Open:
- **http://localhost:3000/bank** — обычный режим, пустой wallet для нового пользователя. Первый визит автоматически открывает 5-step onboarding tour.
- **http://localhost:3000/bank?demo=1** — auto-seed goals / recurring / circles / splits / gifts / contacts. Баннер сверху показывает «Demo data loaded» с кнопкой Reset.
- **http://localhost:3000/bank?tour=1** — принудительно переоткрыть onboarding tour (даже если флаг `aevion_bank_tour_seen_v1` уже выставлен). Можно комбинировать с `?demo=1`.
- **`?demo=1&tour=1`** — идеальная ссылка для screencast'а/инвесторской демонстрации: и seed, и гайд.

`?demo=1` безопасен — не трогает реальный баланс / операции, пишет только в localStorage и помечается флагом `aevion_bank_demo_seeded_v1`; повторный переход с параметром не перезаписывает данные пока не сделан Reset.

Если concurrently не установлен в корне — не использовать `npm run dev` из `aevion-core/`, запускать два сервиса отдельно (как выше).

## Error boundary

`/bank` имеет route-level error boundary (`error.tsx`). Если какой-либо client component падает в render, страница показывает red-accent card с Retry / Back-to-home, digest-идентификатором ошибки и `console.error` в DevTools. Backend-данные (balance, operations, audit) не теряются.

## E2E demo sequence для инвестора

Открой `http://localhost:3000/bank?demo=1` (после логина и provision) — сразу видны контакты/цели/recurring/circle/split/gifts.

1. Login (`/auth`) → Bank показывает "Create your AEVION Bank account" → клик → wallet creates.
2. (`?demo=1`) Баннер "Demo data loaded" сверху — подтверждение что seed применён.
3. Top up 500 AEC → balance animates up with a green ▲, CoinTower заполняется на 5 монет, TotalEarnings + EcosystemPulse обновляются, AuditPanel показывает первую QSign-подпись.
4. Переключи currency AEC → USD → EUR → KZT — **всё** (Hero, WalletSummary, TotalEarnings, WealthForecast, RoyaltyStream, ChessWinnings, RecurringPayments, SavingsGoals, SplitBills, SpendingInsights, EcosystemPulse, PeerStanding) пересчитывается универсально.
5. EcosystemPulse — наведи на плитку QRight / Chess / Planet / Banking: hover-lift + "Open QRight →" deep-link.
6. WealthForecast: переключи scenario "Optimistic" → 1 year → видишь projected balance. Под ним ETA до MacBook / Bali / Emergency целей (посевные).
7. TrustScoreCard: progress bar "Growing → Trusted" + "Fastest wins" — top-3 шага до следующего tier.
8. PeerStanding: "Best dimension: X · Top N %" + 4 ряда с peer-median маркером.
9. AchievementsPanel: фильтр по Creator / Security / Banking / Ecosystem. Earned (green ✓) vs locked с прогресс-баром.
10. Add 700 AEC to "Bali" goal → confetti burst + completedAt ставится + goal переходит в "Withdraw all" режим. Achievement "Goal-setter" unlocks.
11. Enable Biometric (Touch ID / Windows Hello) с threshold 100 AEC → Achievement "Biometric shield" unlocks. Попробуй Send 150 AEC — браузер запросит биометрию, потом "Signed & sealed" unlocks.
12. Request salary advance 500 AEC (при tier ≥ growing) → balance +500 animates, outstanding тикает вниз каждые 4s.
13. Ask AI Advisor: "Should I take an advance?" → ответ учитывает balance + trust + outstanding + goals + royalties.
14. ActivityTimeline отмечает "First recipient" / "Large" / "Late night" аномалии по свежим переводам.
15. Export CSV (TransactionList → Export CSV) → скачивается файл с реальными операциями.
16. (опционально) Trigger error — временно кинуть `throw` в каком-нибудь компоненте → error.tsx ловит, показывает Retry + Back-to-home + digest.

## Next session picks

Outstanding choices before we write more code:

1. **Real backend wiring** — координация с backend-сессией, чтобы mock'и постепенно подменить на реальные endpoints. Нужно синхронное планирование (см. "Backend dependencies queue" ниже).
2. **Accessibility audit + Lighthouse** — прогнать по странице, добить красные места (WealthForecast tiles, CoinTower SVG, radar chart alt-text, EcosystemPulse link aria-labels).
3. **Snapshot export** — one-click PNG of your wealth state (balance + trust + achievements + peer standing); viral share coefficient.
4. **Referral program** — "invite and earn X AEC" loop; classic fintech growth lever.
5. **Onboarding tour** — first-visit coach-marks over Total Earnings → Ecosystem Pulse → Trust Score → Achievements so new users know what to click.
6. **Mobile tab bar** — sticky bottom bar for section jumps on <768px (hero / earnings / ecosystem / trust / actions / history).
7. **Open PR** — branch sits at 34 commits unmerged. Create PR draft when ready.

По умолчанию: начни с **п. 1 (backend wiring)** — все mock endpoints уже размечены `// TODO backend:` комментами и перечислены ниже. Frontend side готов дропнуть их как только реальные API придут.

## Important gotchas

- Не ставить `concurrently` в root без разговора — проще держать backend/frontend отдельно (npm run dev в каждой папке).
- WebAuthn работает **только на HTTPS или localhost** — на production нужен сертификат.
- QRight redirect (CTA "Protect your work") ведёт на `/qright` — это другой модуль, не Bank. Бэнк показывает royalties когда они приходят; сама регистрация IP в QRight.
- `navigator.clipboard.writeText` требует secure context и user gesture; fallback ошибки уже обрабатывается toast'ами.
- Gift mode / Circles / Savings / Splits / Recurring — **localStorage only**. Сброс browser-а теряет всё. До выхода на прод — backend-persistence обязательно.
- Коммит-на-фичу + build-green — non-negotiable правило этой сессии (см. CLAUDE.md).
