# AEVION Bureau — Working Version Handoff (24 апреля 2026)

## Статус: ✅ Рабочая версия

Bureau v2 собран, рабочий end-to-end, криптографические гарантии реализованы и проверены, prod-режим протестирован.

## Что сделано в этой сессии

### 1. Полноценная криптографическая reverification в `/api/pipeline/verify/:certId`
До: `valid: true` возвращалось по факту наличия записи — без реальной проверки подписей.
Сейчас:
- `contentHashValid` — валидность формата (64-hex SHA-256).
- `signatureHmacValid` + `signatureHmacReason` — HMAC-SHA256 над `{objectId, title, contentHash}` пересчитывается с `QSIGN_SECRET` и сравнивается с сохранённой подписью. `reason`: `OK`, `mismatch`, `seed`, `not_checked`.
- `signatureEd25519Valid` + `signatureEd25519Reason` — Ed25519 подпись проверяется `crypto.verify` против сохранённого `publicKey` над канонической payload-строкой. `reason`: `OK`, `mismatch`, `seed`, `error: <msg>`.
- `seed: true/false` — seed-сертификаты (при бутстрапе in-memory store) корректно помечаются и `valid: true` для них означает "валидны как seed".
- `valid` в топ-уровне теперь вычисляется как `hashValid && signatureHmacValid && signatureEd25519Valid`.

### 2. Детерминированные подписи
Подписи (HMAC и Ed25519) теперь формируются над стабильными полями (без `timestamp: Date.now()`). Это позволяет любому аудитору переподтвердить подписи — раньше подписи нельзя было переподтвердить вообще, т.к. timestamp не сохранялся. Для новых сертификатов подпись reverify'ится; seed-записи помечаются соответствующим `reason: seed`.

### 3. Улучшенный контракт `/api/pipeline/protect`
Теперь принимает:
- `authorName` / `authorEmail` — канонический публичный контракт.
- `ownerName` / `ownerEmail` — legacy-алиасы (для совместимости с существующим фронтом QRight).
- `contentHash` — опциональный заранее посчитанный SHA-256 (случай "хэшировал файл локально, не хочу отправлять содержимое"). Валидируется на формат, при невалидном значении молчаливо откатывается на вычисленный из метаданных. Это разблокирует "sign-a-file" сценарий для внешних API-консьюмеров.
- OpenAPI-summary в `/api/openapi.json` обновлена.

### 4. Lint
В Bureau-scope (bureau/verify/qright/main page + lib) — 0 ошибок, 0 warnings. Починены:
- `<a href="/...">` → `<Link />` в `verify/[id]/page.tsx` (3 замены).
- `<img>` для QR-кода — ESLint-disable с пояснением (QR рендерится как data-URL, `next/image` избыточен).
- `signatureHmacReason`/`Ed25519Reason` добавлены в integrity response (фронт их пока не использует, но готов).

### 5. Обнаружен и задокументирован Git Bash MinGW-баг
При сборке фронта в Git Bash переменная вида `NEXT_PUBLIC_API_BASE_URL=/api-backend` молча конвертируется в `C:/Program Files/Git/api-backend` (MSYS POSIX-path translation), что ломает `getApiBase()` — fetch в `generateMetadata` падал тихо, страница verify теряла динамическое OG-метадата. **Решение:** не устанавливать `NEXT_PUBLIC_API_BASE_URL` при сборке из Git Bash — дефолтного поведения (браузер → `/api-backend` rewrite, SSR → `API_INTERNAL_BASE_URL`) достаточно.

## Как запустить локально

```bash
# Backend
cd aevion-globus-backend
npm install && npm run build
PORT=4001 node dist/index.js

# Frontend (dev, turbopack)
cd frontend
npm install
BACKEND_PROXY_TARGET=http://127.0.0.1:4001 \
API_INTERNAL_BASE_URL=http://127.0.0.1:4001 \
npx next dev --port 3002 --turbopack

# Frontend (prod)
BACKEND_PROXY_TARGET=http://127.0.0.1:4001 \
API_INTERNAL_BASE_URL=http://127.0.0.1:4001 \
npm run build
BACKEND_PROXY_TARGET=http://127.0.0.1:4001 \
API_INTERNAL_BASE_URL=http://127.0.0.1:4001 \
npx next start --port 3002
```

Важные вещи:
- `next dev` не уважает `PORT=` env → используем `--port 3002`.
- НЕ ставьте `NEXT_PUBLIC_API_BASE_URL=/api-backend` из Git Bash — MinGW переведёт это в Windows-путь. Без этой переменной всё работает.
- Для работы без Postgres достаточно не задавать `DATABASE_URL` (или задать `AEVION_FORCE_MEMORY_PIPELINE=1`) — in-memory store с 8 seed-сертификатами.

## Smoke, который проходит end-to-end (prod-режим)

- POST `/api/pipeline/protect` с `authorName` → cert создан, author пишется корректно.
- GET `/api/pipeline/verify/:certId` → `valid:true`, HMAC `OK`, Ed25519 `OK`, seed `false`.
- GET `/api/pipeline/bureau/proof/:certId` → Merkle proof переподтверждается клиентом (Python SHA-256 chain) и совпадает с `bureau/anchor.merkleRoot`.
- GET `/api/pipeline/certificate/:id/pdf` → `application/pdf`, 200.
- GET `/api/pipeline/badge/:id` → `image/svg+xml`, 200.
- GET `/api/pipeline/certificates.csv` → `text/csv`, 200.
- GET `/verify/:id` (Next SSR) → динамический `<title>` и OG/Twitter meta с реальными данными сертификата.
- GET `/bureau` → 200, содержит "AEVION Digital IP Bureau", "Protected by AEVION", "Merkle".

## Что из прежнего handoff'а НЕ трогалось
Пункты 3–4 из `AEVION_HANDOFF_2026-03-24.md` (mobile sticky vote bar на planet, SEO для planet artifact pages) — вне скоупа Bureau. Если нужно, делаем следующим заходом.

## Следующие шаги (опционально)
- Добавить Postgres-режим в smoke (нужен живой PG + `DATABASE_URL`).
- Прикрутить фронт для показа `signatureHmacReason`/`Ed25519Reason` (сейчас бэк уже отдаёт, фронт игнорирует).
- Ещё 98 ESLint errors в других модулях (cyberchess/awards/planet) — не блокируют Bureau, но стоит вычистить.
