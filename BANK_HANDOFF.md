# AEVION Bank — Session Handoff (2026-04-22)

Snapshot to pick up work on the bank track. Read this first next session, then [`CLAUDE.md`](./CLAUDE.md) for session rules.

---

## Branch / repo state

- **Worktree:** `C:\Users\user\aevion-core\frontend-bank` (git worktree of ветка `bank-payment-layer` — не отдельное приложение, дерево совпадает со всем `aevion-core`).
- **Ветка:** `bank-payment-layer`.
- **Remote:** `github.com/Dossymbek281078/AEVION`.
- **Last commit:** `f00a26f fix(bank): rename "Register IP" CTAs to remove IP-address ambiguity`.
- **Ahead of `main`:** 20 commits (1 modular rewrite + 18 features + 1 polish fix).
- **PR URL (unmerged):** https://github.com/Dossymbek281078/AEVION/pull/new/bank-payment-layer
- **Build:** green. `cd frontend ; npm run build` проходит за ~2.5s, все 23 route собираются.

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

## Tech debt (tracked, not yet fixed)

1. **Fetch duplication** — TrustScoreCard, RoyaltyStream, ChessWinnings, TotalEarningsDashboard, AdvisorChat, SalaryAdvance каждый вызывает `fetchRoyaltyStream/Chess/Ecosystem` независимо. На mock безболезненно; при реальном HTTP нужен общий cache / `useEcosystemData` hook.
2. **Form primitives duplication** — `Field`, `inputStyle`, `btnSecondary` скопированы в `RecurringPayments`, `SavingsGoals`, `SplitBills`, `GiftMode`, `SocialCircles`. Вынести в `_components/formPrimitives.tsx`.
3. **localStorage hooks шаблон** дублируется (`useRecurring`, `useSavings`, `useSplits`, `useCircles`, `useSignatures`). Обобщить в `useLocalList<T>(key, isItem)`.
4. **Money компонент не везде** — `RecurringPayments`, `SavingsGoals`, `SplitBills`, `SpendingInsights` остались с AEC-only отображением. CurrencySwitcher на них не действует.
5. **Trust Score шкала** — все 8 факторов max 100, одинаковый вес. Реальному юзеру тяжело выйти из "new". Нужны nonlinear thresholds / tier-adaptive weights.
6. **Mock catalog дублируется** — названия QRight works в `ecosystem.ts` и `royalties.ts`. Вынести в `_lib/mockCatalog.ts`.
7. **Audit panel retention** — хранит 50 подписей; нет экспорта в файл. Могут захотеть.
8. **CRLF warnings** на каждом коммите. Добавить `.gitattributes` c `* text=auto eol=lf`.
9. **`useAdvance` auto-repay** — только visual tick (1%/4s). На real ops не реагирует. Надо wire into new incoming transfers.

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
2. Top up 500 AEC → баланс появляется, CoinTower заполняется на 5 монет, TotalEarnings и sparkline обновляются, AuditPanel показывает первую QSign-подпись.
3. Переключи currency на USD/EUR/KZT — Hero, WalletSummary, RoyaltyStream, ChessWinnings, TransactionList все пересчитываются.
4. Enable Biometric (Touch ID / Windows Hello) с threshold 100 AEC. Попробуй Send 150 AEC — браузер запросит биометрию.
5. Create savings goal "MacBook Pro" target 1000, add 200 AEC → прогресс 20%, forecast обновляется.
6. Create recurring "Netflix" 15 AEC weekly → появится в списке, executor запустится через 30s.
7. Create circle с контактом → напиши сообщение → Request 50 AEC → copy link.
8. Send gift с темой Thanks → посмотри preview → Send → gift появляется в sent history.
9. Request salary advance 500 AEC (при tier ≥ growing) → balance +500, outstanding тикает вниз каждые 4s.
10. Ask AI Advisor: "Should I take an advance?" → ответ учитывает балансе + trust + outstanding + goals.
11. ActivityTimeline отмечает "First recipient" / "Large" аномалии по свежим переводам.
12. Export CSV (TransactionList → Export CSV) → скачивается файл с реальными операциями.

## Next session picks

Outstanding choices before we write more code:

1. **Tech debt sprint** (пункты 1-6 выше) — потратить 1-2 часа на рефакторинг прежде чем наращивать фичи.
2. **Phase 5 (если такая будет)** — ещё delight features? Mobile-responsive polish? Empty-state copywriting?
3. **Real backend wiring** — координация с backend-сессией, чтобы mock'и постепенно подменить на реальные endpoints. Нужно синхронное планирование.
4. **Investor-demo script** — рассказ + скринкаст по 12 шагам выше.
5. **Accessibility audit + Lighthouse** — прогнать по странице, добить красные места.

По умолчанию: начни с **п. 1 (tech debt sprint)** — чтобы дальнейшие фичи не тонули в copy-paste.

## Important gotchas

- Не ставить `concurrently` в root без разговора — проще держать backend/frontend отдельно (npm run dev в каждой папке).
- WebAuthn работает **только на HTTPS или localhost** — на production нужен сертификат.
- QRight redirect (CTA "Protect your work") ведёт на `/qright` — это другой модуль, не Bank. Бэнк показывает royalties когда они приходят; сама регистрация IP в QRight.
- `navigator.clipboard.writeText` требует secure context и user gesture; fallback ошибки уже обрабатывается toast'ами.
- Gift mode / Circles / Savings / Splits / Recurring — **localStorage only**. Сброс browser-а теряет всё. До выхода на прод — backend-persistence обязательно.
- Коммит-на-фичу + build-green — non-negotiable правило этой сессии (см. CLAUDE.md).
