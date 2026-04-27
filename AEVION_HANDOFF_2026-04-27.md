# AEVION Bureau — Handoff 2026-04-27 (frontend polish sprint)

Continuation of [`AEVION_HANDOFF_2026-04-24.md`](./AEVION_HANDOFF_2026-04-24.md). The crypto / signature / contract layer has been working since 2026-04-24; this sprint pushed the user-facing surfaces forward without touching the backend.

## Состояние

- **Branch:** `feat/bureau-v2`, all commits pushed to `origin`.
- **HEAD:** `3bebd66` "fix API quickstart curl base + set metadataBase".
- **Build:** `cd frontend ; npx tsc --noEmit` exit 0; `npm run build` prerenders 25 routes (added `/bureau/opengraph-image` and `/verify/[id]/opengraph-image` edge routes).
- **PR в `main`:** не открыт (gh CLI не установлен — открывать через web).

## Что доехало в этот заход (18 коммитов)

> Дополнительно к первоначальному списку из 9 (ниже): `de5f0c0` live embed playground; `5b2ca94` a11y globals; `aa21800` /bureau OG image edge route; `d39aa73` /verify per-cert OG image; `476e5eb` sitemap.ts + robots.ts; `1e95e60` API quickstart curl recipes; `3bebd66` apiUrl assert fix + metadataBase. Все pushed.

1. **`31265bf` surface signature reasons + seed badge in /verify** — выполнен пункт #2 из next-steps `AEVION_HANDOFF_2026-04-24`. Verify-страница теперь показывает HMAC-SHA256 / Ed25519 valid / mismatch pill'ы и reason-чипы (`seed`, `mismatch`, `not_checked`, `error: …`); в заголовке Cryptographic Proof оранжевый «Seed» когда сертификат из in-memory store. `allChecksPass` требует HMAC + Ed25519 пройти (fail-open на undefined для совместимости).
2. **`67392a1` download artifacts + verify-another input on /verify** — три прямые ссылки в новом блоке Download artifacts: PDF (`/api/pipeline/certificate/:id/pdf`), badge SVG (`/api/pipeline/badge/:id`), raw verify JSON. Внизу страницы — input «Verify another certificate» c роутом `/verify/<id>` через `useRouter`.
3. **`86da762` ? opens keyboard shortcut help overlay** — модалка со списком shortcut'ов (`?` `/` `r` `n` `Esc`), стилизованные `<kbd>` чипы. Открывается по `?` (или `Shift+/`), кликом по pill в header'е, или закрывается `Esc` / клик по backdrop. Pill в header'е теперь читается как «?  /  r  n».
4. **`1f9c706` /bureau dynamic SEO + OG metadata via layout.tsx** — `frontend/src/app/bureau/layout.tsx` с `generateMetadata`, тянет `/api/pipeline/bureau/stats` (revalidate 60s) и собирает OG/Twitter description вида «12,847 certificates · 38,219 verifications · 47 countries. SHA-256 + Ed25519 + Shamir Secret Sharing…». Fallback на статичный текст если бэк недоступен.
5. **`12a55c4` relative timestamps on registry cards + live activity feed** — `formatRelative()` хелпер ("just now", "5 min ago", "yesterday", "8 mo ago", "2 y ago") в двух местах. 60-секундный `nowTick` interval обновляет UI чтобы метки не зависали. Абсолютная дата сохранена в `title` для hover.
6. **`2cfa58c` docs: bureau-scoped CLAUDE.md for future sessions** — новый `CLAUDE.md` в корне worktree фиксирует scope (только bureau/verify + pipeline.ts + pipelineMemoryStore.ts), workflow (conventional commits, build-green, push-per-feature), Git Bash MinGW gotcha и список already-shipped/open-items. Чтобы будущие bureau-сессии не дрейфовали в bank/qright/awards.
7. **`230489c` client-side Markdown export of registry view** — кнопка «📝 Export Markdown» рядом с «📥 Export CSV». Рендерит текущий `certificates[]` срез (с учётом search/kind/sort фильтров) в pipe-разделённую markdown-таблицу, escape для `|` в title'ах, leading line с verify-URL pattern. CSV остаётся бэк-маршрутом (видит весь DB), Markdown — клиентский (что видишь то и качаешь).
8. **`6874068` suggested-query chips + Reset under the search bar** — chip row под filter bar: `Try: [music] [code] [Kazakhstan] [popular]` каждый чип pre-fill'ит правильную комбинацию `q + kind + sort`. `[Reset]` появляется когда любой фильтр не дефолтный.
9. **`d4d8553` sample-hash chips under the manual SHA-256 checker** — два чипа под textarea для paste-hash: «Try a real hash» (берёт `stats.latest[0].contentHash` — гарантированный FOUND) и «Try a missing hash» (64 нуля — гарантированный MISSING). Обе ветки lookup-логики становятся discoverable в 2 клика без своего файла.

## Что ещё открыто

- **Postgres smoke** — нужен живой PG + `DATABASE_URL`, не сделано in-memory. Не блокировано фронтом.
- **OG-image PNG endpoint** для сертификатов (нужен `@vercel/og` или `sharp`) — статика fallback'ит на summary card.
- **Batch protect UI** на `/qright` (multi-file `POST /protect` flow) — у нас batch *checker*, не batch protect.
- **Email/webhook notifications** на новые верификации.
- **Inline API playground** на `/bureau`.
- **PR в main** — открыть через web (https://github.com/Dossymbek281078/AEVION/pull/new/feat/bureau-v2). Все 9 фич + предыдущий состав задокументированы; конфликтов с `main` ожидаемо нет (за этой ветке только bureau/verify/pipeline files).
- ~98 ESLint errors в cyberchess/awards/planet — вне Bureau scope.

## Local run reminder

Без изменений vs `AEVION_HANDOFF_2026-04-24`:

```bash
# Backend
cd aevion-globus-backend ; npm install && npm run build ; PORT=4001 node dist/index.js

# Frontend (dev)
cd frontend ; npm install
BACKEND_PROXY_TARGET=http://127.0.0.1:4001 \
API_INTERNAL_BASE_URL=http://127.0.0.1:4001 \
npx next dev --port 3002 --turbopack
```

⚠️ Не ставить `NEXT_PUBLIC_API_BASE_URL=/api-backend` из Git Bash (MinGW translates to Windows path). Без `DATABASE_URL` бэк отдаёт 8 seed-сертификатов из `pipelineMemoryStore.ts`.
