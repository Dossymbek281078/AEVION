# AEVION QSign v2 — сессия / worktree

> Создано 2026-04-22. Локальный контекст worktree `aevion-qsign` (отделён от `aevion-core`).
> Родительский контекст AEVION → `C:\Users\user\aevion-core\aevion-globus-backend\CLAUDE.md`.

---

## 0. Что эта сессия делает

**Только QSign v2.**

В фокусе:
- Текущее состояние: `src/routes/qsign.ts` (44 строки) — голый HMAC-SHA256 stub без хранения, без ротации, без публичного verify по id.
- Куда идём (v2, ориентир из корневого CLAUDE.md §4 «Q2 2026 working v1: ключи, цепочки, не только HMAC demo»):
  - хранение подписей (Prisma-модель)
  - публичный эндпоинт verify по signatureId (без знания секрета)
  - Ed25519 digital signature поверх канонического JSON
  - возможно key rotation / key ids
- Конкретный план v2 пишет пользователь. Ждём его, код не трогаем.

## 1. Git

- Worktree: `C:\Users\user\aevion-qsign` (git worktree от `C:\Users\user\aevion-core`)
- Ветка: **`feat/qsign-v2`**
- Main: `main` (PR в main — только с явной просьбы)
- Ничего не коммитим / не пушим без подтверждения.

## 2. Что НЕ трогаем в этой сессии

Эти модули ведутся в других сессиях/ветках. Даже если задача заходит в их файлы — останавливаемся и уточняем.

- **CyberChess** (`frontend/src/app/cyberchess/**`, ветка `cyberchess-v37-redesign` в другом чате)
- **AEVION Bank** (`frontend-bank/**`)
- **QRight** — идёт **параллельно** в сессии `aevion-backend-modules` на ветке **`feat/qright-v2`**. Там сейчас фикс «fake Shamir» и правки `src/routes/pipeline.ts`. Наши изменения QSign **не должны ломать пайплайн и лучше минимизировать касания `pipeline.ts`** — иначе будет merge-конфликт. Если правка QSign требует правки pipeline — сначала согласовать с пользователем.
- **AEVION IP Bureau** (`aevion-ip-bureau`, `bureau` UI) — пока не трогаем, только чтением для понимания QSign-контрактов.
- **Quantum Shield** (`src/routes/quantum-shield.ts`, модель `QuantumShield`)
- **QCoreAI** (`src/routes/qcoreai.ts`, `frontend-qcore/**`)
- **Planet Compliance** (`src/routes/planetCompliance.ts`) — там есть вызов `process.env.QSIGN_SECRET`, но это отдельный контур (snapshot signature, productSecretFor). Если меняем дефолт/схему секрета — учитываем, но этот файл НЕ рефакторим.
- **QTrade, QPayNet, Coach, Auth** — не в фокусе.

## 3. Точки контакта QSign ↔ остальной код

Чтобы v2 не сломал соседей:

| Файл | Использование `QSIGN_SECRET` | Что учесть |
|------|------------------------------|------------|
| `src/routes/qsign.ts` | HMAC sign/verify endpoints | **Наша зона** |
| `src/routes/pipeline.ts` L10, L214-215 | HMAC over `{objectId,title,contentHash,timestamp}` в IPCertificate | Согласовать с `feat/qright-v2` — она трогает этот же файл |
| `src/routes/planetCompliance.ts` L162 | `productSecretFor(productKey)` = `${SECRET}:${productKey}` | Осторожно: если v2 меняет форму секрета, planet отвалится |
| `src/routes/planetCompliance.ts` L1968 | HMAC над vote snapshot | То же |
| `frontend/src/app/qsign/page.tsx` | UI sign/verify, deep-link payload из QRight | Наша зона; контракт ответа `{payload, signature, algo, createdAt}` |

Канонизация JSON: сейчас `JSON.stringify(payload)` **без** стабильной сортировки ключей. Это риск (разный порядок полей ⇒ разная подпись). Pipeline тоже использует обычный `JSON.stringify`. v2, вероятно, должен перейти на stable-stringify (он уже есть в `planetCompliance.ts`).

## 4. Workflow

