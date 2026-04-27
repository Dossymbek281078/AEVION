# AEVION Bureau — CLAUDE.md (контекст этой сессии)

> Last updated 2026-04-27. Источник истины по общему AEVION — `aevion-globus-backend/CLAUDE.md` в основном репо `aevion-core`. Этот файл — рабочие правила для bureau-сессии.

---

## 0. Scope

Этот worktree (`C:\Users\user\aevion-bureau`, branch `feat/bureau-v2`) — **только Bureau v2**. Работаем над:

- `frontend/src/app/bureau/page.tsx` — каталог сертификатов, поиск, фильтры, file hash checker, batch checker, live activity, KPI grid, pricing.
- `frontend/src/app/bureau/layout.tsx` — динамические OG/Twitter meta из `/api/pipeline/bureau/stats`.
- `frontend/src/app/verify/[id]/page.tsx` — public verify-страница (cryptographic proof + share + Merkle proof + downloads + verify-another).
- `frontend/src/app/verify/[id]/layout.tsx` — динамическая OG-метадата per cert.
- `aevion-globus-backend/src/routes/pipeline.ts` — все `/api/pipeline/*` endpoints (protect, verify, bureau/stats, bureau/anchor, bureau/proof, certificates[?q&kind&sort&limit][.csv], certificate/:id/pdf, badge/:id, lookup/:hash, health).
- `aevion-globus-backend/src/lib/pipelineMemoryStore.ts` — in-memory fallback с 8 seed-сертификатами.

**Чужая территория для этой сессии — не трогаем:**

- Bank UI (`frontend/src/app/bank/`, `_components/`, `_lib/`, `_hooks/`) — bank-payment-layer track.
- QRight, QSign, Awards, Planet, CyberChess, QCoreAI, QTrade, Multichat, Globus и т.д. — отдельные сессии.
- Корневые `AEVION_*.md` (handoff/concept/spec) — read-only для контекста.

## 0.1. Workflow

- **Shell:** bash (Git Bash под Windows). В сообщениях пользователю (PowerShell/Notepad) — разделитель `;`, не `&&`.
- **Пути в сообщениях:** Windows-стиль с `\`. В коде — forward slashes.
- **Коммиты:** conventional, по фиче. Build-green gate: `cd frontend && npx tsc --noEmit` exit 0 перед коммитом.
- **Push:** в `feat/bureau-v2` после каждого зелёного коммита (не дожидаясь PR-review).
- **PR в `main`:** только по явной просьбе пользователя.
- **Destructive ops** (`reset --hard`, `--force`, удаление файлов) — только с подтверждения.

## 0.2. Local run gotcha (⚠️ важно)

Не ставить `NEXT_PUBLIC_API_BASE_URL=/api-backend` при запуске из Git Bash — MinGW транслирует это в `C:/Program Files/Git/api-backend` (POSIX path translation), что ломает SSR fetch в `generateMetadata`. Дефолтное поведение (browser → `/api-backend` rewrite, SSR → `API_INTERNAL_BASE_URL`) работает.

Без `DATABASE_URL` бэк отдаёт 8 seed-сертификатов из `pipelineMemoryStore.ts` — отлично для демо.

```bash
# Backend
cd aevion-globus-backend ; npm install ; npm run build ; PORT=4001 node dist/index.js

# Frontend (dev)
cd frontend ; npm install
BACKEND_PROXY_TARGET=http://127.0.0.1:4001 \
API_INTERNAL_BASE_URL=http://127.0.0.1:4001 \
npx next dev --port 3002 --turbopack
```

## 1. Что уже сделано (по handoff'ам)

См. `AEVION_HANDOFF_2026-04-24.md` (handoff bureau session с криптой) и [`project_bureau_v2_status.md`](../.claude/projects/...) в memory.

Ключевые фичи Bureau v2:
- HMAC + Ed25519 reverify в `/verify/:id` с `signatureHmacReason` / `signatureEd25519Reason` / `seed` полями.
- Детерминированные подписи (без `timestamp: Date.now()` в payload).
- Tolerant `/protect` контракт: `authorName/Email` + legacy `ownerName/Email` + опциональный pre-computed `contentHash`.
- 0 lint errors в bureau scope.
- Smoke E2E: protect → verify → badge SVG → PDF → CSV → SSR /verify с динамическим OG.
- /bureau: animated KPIs, sparkline, by-type/by-country bars, search/filter/sort с debounce, live activity feed (15s polling), Merkle anchor badge, file/batch hash checker, pricing tiers, certificate preview modal с QR + share, keyboard shortcuts (`/ r n ?`).
- /verify: cryptographic proof rows с reason pills, integrity checks, legal basis, Merkle inclusion proof, downloads (PDF/badge/JSON), share (Twitter/LinkedIn/Telegram/WhatsApp/Email + HTML badge), verify-another input.
- /bureau/layout.tsx: динамическая OG/Twitter meta с live numbers из stats endpoint.

## 2. Что ещё открыто

- **Postgres smoke** — нужен живой PG + `DATABASE_URL`, не сделано in-memory.
- **OG-image PNG endpoint** для сертификатов (нужен `@vercel/og` или `sharp`).
- **Batch protect UI** на `/qright` — у нас есть batch checker, но не batch POST.
- **Email/webhook notifications** на новые верификации.
- **Inline API playground** на `/bureau`.
- **PR в main** — `feat/bureau-v2` ready, PR не открыт (gh CLI не установлен — нужен web).

## 3. Перед «готово»

1. `cd frontend ; npx tsc --noEmit` exit 0.
2. (Опционально) `npx next build` — проверка static prerender 23 routes.
3. Коммит conventional message.
4. Push в `feat/bureau-v2`.
5. Update `project_bureau_v2_status.md` в memory если что-то существенно изменилось.
