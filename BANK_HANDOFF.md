# AEVION Bank — Session Handoff (last updated 2026-04-23)

Snapshot to pick up work on the bank track. Read this first next session, then [`CLAUDE.md`](./CLAUDE.md) for session rules.

---

## Branch / repo state

- **Worktree:** `C:\Users\user\aevion-core\frontend-bank` (git worktree of ветка `bank-payment-layer` — не отдельное приложение, дерево совпадает со всем `aevion-core`).
- **Ветка:** `bank-payment-layer`.
- **Remote:** `github.com/Dossymbek281078/AEVION` — pushed through `3b9b6f7`.
- **Last commit:** `3b9b6f7 feat(bank): animated balance ticker + direction indicator`.
- **Ahead of `main`:** 28 commits (1 modular rewrite + 21 features + 5 refactors + 1 polish).
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

Still open:
7. **Audit panel retention** — хранит 50 подписей; нет экспорта в файл.
9. **`useAdvance` auto-repay** — только visual tick (1 %/4s). На real ops не реагирует. Надо wire into new incoming transfers.
10. **Mobile responsive polish** — WealthForecast + Achievements на &lt;480px тесно. Grid minmax нужно подправить.
11. **AchievementsPanel: shared refresh signal** — сейчас polls every 15s + focus/storage events. Было бы чище: emit events из useSavings/useSplits/useCircles/useSignatures по записи в storage.

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

Open: **http://localhost:3000/bank**

Если concurrently не установлен в корне — не использовать `npm run dev` из `aevion-core/`, запускать два сервиса отдельно (как выше).

## E2E demo sequence для инвестора

1. Login (`/auth`) → Bank показывает "Create your AEVION Bank account" → клик → wallet creates.
2. Top up 500 AEC → balance animates up with a green ▲, CoinTower заполняется на 5 монет, TotalEarnings + WealthForecast sparkline обновляются, AuditPanel показывает первую QSign-подпись.
3. Переключи currency на USD/EUR/KZT — **всё** (Hero, WalletSummary, RoyaltyStream, ChessWinnings, TransactionList, RecurringPayments, SavingsGoals, SplitBills, SpendingInsights, WealthForecast) пересчитывается универсально.
4. Посмотри WealthForecast: переключи scenario "Optimistic" → 1 year → видишь proyected balance. Включи один goal → появляется ETA к calendar-дате.
5. Enable Biometric (Touch ID / Windows Hello) с threshold 100 AEC → Achievement "Biometric shield" unlocks. Попробуй Send 150 AEC — браузер запросит биометрию, потом появится "Signed & sealed" achievement.
6. Create savings goal "MacBook Pro" target 1000, add 200 AEC → прогресс 20%, forecast обновляется, WealthForecast ETA появляется.
7. Create recurring "Netflix" 15 AEC weekly → появится в списке, executor запустится через 30s.
8. Create circle с контактом → напиши сообщение → Request 50 AEC → copy link → achievement "Circle host" unlocks.
9. Send gift с темой Thanks → посмотри preview → Send → gift появляется в sent history.
10. Request salary advance 500 AEC (при tier ≥ growing) → balance +500, outstanding тикает вниз каждые 4s.
11. TrustScoreCard: посмотри progress bar "Growing → Trusted" + "Fastest wins" — список шагов до следующего tier.
12. AchievementsPanel: фильтр по Creator / Security / Banking / Ecosystem. Видны earned (green ✓) vs locked с прогресс-баром.
13. Ask AI Advisor: "Should I take an advance?" → ответ учитывает balance + trust + outstanding + goals.
14. ActivityTimeline отмечает "First recipient" / "Large" аномалии по свежим переводам.
15. Export CSV (TransactionList → Export CSV) → скачивается файл с реальными операциями.

## Next session picks

Outstanding choices before we write more code:

1. **Real backend wiring** — координация с backend-сессией, чтобы mock'и постепенно подменить на реальные endpoints. Нужно синхронное планирование (см. "Backend dependencies queue" ниже).
2. **Mobile responsive pass** — `<480px` checks on WealthForecast, AchievementsPanel, TrustScoreCard radar. Grid minmax tuning, possibly a mobile bottom-tab-bar for section jumps.
3. **Accessibility audit + Lighthouse** — прогнать по странице, добить красные места (WealthForecast tiles, CoinTower SVG, radar chart alt-text).
4. **Investor-demo script** — scripted `?demo=1` mode that seeds recurring/goals/circles/signatures so the page is always full; great for screencasts.
5. **Snapshot export** — one-click PNG of your wealth state (balance + trust + achievements); viral share coefficient.
6. **Referral program** — "invite and earn X AEC" loop; classic fintech growth lever.

По умолчанию: начни с **п. 2 (mobile pass)** — чтобы демо на телефоне не ломалось.

## Important gotchas

- Не ставить `concurrently` в root без разговора — проще держать backend/frontend отдельно (npm run dev в каждой папке).
- WebAuthn работает **только на HTTPS или localhost** — на production нужен сертификат.
- QRight redirect (CTA "Protect your work") ведёт на `/qright` — это другой модуль, не Bank. Бэнк показывает royalties когда они приходят; сама регистрация IP в QRight.
- `navigator.clipboard.writeText` требует secure context и user gesture; fallback ошибки уже обрабатывается toast'ами.
- Gift mode / Circles / Savings / Splits / Recurring — **localStorage only**. Сброс browser-а теряет всё. До выхода на прод — backend-persistence обязательно.
- Коммит-на-фичу + build-green — non-negotiable правило этой сессии (см. CLAUDE.md).
