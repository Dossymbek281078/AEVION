# AEVION backend — CLAUDE.md (сжат 22.09.2026: было 13 650 знаков апрельских статусов, грузилось в каждый запрос)

> Полный прежний текст (структура марта–апреля 2026, таблица 27 модулей, workflow-заметки) —
> в истории git: `git show 4b0c80b29:aevion-globus-backend/CLAUDE.md`. Он устарел:
> модулей 44, ветка выкатки и правила координации живут в `~/.claude/CLAUDE.md`.

## Что это
Express 5 + TypeScript (CommonJS, `tsc` → `dist/`), Prisma 7 + Postgres, JWT. Реестр модулей —
`src/data/projects.ts` (источник истины); цены — `src/data/pricing.ts`; публичные тексты витрин —
`src/data/trust.ts`, `cases.ts`, `changelog.ts`, `roadmap.ts` (отдаются наружу — числа только из замера).
Dev: `npm run dev` (порт 4001). Проверка перед «готово»: `npx tsc --noEmit` + затронутые тесты
(`npx vitest run tests/<файл>`); полный набор — только со слотом тяжёлых прогонов.

## Куда смотреть
* Кто что правит сейчас — `../AEVION_COORDINATION.md` и `node C:/Users/user/aevion-claim.mjs --file <путь>`.
* Выкатка — ТОЛЬКО `scripts/railway-deploy.sh` (кладёт `build-info.json` в образ; без него
  `/health` отвечает `commit: unknown`, и обёртки всех окон отказывают). Общие правила очереди
  выкаток — `~/.claude/CLAUDE.md` §13, §20. Никогда не игнорировать `build-info.json` в `.gitignore`.
* Публичный бенчмарк/утверждение о качестве — сперва `../docs/benchmarks/PLAYBOOK.md`.

## Конвенция деплой-путей DevHub: deploy = uploaded + serves (урок 21.07.2026, PR #760/#768)
1. Ни один путь не помечает deployment «live», пока URL реально не отдал 2xx —
   `verifyDeploymentServes()` в `src/routes/devhub.ts`; иначе `failed` с причиной в buildLog.
2. Никаких симуляций успеха на реальных путях; симуляция — только в явном dev-режиме без токена,
   и buildLog обязан это называть.
3. 2xx от API провайдера ≠ работающий деплой: проверять страницу, которую увидит человек.
4. CF Pages — только через wrangler (`src/lib/wranglerPagesDeploy.ts`).
5. Новый live-модуль со страницей — добавить в `scripts/pages-live-smoke.js`.

## Деньги (проверять на проде после каждой выкатки)
`/api/pricing/checkout/session` → 200 и ссылка кассы; `/api/pricing/testimonials` → 0 (демо-отзывы
сняты 20.09); `POST /api/agency/lead` пустой → 400 `contact_required`; preflight с Origin
витрины агентства → `access-control-allow-origin`. Одной командой: `node C:/Users/user/aevion-after-deploy.mjs`.
