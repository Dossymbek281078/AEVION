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
