# Указатель скриптов — что здесь уже есть

**Зачем этот файл.** 29.08.2026 я потратил час на проверку «каталог товаров
против настоящей цены у провайдера» — и потом нашёл здесь готовую
`catalog-vs-checkout.js`, сделанную месяцем раньше и строго лучше моей.
Проверял ли я, нет ли такой? Проверял — но искал в домашней папке и среди
своих скриптов, а сюда не заглянул.

Имена бы и не помогли: мой файл назывался `checkout-price-check`, здешний —
`catalog-vs-checkout`. Ни одного общего слова.

**Как пользоваться.** Прежде чем писать новый инструмент — искать здесь по
ПРЕДМЕТУ, а не по предполагаемому имени:

```
grep -i "gumroad\|price\|checkout" scripts/README-INDEX.md
grep -rl "<слово предметной области>" scripts/
```

**Как обновить** (описания берутся из первого комментария каждого файла, так что
пишите его — иначе скрипт попадёт в список без пояснения):

```
node scripts/build-index.mjs
```

**Важно про охват:** здесь только `scripts/` бэкенда. Отдельно есть обёртки в
домашней папке (`~/aevion-*.mjs`, `~/aevion-*.ps1`) — их этот список не видит.
Смотреть надо в обоих местах.

| скрипт | что делает |
|---|---|
| `aev-smoke.js` | AEV wallet/ledger — end-to-end smoke test. |
| `aevion-rest-prod-smoke.js` | — |
| `airspace-freshness-smoke.ts` | QSkyway — drift detection for the committed FAA airspace snapshot. |
| `all-smokes.js` | AEVION smoke orchestrator — runs every smoke script in sequence against |
| `apikeys-smoke.js` | Platform API Key smoke — verifies /api/keys Phase B surface. |
| `audit-guessed-heights.mjs` | — |
| `audit-height-claims.mjs` | QSkyway — audit the height claims a city twin is built on. |
| `auth-before-db-sweep.mjs` | — |
| `auth-prod-smoke.js` | — |
| `auth-replay-smoke.js` | Auth replay-rejection smoke — covers the security fix shipped in PR #80 |
| `auth-smoke.mjs` | Auth Tier-2 smoke — behavioral tests for sid sessions and logout. |
| `awards-smoke.js` | AEVION Awards — read-shape smoke test. |
| `backup.mjs` | Snapshot the runtime JSON ledger (qtrade.json, ecosystem.json, ...) into |
| `bank-prod-smoke.js` | — |
| `build-index.mjs` | Пересобирает README-INDEX.md — список скриптов этой папки с пояснением. |
| `build-opening-tree.mjs` | AEVION CyberChess — build a deep opening tree from CC0 Lichess game dumps. |
| `build-smoke.js` | QBuild — end-to-end smoke test. |
| `bureau-prod-smoke.js` | Bureau PROD smoke — read-only checks for the AEVION IP Bureau. |
| `catalog-vs-checkout.js` | Сверка каталога товаров с ЖИВЫМИ карточками оплаты. |
| `chain-prometheus.js` | Chain integrity → Prometheus text exporter. |
| `check-persistence-tables.mjs` | Что лежит в базе после переноса — только чтение. |
| `check-prod-env.js` | Pre-deploy environment validator. Reads NODE_ENV; when production, |
| `checkout-rails-prod-smoke.js` | Checkout rails PROD smoke — каскад процессингов + новые каналы PayBox/PayPal. |
| `claims-vs-runtime-smoke.js` | Сверяет ПУБЛИЧНЫЕ УТВЕРЖДЕНИЯ в коде страниц с тем, что отвечает прод. |
| `cleanup-chess-test-rows.mjs` | Уборка синтетических строк из шахматных таблиц прода. |
| `constitution-pro-prod-smoke.js` | constitution-pro-prod-smoke — verify the Constitution Pro gating CONTRACT |
| `constitution-prod-smoke.js` | Constitution prod smoke — end-to-end exercise of the Constitution stack. |
| `coord-update.js` | AEVION coord-doc auto-updater. |
| `copy-cjs-shims.js` | Post-build helper: copies CJS shim files (plain .js next to .ts) from |
| `create-award-season.mjs` | One-shot script: create an AwardSeason via the live API. |
| `csv-safety-test.js` | Проверка lib/csv.ts — защиты CSV-выгрузок. |
| `cyberchess-coach-vs-bank-smoke.js` | — |
| `cyberchess-finalize-smoke.js` | — |
| `cyberchess-prod-smoke.js` | CyberChess PROD smoke — READ-ONLY checks for the live CyberChess API surface |
| `cyberchess-smoke.js` | CyberChess smoke — verifies the chess AEV-reward backend surface. |
| `db_url_test.js` | — |
| `deepsan-smoke.js` | DeepSan smoke test — tasks/focus/stats. |
| `devhub-prod-smoke.js` | DevHub PROD smoke — full coverage of all 8 tabs + 15 media subtabs. |
| `devhub-smoke.js` | DevHub Snippet Shelf smoke test. |
| `ecosystem-events-smoke.js` | Ecosystem events smoke — verifies that each cross-product action that |
| `ecosystem-prod-smoke.js` | Ecosystem PROD smoke — read-only checks for /api/ecosystem/* event-bus |
| `events-store-status-smoke.js` | Проверка eventsStoreStatus на РЕАЛЬНЫХ данных, а не на догадке. |
| `fetch-city-twin.mjs` | — |
| `fetch-faa-airspace.mjs` | QSkyway — ingest FAA UAS Facility Map (UASFM) airspace ceilings for a city twin. |
| `find-facade-pages.mjs` | — |
| `fintech-all-smoke.js` | fintech-all-smoke.js — consolidated smoke test for all 6 AEVION fintech modules. |
| `fintech-cli.mjs` | AEVION fintech CLI — interactive wrapper around the 5 fintech modules. |
| `fintech-cross-module-smoke.mjs` | Fintech Cross-Module Integration Smoke |
| `fintech-flow-smoke.js` | Fintech E2E flow smoke — exercises the full cross-product chain: |
| `fintech-onboarding-guide.mjs` | AEVION fintech onboarding guide — interactive walk-through for new integrators. |
| `fintech-prod-smoke.js` | — |
| `fintech-stats-aggregator.mjs` | Fintech Stats Aggregator — pulls live stats from each fintech module |
| `fintech-uptime-monitor.mjs` | Fintech Uptime Monitor — long-running continuous probe of all 5 fintech |
| `fintech-weekly-report.mjs` | Fintech Weekly Report — generates a markdown report summarizing the |
| `frontend-phantom-audit.mjs` | Frontend phantom-page audit: every module in the registry |
| `gsc-pre-submit-verify.js` | GSC pre-submission verifier — single command operator runs BEFORE clicking |
| `gumroad-verify-sale-test.js` | Проверка verifyGumroadSale() — защиты вебхука от поддельных пингов. |
| `gumroad-webhook-smoke.js` | gumroad-webhook-smoke — exercise POST /api/gumroad/webhook end-to-end. |
| `healthai-prod-smoke.js` | — |
| `healthai-smoke.js` | HealthAI smoke test — quick regression check для основных endpoints. |
| `hub-catalog-smoke.js` | AEVION Hub catalog smoke — verifies GET /api/aevion/catalog returns |
| `hub-full-smoke.js` | AEVION Hub full surface smoke — covers all /api/aevion/* endpoints in |
| `import-lichess-puzzles-dump.mjs` | import-lichess-puzzles-dump.mjs — grow the CyberChess puzzle pool toward |
| `inspect-chess-rows.mjs` | Что именно лежит в шахматных таблицах — только чтение, для решения об уборке. |
| `inspect-tournament-rows.mjs` | Что лежит в таблицах хранения турниров и задачи дня. Только читает. |
| `kids-ai-smoke.js` | Kids AI Content smoke test. |
| `launch-announce-dry.ts` | Сухой прогон рассылки на запуск: КОМУ уйдёт письмо и КАК оно выглядит. |
| `lifebox-smoke.js` | LifeBox smoke test — time-locked capsules. |
| `longevity-smoke.js` | AEVION Longevity — deterministic engine smoke test. |
| `ls-webhook-smoke.js` | — |
| `mapreality-smoke.js` | MapReality smoke test. |
| `migrate-chess-timestamptz.ts` | — |
| `migrate-ecosystem-to-pg.mjs` | One-shot migration: read ecosystem.json (JSON-backed ledger) and load it into |
| `modules-prod-smoke.js` | Modules PROD smoke — guards `/api/modules/status` central registry + |
| `money-health.js` | Здоровье денежного контура — один прогон вместо трёх. |
| `multichat-smoke.js` | Multichat Engine smoke — verifies the QCoreAI multi-session surface. |
| `mvp-concepts-export-csv.js` | MVP concept items → CSV exporter for compliance / audit handoff. |
| `mvp-concepts-prod-smoke.js` | MVP Concepts PROD smoke — read-only checks for 12 ownerless-module |
| `mvp-concepts-prometheus.js` | MVP concepts → Prometheus text exporter. |
| `mvp-concepts-smoke.js` | MVP concept routers smoke — exercises the 10 ownerless-module concept |
| `openapi-completeness-smoke.js` | OpenAPI completeness smoke — validates /api/openapi.json exposes paths |
| `openapi-live-smoke.mjs` | — |
| `ots-smoke.ts` | — |
| `ownerless-mvp-smoke.js` | AEVION ownerless-MVP frontend smoke — verifies the 10 module landings |
| `paddle-prod-smoke.js` | Paddle Billing PROD smoke. |
| `paddle-seed-products.js` | AEVION — Create Paddle products & prices for subscription tiers. |
| `pages-live-smoke.js` | — |
| `paywall-coverage-audit.js` | — |
| `paywall-flip-helper.js` | Paywall flip helper — single command the operator runs to walk through |
| `paywall-policy-smoke.js` | Paywall policy smoke — read-only probe of /api/paywall/policy to confirm: |
| `phantom-endpoint-audit.mjs` | Phantom advertised-endpoint audit: finds /api paths that modules advertise |
| `pipeline-prod-smoke.js` | Pipeline PROD smoke — read-only checks for the orchestration layer |
| `planet-prod-smoke.js` | — |
| `planet-smoke.js` | Planet Compliance — end-to-end smoke test. |
| `planning-waitlist-smoke.js` | Planning Waitlist smoke — verifies POST /api/{module}/waitlist on prod |
| `pricing-prod-smoke.js` | — |
| `prod-module-surface.js` | — |
| `projects-pricing-audit.js` | projects ↔ pricing consistency audit. |
| `psyapp-deps-smoke.js` | PsyApp-Deps smoke test — addiction recovery. |
| `puzzles-seed-upsert-test.mjs` | POST /api/puzzles/seed — засев обязан ОБНОВЛЯТЬ тему у существующих задач. |
| `qai-smoke.js` | QAI smoke test — universal AI assistant. |
| `qbuild-prod-smoke.js` | — |
| `qbuild-seo-smoke.js` | QBuild SEO smoke — verifies the per-page metadata + JSON-LD shipped in |
| `qchaingov-bootstrap.mjs` | One-shot script: seed AEVION QChainGov with 3 launch proposals via the live API. |
| `qchaingov-execute-cron.mjs` | QChainGov execution cron — auto-closes past-deadline proposals and |
| `qchaingov-prod-smoke.js` | QChainGov PROD smoke — read-only checks. |
| `qchaingov-smoke.js` | QChainGov smoke — verifies /api/qchaingov/* surface. |
| `qcontract-prod-smoke.js` | QContract PROD smoke — read-only checks. |
| `qcontract-smoke.js` | QContract smoke test — run against live backend |
| `qcore-autoroute-smoke.js` | QCoreAI "auto" strategy — offline smoke. |
| `qcore-eval.js` | — |
| `qcore-fleet-smoke.js` | QCoreAI free-fleet + council — offline smoke. |
| `qcore-smoke.js` | QCoreAI — end-to-end prod smoke test. |
| `qcoreai-prod-smoke.js` | — |
| `qcoreai-quota-policy-smoke.js` | QCoreAI quota policy smoke — read-only probe of /api/qcoreai/quota-policy |
| `qevents-smoke.js` | QEvents smoke test — events platform: create/list/rsvp/calendar/health. |
| `qfusionai-smoke.js` | QFusionAI smoke test — providers/route/stats. |
| `qgood-smoke.js` | QGood smoke — verifies /api/qgood/* surface. |
| `qjobs-smoke.js` | QJobs smoke test — runs against a live backend. |
| `qlearn-smoke.js` | QLearn smoke test — course platform. |
| `qlife-smoke.js` | QLife smoke test — biomarkers / trends / AI plan. |
| `qmaskcard-prod-smoke.js` | QMaskCard PROD smoke — virtual payment masking. |
| `qmaskcard-smoke.js` | QMaskCard smoke — verifies /api/qmaskcard/* surface. |
| `qmedia-smoke.js` | QMedia smoke test — tracks, playlists, videos. |
| `qnews-smoke.js` | QNews smoke test — public endpoints + auth gates. |
| `qpaynet-backup.mjs` | QPayNet — pure-Node backup of all qpaynet_* tables. |
| `qpaynet-reconcile.mjs` | QPayNet — reconciliation check. |
| `qpaynet-smoke.js` | QPayNet smoke test — run against live backend |
| `qpersona-smoke.js` | QPersona smoke test — persona CRUD + stats. |
| `qreal-prod-smoke.js` | QReal PROD smoke — fully-alive AI video studio (read-only, деньги не тратит). |
| `qrenew-smoke.js` | AEVION QMelanin + QRenew — deterministic engine smoke test. |
| `qright-e2e-smoke.js` | QRight Tier-2 embed E2E smoke — exercises the full public-trust loop against |
| `qright-prod-smoke.js` | QRight PROD smoke — read-only checks for the QRight IP registry. |
| `qshield-prod-smoke.js` | — |
| `qshield-smoke.js` | Quantum Shield — end-to-end smoke test. |
| `qsign-mode-smoke.js` | Offline: проверяет, что health честно называет режим подписи. |
| `qsign-prod-smoke.js` | — |
| `qsign-real-signature-smoke.js` | Offline: доказывает, что путь «выставить ключ» реально работает. |
| `qsign-v2-gen-prod-secrets.js` | QSign v2 — generate production secrets. |
| `qsign-v2-smoke.js` | QSign v2 — end-to-end smoke test. |
| `qskyway-smoke.js` | AEVION QSkyway — deterministic engine smoke test. |
| `qsocial-smoke.js` | QSocial smoke test — social feed, posts, likes, comments, stats. |
| `qstore-dedupe-report.js` | Дубли товаров в QStore: ОТЧЁТ и, по явной просьбе, уборка. |
| `qstore-smoke.js` | qstore-smoke.js — 6 read-only checks for QStore |
| `qtrade-prod-smoke.js` | — |
| `qtradeoffline-smoke.js` | QTradeOffline smoke test — wallet register / transfer sync / leaderboard. |
| `qventure-calibration.ts` | — |
| `qventure-signals-test.ts` | — |
| `qventure-smoke.js` | QVenture smoke test. |
| `qzone-prod-smoke.js` | QZone PROD smoke — read-only checks for QAI, DevHub, QSocial, QMedia. |
| `rebuild-module-probes.js` | — |
| `rebuild-veilnetx-chain.js` | VeilNetX chain rebuild — recomputes `prevHash` and `entryHash` for every |
| `regression-19-08-smoke.js` | Смоук на дефекты, найденные 19.08.2026 — чтобы они не вернулись молча. |
| `restore.mjs` | Restore a previously taken snapshot back into AEVION_DATA_DIR. The current |
| `revenue-internal-consistency-smoke.js` | Витрина показывает выручку из /api/revenue/summary. Своя проверочная |
| `revenue-prod-smoke.js` | Revenue Hub PROD smoke — Gumroad (live) + Paddle + YouTube + Twitch monetization hub. |
| `sample-did-permission.mjs` | — |
| `search-prod-smoke.js` | Universal Search PROD smoke. |
| `seed-bureau.ts` | — |
| `seed-demo-content.js` | AEVION Demo Content Seeder |
| `seed-puzzles.mjs` | Seed ChessPuzzle table from Lichess CC0 puzzle CSV. |
| `shadownet-smoke.js` | ShadowNet smoke test — threat models / routing sim / posts. |
| `smeta-trainer-prod-smoke.js` | Smeta Trainer PROD smoke — read-only checks for the РК сметный тренажёр API |
| `smeta-trainer-smoke.js` | Smeta Trainer smoke — verifies the backend surface for the Kazakh |
| `smoke-db-setup.mjs` | Завести ОТДЕЛЬНУЮ локальную базу под прогон смоуков и напечатать её URL. |
| `smoke-report-on-fail.mjs` | Прогнать смоук и СКАЗАТЬ, если он упал. |
| `smoke-with-server.mjs` | Поднять бэкенд, прогнать смоук, погасить бэкенд — одной командой. |
| `startupx-smoke.js` | Startup Exchange smoke test. |
| `stripe-verify.mjs` | Stripe verification — checks that Stripe live-mode is fully configured. |
| `sync-qcore-benchmark.js` | Copies the curated `historical` benchmark entries from |
| `tier3-smoke.js` | Tier 3 amplifier surface — end-to-end smoke test. |
| `trust-anchor-smoke.ts` | Smoke: AEVION Trust Score OpenTimestamps (Bitcoin) anchoring. |
| `trust-signature-smoke.ts` | Smoke: AEVION Trust Score Ed25519 attestation. |
| `veilnetx-chain-doctor.js` | VeilNetX chain doctor — diagnoses chain integrity over the HTTP API. |
| `veilnetx-chaos-smoke.js` | VeilNetX CHAOS smoke — bursty parallel writes + chain integrity regression |
| `veilnetx-export-csv.js` | VeilNetX entries → CSV exporter for compliance / audit handoff. |
| `veilnetx-ledger-smoke.js` | VeilNetX Ledger smoke — verifies /api/veilnetx-ledger/* surface. |
| `veilnetx-smoke.js` | VeilNetX smoke test — runs against a live backend. |
| `veilnetx-stats.js` | VeilNetX stats — read-only report on the settlement ledger. |
| `verify-adopt-from-db-live.ts` | Доказать, что состояние ПОДНИМАЕТСЯ ИЗ БАЗЫ при старте. На настоящей базе. |
| `verify-daily-across-days-live.ts` | Возврат на второй день: разные дни дают разные задачи, один день — одну и ту |
| `verify-daily-playable-live.ts` | Задачу дня можно РЕШИТЬ. На настоящем банке. |
| `verify-daily-write-live.ts` | Доказать, что задача дня ДЕЙСТВИТЕЛЬНО пишет в Postgres. На настоящей базе. |
| `verify-money-path-live.ts` | Доказать, что начисление Chessy доходит до базы. На НАСТОЯЩЕМ Postgres, но |
| `verify-persistence-sql.mjs` | Проверка SQL переноса хранилищ на НАСТОЯЩЕМ Postgres. |
| `verify-tournaments-write-live.ts` | Доказать, что турниры ДЕЙСТВИТЕЛЬНО пишутся в Postgres. На настоящей базе. |
| `voe-smoke.js` | Voice of Earth smoke test. |
| `wait-for-deploy.js` | Wait-for-deploy — polls a target deployment until a chosen probe path |
| `waitlist-unsub-smoke.js` | AEVION waitlist unsubscribe smoke — verifies one-click unsub flow on a |
| `webhook-sig-smoke.js` | webhook-sig-smoke — exercise webhookSig.ts sign+verify roundtrip locally. |
| `write-build-info.js` | Пишет dist/build-info.json во время сборки, чтобы /health мог назвать |
| `ztide-audit.js` | Z-Tide audit — read-only sanity walker over the leaderboard. |
| `ztide-event-integrity.js` | Z-Tide event integrity — cross-checks aggregate consistency between |
| `ztide-smoke.js` | Z-Tide smoke — verifies /api/ztide/* surface. |