- **Shell:** Windows / PowerShell. Разделитель команд — `;`, НЕ `&&`. Пример: `npm install ; npx prisma generate ; npm run build`.
- **Редактор пользователя:** Notepad. ASCII/кириллица, без экзотики.
- **Правки:** если в файле меняется больше нескольких строк — выдаём **файл целиком**. Мелкая правка → точный snippet + путь.
- **Пути в сообщениях:** Windows-стиль с `\` (`C:\Users\user\aevion-qsign\...`). В коде — forward slashes.
- **Коммиты / push / reset / удаление файлов** — только с явного подтверждения.

## 5. Definition of Done

- `npm run verify` из корня `C:\Users\user\aevion-core` (backend `tsc` + frontend `next build`) проходит зелёным.
- Локальный smoke: `POST /api/qsign/sign` → `POST /api/qsign/verify` возвращает `valid: true`.
- Если v2 вводит БД/миграцию — миграция применяется чисто, откат описан.
- Не сломан `/api/pipeline/*` и `/api/planet/artifacts/*/public` (smoke существующих эндпоинтов).

## 6. В начале каждой новой задачи в этой сессии

1. Сверить ветку: `feat/qsign-v2`.
2. Проверить, не зашла ли задача в зону «не трогаем» (см. §2). Если зашла — остановиться, уточнить.
3. Перед «готово» — `npm run verify`.
4. Коммит/push только по явной просьбе.

---

## 7. Progress log — roadmap phase status

Стартовая точка: 2026-04-22. Ветка `feat/qsign-v2` в worktree `C:\Users\user\aevion-qsign`.

| Phase | Статус | Commit | Что сделано |
|-------|--------|--------|-------------|
| **P1 Foundation** | ✅ done | `de00f30` | `schema.prisma` +QSignKey/QSignSignature/QSignRevocation · `src/lib/qsignV2/{canonicalize,ensureTables,keyRegistry,types}.ts` · `.env.example` обновлён с `QSIGN_HMAC_V1_SECRET`, `QSIGN_ED25519_V1_PRIVATE/PUBLIC`. RFC 8785 JCS реализован in-house (пакет `canonicalize@3` — ESM-only, несовместим с CJS бэкендом). |
| **P2 Sign/Verify core** | ✅ done | `daf6e04` | `src/routes/qsignV2.ts` монтируется в `/api/qsign/v2` (до legacy `/api/qsign`). POST `/sign` (bearer + HMAC+Ed25519 + persistence), POST `/verify` (stateless, constant-time hex eq), GET `/verify/:id` (DB-backed), GET `/:id/public` (SSR JSON view), GET `/health`. `express.json` limit → 1mb. openapi.json bumped to 0.3.0. |
| **P3 Key registry & rotation** | ✅ done | `295b9be` | GET `/keys` (JWKS-like), GET `/keys/:kid`, POST `/keys/rotate` (admin only). Overlap window: active → retired, новый становится active. Retired ключи верифицируют исторические подписи вечно. Route order исправлен: `/keys/*` регистрируется до `/:id/public`. |
| **P4 Revocation ledger** | ✅ done | `aafeb64` | POST `/revoke/:id`. Permission gate: issuer (`auth.sub === row.issuerUserId`) ИЛИ admin. Транзакционно: INSERT QSignRevocation + UPDATE QSignSignature.revokedAt. Опциональный `causalSignatureId` с валидацией. 409 при повторном revoke. Reserved-id guard в `/:id/public` расширен до `health/verify/keys/revoke/sign`. |
| **P5 Geo-anchoring** | ✅ done | `a74b482` | `npm install geoip-lite @types/geoip-lite`. `src/lib/qsignV2/geo.ts`: IP extraction, private-range filter, GPS sanitize. `resolveGeo(bodyGps, req)` — GPS приоритетнее, IP fallback заполняет country/city. `/sign` принимает `body.gps = { lat, lng }`. Signature row хранит geoLat/Lng/Source/Country/City. |
| **P6 Frontend Studio redesign** | ✅ done | `830181a` | `frontend/src/app/qsign/page.tsx` (190 → 1392 строк): live canonicalization preview, hash-diff, выбор активного kid, показ обеих подписей (HMAC + Ed25519), GPS opt-in. |
| **P7 Public verify page SSR** | ✅ done | `05a5cf8` | `frontend/src/app/qsign/verify/[id]/page.tsx` + `ClientBits.tsx`: SSR, QR-код, OG metadata, shareable link, «revoked» banner, потребляет `/api/qsign/v2/:id/public`. |
| **P8 Key registry UI** | ✅ done | `107bb24` | `frontend/src/app/qsign/keys/page.tsx` (538 строк): таблица ключей + timeline + публичные Ed25519. |
| **P9 Polish** | ✅ done | `0b966de` | `express-rate-limit` на `/sign` (60/min), `/revoke` (10/min), `/keys/rotate` (5/min). README `aevion-globus-backend/QSIGN_V2.md`. Smoke `scripts/qsign-v2-smoke.js`. openapi.json → 0.4.0. |
| **Investor polish** | ✅ done | `2b0cd6b` | Дополнительно: GET `/stats` (live aggregate metrics), GET `/recent?limit=N` (sanitized feed без leak issuerEmail/payloads), sample payload в Studio. |

### Done verification (2026-04-25)

DoD §5 проверен полностью:

- ✅ `npm run verify` (root) — backend tsc + frontend next build, exit 0, 24 страницы включая `/qsign`, `/qsign/keys`, `/qsign/verify/[id]`.
- ✅ `npm run smoke:qsign-v2` (backend) — **ALL PASSED · 14 steps**:
  health → register → login → sign → stateless verify → tampered verify (correctly invalid)
  → DB verify → public view → keys list → stats → recent → revoke → post-revoke verify
  → double revoke (409).
- ✅ Legacy v1 (`/api/qsign/sign|verify`) не сломан — smoke `valid: true`.
- ✅ `pipeline.ts` и `planetCompliance.ts` не тронуты в этой ветке.

Локальная конфигурация для повторного прогона (см. `aevion-globus-backend/.env`, в гит не коммитим):
- `DATABASE_URL` — Postgres 18 на localhost:5432, БД `aevion_dev`.
- `AUTH_JWT_SECRET` задан.
- `QSIGN_HMAC_V1_SECRET` (>= 16 chars) и `QSIGN_ED25519_V1_PRIVATE` (64-hex seed) заданы — больше нет dev-ephemeral warning.

### Что осталось / возможные следующие шаги

Все запланированные фазы P1–P9 + investor polish закрыты, smoke зелёный. По желанию пользователя:

- **Merge → main**: ветка `feat/qsign-v2` готова. PR не открывался — только по явной просьбе.
- **Browser sanity-check** UI Studio / Verify / Keys страниц (next build прошёл, но визуальный smoke — отдельно).
- **Post-MVP идеи** (не в roadmap): Dilithium слот в `signatureDilithium` зарезервирован в БД (всегда NULL), цепочки supersedes по `causalSignatureId` уже хранятся, можно построить chain-of-custody UI; multi-sig / threshold; экспорт публичных ключей в JWKS-формат.
