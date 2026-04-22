# AEVION Bank UI — CLAUDE.md (контекст этой сессии)

> Создано 2026-04-22. Источник истины по AEVION в целом — `aevion-globus-backend/CLAUDE.md`.

---

## 0. Правила этой сессии (важно)

- **Работаем только над Bank UI.** Всё остальное в этом worktree — чужая территория для этой сессии:
  - Backend (`aevion-globus-backend/`, `backend/`) — не трогаем, считаем готовым интерфейсом.
  - Другие frontend-модули (`frontend/src/app/qright`, `qsign`, `bureau`, `quantum-shield`, `qtrade`, `qcoreai`, `planet`, `awards`, `cyberchess`, `multichat-engine`, `globus` и т.д.) — **не трогаем** (они делаются в других чатах/терминалах).
  - Особенно: **CyberChess** и любые шахматные файлы — отдельный трек, другой чат.
- **Ветка:** `bank-payment-layer`. Коммитить/пушить — только с явной просьбы пользователя. `git reset --hard`, удаление файлов, force-push — только с подтверждения.
- **Backend API** (`/api/qtrade/*`, `/api/auth/*`, `/api/planet/*`, `/api/pipeline/*` и прочие) — вызываем как готовый контракт через `apiUrl` из `@/lib/apiBase`. Если нужен новый endpoint — фиксируем запрос, сам backend правит другая сессия.
- **Перед «готово»:** из корня `aevion-core` прогнать `npm run verify` (backend `tsc` + frontend `next build`).

## 0.1. Workflow

- **Shell:** bash (Git Bash под Windows). Для команд в сообщениях пользователю (Notepad / PowerShell) — разделитель `;`, не `&&`.
- **Пути в сообщениях:** Windows-стиль с `\`. В коде — forward slashes.
- **Правки кода:** крупные изменения — полный файл целиком (проще вставить в Notepad), точечные — snippet + путь.
- **Редактор пользователя:** Notepad — без zero-width символов, без экзотики в файлах.

---

## 1. Где живёт Bank UI в этом worktree

`frontend-bank/` — это git worktree ветки `bank-payment-layer`, привязанный к `C:\Users\user\aevion-core\.git\worktrees\frontend-bank`. Содержимое совпадает со всем монорепо aevion-core, но ветка отдельная.

Отдельного Next.js-приложения «bank» в корне worktree **нет**. Bank-контент раскидан по двум местам:

### 1.1. `frontend/src/app/bank/page.tsx` (основной фронт)
- Одна клиентская страница, ~477 строк, inline-стили (без Tailwind-классов и без shadcn).
- Импортирует: `ProductPageShell`, `Wave1Nav`, `ToastProvider` из `@/components/`, `apiUrl` из `@/lib/apiBase`.
- Реальных API-вызовов пока **нет**: wallet и transactions — константы `DEMO_WALLET` / `DEMO_TX`; P2P transfer — фейковый `setTimeout(1200)`. `apiUrl` импортирован, но не используется.
- Локальных компонентов в `src/app/bank/` нет (только сам `page.tsx`).

### 1.2. `aevion-portal-frontend/` (скелет под Kaspi-портал)
- Отдельный Next.js каркас, добавленный в коммите `5461466` «Bank: Kaspi integration draft».
- Исходников пока только два: `next-env.d.ts` и пустой `public/openings.json`. Всё остальное — артефакты `.next/`. Реальной Kaspi-логики в коммит не попало.
- По факту — пустая площадка под отдельный банковский портал. Нужно уточнять у пользователя, развивать её или продолжать в `frontend/src/app/bank/`.

---

## 2. Стек (из `frontend/package.json`)

| Что | Версия / примечание |
|-----|---------------------|
| Next.js | `16.0.10` (App Router) |
| React / React-DOM | `19.2.1` |
| TypeScript | `^5` |
| Tailwind CSS | `^4` (через `@tailwindcss/postcss ^4`) |
| shadcn/ui | **не установлен** (нет `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`). Если решим добавлять — договариваемся явно. |
| UI-стиль текущей Bank-страницы | inline `style={{...}}`, не Tailwind-классы. При редактировании — либо оставаться в этом стиле, либо осознанно мигрировать (с согласования). |

`aevion-portal-frontend/package.json` — отдельный, читать по месту при работе с ним.

---

## 3. Backend API (готовый интерфейс, не меняем)

Backend крутится локально на `:4001` (`aevion-globus-backend`), в Vercel проксируется через `BACKEND_PROXY_TARGET`. Во фронте — обёртка `apiUrl()` из `frontend/src/lib/apiBase.ts`.

Для Bank наиболее релевантны:

- `/api/auth/register | login | me` — JWT (`Bearer` из `localStorage["aevion_auth_token_v1"]`).
- `/api/qtrade/accounts[.csv] | transfers[.csv] | operations[.csv] | summary | topup | transfer` — именно тут живёт «банковская» логика на backend. В текущем `bank/page.tsx` не используется — подключение ещё предстоит.
- `/api/planet/stats | artifacts/recent | artifacts/:id/public` — royalties и сертификаты (связка с Awards/Planet).
- `/api/qsign/sign | verify` — при необходимости подписи транзакций.
- `/api/quantum-shield/*` — если Bank должен отображать защищённые операции (упоминается в secure-секции UI).

Полный перечень — `/api/openapi.json` и `aevion-globus-backend/CLAUDE.md` §3.2.

---

## 3.1. Где остановились (2026-04-22)

Полный снимок прогресса — в [`BANK_HANDOFF.md`](./BANK_HANDOFF.md). Короткая версия: 20 коммитов от `main`, все 4 фазы плана (ecosystem / financial / security / delight) пройдены, 18 фич + modular rewrite + 1 полироф. Последний коммит `f00a26f`. Build зелёный.

Следующая сессия, по умолчанию — tech debt sprint (пункты 1-6 из handoff): dedup fetches, form primitives, `useLocalList<T>`, Money везде, Trust Score шкала, mock catalog.

## 4. Что делать в начале каждой задачи

1. Сверить задачу с п.0 — точно ли это Bank UI, а не один из «чужих» модулей.
2. Определить, идём ли в `frontend/src/app/bank/` или в `aevion-portal-frontend/` — при сомнениях спросить.
3. Не плодить абстракции впрок. Не переписывать inline-стили в Tailwind одним махом — только если пользователь попросил.
4. Перед «готово» — `npm run verify` из `C:\Users\user\aevion-core`.
5. Коммит/push — только по явной просьбе.
