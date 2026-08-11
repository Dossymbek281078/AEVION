# Paywall flip readiness

> **🟢 LIVE since 2026-07-01.** The paywall is switched ON in prod. `PAYWALL_MODULES=qfusionai,multichat-engine,healthai,qai,qlearn,qnews` (6 AI-compute modules with real per-request OPEX). Each returns `402 upgrade_required` to free traffic → `<PaywallScreen>`/`<PaywallModal>` → `/pricing` → **real LemonSqueezy checkout** (payout Payoneer→KZ). Verified live on `/api-backend/api/<module>/…`.
>
> **Deliberately NOT gated by the blanket module paywall:** `qcoreai`, `qright`/`qsign` (all three: Free tier promises a quota/1-of-choice access that the all-or-nothing `requireModule()` gate would break outright), and `cyberchess`/`smeta-trainer`/`qbuild`/`constitution*` (own gate / active parallel dev, excluded from `MODULE_GATE_PREFIXES`). Ecosystem/infra modules left open on purpose to keep the "open planet" demo intact during acquisition talks. Expand `PAYWALL_MODULES` when ready — but `qcoreai`/`qright`/`qsign` can never go in it, see below.
>
> **🔒 Incident + hardening (2026-07-16/20, PR #693):** `qcoreai` briefly went live in `PAYWALL_MODULES` for ~44min via a manual Railway flip that didn't cross-check this doc first — it 402'd free-tier users who hadn't touched their promised quota. Caught via prod smoke, reverted, and now backstopped in TWO places so it can't recur silently: `planGate.ts`'s `UNSAFE_TO_GATE` set **permanently** strips `qcoreai`/`qright`/`qsign` from the blanket module gate regardless of what `PAYWALL_MODULES` says (with a one-time `console.error` if the env var tries to include one anyway), and `paywall-policy-smoke.js` asserts the same invariant independently, wired into the daily 08:00 UTC prod smoke (`all-smokes.js`). `UNSAFE_TO_GATE` is not a placeholder to remove later — the blanket gate is fundamentally the wrong tool for a module with a quota promise; see the token-metering entry below for the *right* tool, which is a separate mechanism entirely.
>
> **✅ qcoreai token-metering — already shipped and LIVE (PR #463, `lib/qcoreQuota.ts`).** This is a *different* mechanism from the module paywall above: `enforceFreeTokenQuota()` is wired directly into qcoreai's 5 token-spending routes and enforces exactly the advertised promise — free-tier users get 100 000 tokens/mo (`QCOREAI_FREE_TOKENS_PER_MONTH`, counts every provider, free-fleet included, matching the plain "100k tokens/mo" wording — it is not scoped to paid-provider spend only), then `402 upgrade_required`. Paid tiers (medium+) and anonymous callers bypass it; it fails open on any metering error. **Confirmed live on Railway 2026-07-20: `QCOREAI_FREE_QUOTA=1`.** This does NOT interact with `UNSAFE_TO_GATE` — that set governs the separate blanket module gate, which stays permanently off for these three modules regardless of this quota mechanism's state.

> Operator checklist for turning the platform-wide module paywall on. The gate code (`planGate.ts`) shipped dormant in PR #434; the frontend UX (`PaywallScreen`, `lib/paywall.ts`) and a probe smoke (`paywall-policy-smoke.js`) shipped in PR #438 / #441 and the followup expand-PR. **PR #439** then mounted `requireModule()` on *every* monetised module (centralised `MODULE_GATE_PREFIXES` map in `src/index.ts`) — excluding `globus` (free), `cyberchess*`, `smeta-trainer`, `qbuild/build`, `constitution*` (own gate) — and added a **global `<PaywallModal>`** + `window.fetch` interceptor so a 402 surfaces an upgrade prompt from *any* module even if its page wasn't individually wired with `<PaywallScreen>`. Until `PAYWALL_MODULES` env is set on Railway, every `requireModule()` call is a no-op.
>
> **Payout rail is live:** revenue is collected via Gumroad (the only KYC-passed Merchant of Record) and paid out via **Payoneer → KZ** (Payoneer account approved 2026-06-25). A flip now produces money that actually reaches the founder.
>
> **Recommended first flip (real OPEX first):** `PAYWALL_MODULES=qcoreai,qfusionai,multichat-engine,healthai` — the AI-compute modules where each request has marginal cost. Expand from there.

## TL;DR

```bash
# 1. confirm current state (must say "enforced: 0" on dormant)
node aevion-globus-backend/scripts/paywall-policy-smoke.js

# 2. flip one module on Railway preview
#    Railway → service → Variables → add PAYWALL_MODULES=qcoreai

# 3. confirm flip landed
EXPECT_ENFORCED=qcoreai node aevion-globus-backend/scripts/paywall-policy-smoke.js

# 4. manual UX check
#    log in as a free-tier user → open /qcoreai/playground
#    expect <PaywallScreen> instead of the playground

# 5. promote to prod
#    same env on prod Railway, run smoke again with EXPECT_ENFORCED set
```

## What's wired

| Surface | Module | Wired at | Reads policy from |
|---|---|---|---|
| Backend gate | `requireModule()` mounted on ALL monetised modules (`MODULE_GATE_PREFIXES`, PR #439) | dormant until env | `MODULES_PRICING.includedIn` |
| Backend introspection | `GET /api/me/entitlements`, `GET /api/paywall/policy` | always live | same |
| Frontend UI (per-page) | `<PaywallScreen>` + `fetchOrPaywall`/`apiFetchOrPaywall` helpers | on 7+ pages (qcoreai, qcoreai/playground, qfusionai, multichat-engine, healthai, smeta-trainer, cyberchess) | the 402 response payload |
| Frontend UI (global) | `<PaywallModal>` + `window.fetch` interceptor (PR #439) | always live, app-wide | the 402 response payload |
| Audit | `npm run audit:projects-pricing` (CI gate) | every PR | `projects.ts` ↔ `pricing.ts` |
| Daily smoke | `qbuild-seo` (verifies SEO didn't regress) | `prod-readonly-sweep` | live `aevion.app` |

## Pre-flip checklist (one-time)

> **Состояние на 11.08.2026 — проверено, не переписано с прошлого раза.** Три из пяти
> пунктов зелёные прямо сейчас; четвёртый — ваше решение, пятый выполняется после флипа.
> Технических препятствий к включению не осталось.
>
> | Пункт | Проверка | Результат |
> |---|---|---|
> | Аудит модулей | `npm run audit:projects-pricing --prefix aevion-globus-backend` | ✅ exit 0, у каждого модуля есть строка в `MODULES_PRICING` |
> | Смок политики | `BASE=… node aevion-globus-backend/scripts/paywall-policy-smoke.js` | ✅ 5/5, `enforcedCount: 0`, схема стабильна, ни один `UNSAFE_TO_GATE` не включён |
> | UX рекомендованного первого флипа | разбор кода без комментариев + флип `qfusionai` вживую | ✅ 3 из 4 дают страничную стену, `qfusionai` — глобальную модалку (осознанно) |
> | Тарифы в 402 против `/pricing` | ответ смока `requiredTiers: [lite, medium, full, enterprise]` | ✅ `/pricing` рендерит все тарифы из бэкенд-реестра (страница отдаёт 200, проверено вживую) |
> | Стратегия включения | — | ⏳ решение основателя: список, `*` или по одному модулю в день |
>
> **UX проверен вживую 11.08 — и работает НЕ так, как можно решить по грепу.** Поднял
> бэкенд с `PAYWALL_MODULES=qfusionai`: политика показала `enforcedCount: 1`, анонимный
> запрос к `/api/qfusionai/stats` вернул **402** с полной нагрузкой
> (`requiredTiers: [full, enterprise]`, ссылка на `/pricing`, человеческое сообщение).
> Контур отказа работает.
>
> А вот страница `/qfusionai` при этом отдала **200 и обычный контент**, без стены. Это
> НЕ баг, а два осознанных решения, которые стоит знать до флипа:
> 1. `planGate` намеренно оставляет открытыми `/health` и introspection-подпути на закрытом
>    модуле; страница опрашивает именно health, поэтому рендерится нормально;
> 2. в `qfusionai/page.tsx` прямым текстом написано: страничный `<PaywallScreen>` там
>    сознательно НЕ рисуется, потому что вместе с глобальной модалкой получался экран со
>    стеной и модалкой поверх. Отказ показывает глобальный `<PaywallModal>` при
>    клиентском вызове платной ручки.
>
> Отсюда поправка к моей же строке выше: греп `PaywallScreen` по `qfusionai/page.tsx`
> находит совпадение — **внутри комментария о том, что стена там не рисуется**. Проверять
> надо запросом страницы либо разбором кода С ВЫРЕЗАННЫМИ комментариями, а не голым грепом.
>
> **Пересчитал вживую, и вывод другой, чем по коду.** Из 15 страниц, где упоминается
> компонент, его действительно рендерят 14 (греп по коду с вырезанными комментариями).
> Но рендер-ветка срабатывает, только если ОПРАШИВАЕМАЯ страницей ручка вернула 402 — а
> **13 из 14 опрашивают `/api/<модуль>/health`**, который `isExemptPath()` намеренно
> оставляет открытым на закрытом модуле. Проверено запуском: с `PAYWALL_MODULES=healthai`
> API отдаёт 402, а `/healthai` — 200 и обычную страницу.
>
> | Что открывает бесплатный пользователь | Что он увидит при включённом гейте |
> |---|---|
> | Лендинги модулей (`/healthai`, `/qcoreai`, `/qskyway`, `/smeta-trainer`, `/multichat-engine`, `/qrenew/report`, `/qmelanin/track` …) | обычную страницу — их проба идёт в открытый `/health` |
> | `/qcoreai/playground` | **страничную стену** — он зовёт реально закрытый `/api/qcoreai/chat` |
> | Любой платный вызов из интерфейса | глобальную модалку `<PaywallModal>` |
>
> Практический вывод для флипа: шаг 4 runbook'а («открыть `/qcoreai/playground` → ждать
> `<PaywallScreen>`») **верен именно для этой страницы** и не переносится на лендинги.
> Лендинги останутся публичными витринами — это разумно само по себе, но проверять по ним
> «сработал ли гейт» нельзя: они выглядят одинаково до и после флипа. Смотреть на ответ
> API либо на playground.
>
> **Что уже покрыто автотестами, а что действительно требует глаз.** Контракт отказа
> проверяется машиной, а не только руками: `tests/paywallProvisionFlow.test.ts` держит
> «бесплатному отказано корректным 402», «после оплаты тот же пользователь проходит»,
> «истёкшая подписка снова даёт 402» и «Lite открывает ТОЛЬКО выбранный модуль»;
> `tests/planGate.test.ts` — вывод политики из `MODULES_PRICING`, включение по списку и по
> `*`, и регрессию на инцидент 16.07 (`UNSAFE_TO_GATE` не включается даже явным списком).
> То есть ручной шаг 4 добавляет ровно одно: как стена ВЫГЛЯДИТ. Логика отказа уже
> под тестами.
>
> Смок гонялся против локально поднятого бэкенда, а не против прода: доступа к прод-адресу
> из этой сессии нет. Перед реальным флипом прогоните его ещё раз с прод-BASE — форма
> ответа и «dormant» подтверждены, а вот состояние именно прод-инстанса нет.


- [ ] `npm run audit:projects-pricing --prefix aevion-globus-backend` exit 0 — every module has a `MODULES_PRICING` row
- [ ] `node aevion-globus-backend/scripts/paywall-policy-smoke.js` exit 0 — endpoint up, schema stable, **enforced: 0** in prod today
- [ ] (Optional since PR #439) Confirm modules you plan to enforce have a `<PaywallScreen>`-wired page for the *best* UX. Grep: `grep -l PaywallScreen frontend/src/app/<module>/`. Modules without one still get the global `<PaywallModal>` overlay on 402 — no module is left with a silent failure.
- [ ] Confirm `/pricing` page lists the tiers the 402 response will name (`lite`/`medium`/`full`/`enterprise`). The CTA in `PaywallScreen` deep-links to `upgradeUrl` from the backend.
- [ ] Decide enforcement strategy: comma list (`qcoreai,qfusionai`), wildcard (`*`), or stepwise rollout (one module per day for a week)
- [ ] **After the flip: run `BASE=https://aevion.app/api-backend node aevion-globus-backend/scripts/all-smokes.js`.** The 2026-07 flip silently broke 8 module smokes for a day — they treated the gate's 402 as failure. Smokes are paywall-aware since PR #804/#825 (`scripts/lib/paywallAware.js` verifies the 402 contract; fully-gated modules self-skip functional checks), but any NEW module smoke must use the same helper, and only a post-flip suite run proves it.

## The flip (per-module)

### Railway preview (dry-run)

**Recommended flow** — start the wait-mode probe BEFORE flipping the env, so the script tells you the moment the deploy lands:

```bash
# Terminal 1 — start watching (will block until the expected state matches)
BASE=https://<preview>.up.railway.app \
  EXPECT_ENFORCED=qcoreai \
  node aevion-globus-backend/scripts/paywall-policy-smoke.js --wait
# polls /api/paywall/policy every 10s, exits 0 when enforced set matches.
# default timeout 5 min — bump with WAIT_TIMEOUT_MS=900000 if Railway is slow.

# Terminal 2 — set the env on Railway
# 1. Open Railway dashboard → service → Variables
# 2. Add: PAYWALL_MODULES=qcoreai
# 3. Redeploy (Railway picks it up automatically; manual redeploy is a safe shortcut)
```

When Terminal 1 prints `✓ enforced set matched after wait`, the flip is live. Then:

```bash
# 4. UX check on the preview frontend
#    Log in as free-tier → /qcoreai/playground → expect <PaywallScreen>
#    with chips medium/full/enterprise → CTA navigates to /pricing.

# 5. Belt-and-braces: re-run the full check (no --wait)
BASE=https://<preview>.up.railway.app \
  EXPECT_ENFORCED=qcoreai \
  node aevion-globus-backend/scripts/paywall-policy-smoke.js
# expected: "5 passed, 0 failed"
```

If anything is off, `PAYWALL_DISABLED=1` is the kill switch (§"The unflip"). Reversible in <2 min.

### Prod (after preview is good)

Same steps against prod Railway. Add an Uptime/Sentry alert on `/api/paywall/policy` 5xx so a regression in the policy resolver pages someone.

## The unflip (kill switch)

```bash
# nuclear option — disables enforcement everywhere, regardless of PAYWALL_MODULES
PAYWALL_DISABLED=1
```

Set this env on Railway → redeploy. Confirms with:
```bash
node aevion-globus-backend/scripts/paywall-policy-smoke.js
# expect: enforcedCount === 0 (even with PAYWALL_MODULES set)
```

The dormant-by-default + global kill-switch combo means a bad flip is reversible in <2 min — same window as a deploy.

## Common pitfalls

- **402 returned but no UX shown** → the page is calling `fetch` directly. Switch to `fetchOrPaywall` (RSC) or `apiFetchOrPaywall` (client). The full list of wired pages is in §"What's wired".
- **Smoke says enforced but UI works** → the `requireModule()` middleware isn't mounted on that route. `src/index.ts` should have `app.use("/api/<module>", requireModule("<module>"), <router>)`.
- **Lite-tier users blocked when they shouldn't be** → check `chosenModules` is being persisted on the subscription. `planGate.isModuleEntitled` checks `plan.chosenModules.includes(moduleId)` for Lite.
- **`/me/plan` and `/me/entitlements` 402** → exempted by design (`isExemptPath`). If they're 402'ing, the middleware version isn't from PR #434+.

## Where the policy is defined

- `aevion-globus-backend/src/lib/planGate.ts` — middleware + entitlement resolver
- `aevion-globus-backend/src/data/pricing.ts` — `MODULES_PRICING[].includedIn` (single source of truth)
- `aevion-globus-backend/src/routes/entitlements.ts` — `/me/entitlements` + `/paywall/policy`

To change the policy: edit `includedIn` in `pricing.ts`, ship a PR. The CI audit job will fail if a new module shows up in `projects.ts` without a pricing row.
