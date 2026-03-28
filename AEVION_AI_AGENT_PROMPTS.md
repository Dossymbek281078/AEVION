# AEVION AI Agent Prompts Pack

Готовые промты для вставки в другой AI-агент (Cursor/Claude/ChatGPT/Copilot и т.д.).

Использование:
- Берите любой блок целиком.
- Заменяйте placeholders вида `<...>`.
- Для сложных задач сначала запускайте блок `01` (универсальный контекст), затем специализированный блок.

---

## 01) Universal Project Context Prompt

```text
Ты работаешь с монорепозиторием AEVION (`aevion-core`).

Контекст продукта:
- Planet = доверие/compliance/сертификаты/голосование.
- Премии music и film — отдельные витрины на Planet.
- Метрика Y = eligibleParticipants из GET /api/planet/stats.

Стек:
- Frontend: Next.js app router в `frontend`.
- Backend: Express + TypeScript + Prisma в `aevion-globus-backend`.

Ключевые документы:
- AEVION_PLANET_CONCEPT.md
- AEVION_AWARDS_SPEC.md
- AEVION_DEPLOY.md
- AEVION_WORKLOG_2026-03-20.md

Текущий принцип работы:
- Действуй автономно, без лишних вопросов.
- Делай изменения end-to-end: код -> проверка сборки -> краткий отчёт.
- Не ломай существующие флоу Planet/Awards.

Перед началом:
1) Прочитай релевантные файлы.
2) Сделай правки.
3) Запусти проверку сборки (минимум frontend build).
4) Дай чёткий список изменённых файлов и результат проверки.
```

---

## 02) Frontend Feature Implementation Prompt

```text
Нужно реализовать фичу на фронтенде AEVION.

Цель:
<опиши фичу>

Ограничения:
- Next.js app router.
- Сохраняй стилистику текущих страниц (inline style, ProductPageShell/Wave1Nav где уместно).
- Не вводи лишние зависимости.

Обязательные шаги:
1) Найди и прочитай существующие компоненты, связанные с фичей.
2) Внеси минимально-инвазивные правки.
3) Проверь типы и адаптивность.
4) Запусти `npm run build` в `frontend`.
5) Верни:
   - список файлов
   - что изменено
   - результат сборки
```

---

## 03) Planet Flow UX Prompt

```text
Улучши UX сценария Planet в AEVION:
- вход на /planet
- подача артефакта
- публичная карточка /planet/artifact/[id]
- голосование/снапшот/proof

Фокус:
- уменьшить количество ручных действий
- добавить ясные CTA
- сохранить совместимость API

Сделай:
1) Быстрые пресеты и автозаполнение полей.
2) Ясные статусы ошибок/успеха.
3) Быстрые действия на странице артефакта.
4) Мобильную читабельность таблиц/блоков.
5) Проверку `frontend` build.

Отчёт:
- Что улучшено по шагам пользователя.
- Какие файлы затронуты.
- Итог проверки.
```

---

## 04) Backend API Extension Prompt

```text
Добавь/измени endpoint в backend AEVION (`aevion-globus-backend`) без регрессий.

Нужно:
<описание endpoint или изменения>

Требования:
- Express + TS.
- Совместимость с текущими маршрутами /api/planet, /api/globus и т.д.
- Если меняется структура ответа — обнови frontend-потребителей.

Сделай:
1) Найди текущие роуты и DTO-структуры.
2) Реализуй endpoint.
3) Обнови OpenAPI-json endpoint, если релевантно.
4) Проверь backend build + frontend build (если frontend затронут).
5) Верни пример запроса/ответа.
```

---

## 05) Bugfix Prompt (Production Style)

```text
Исправь баг в AEVION.

Симптом:
<описание бага>

Ожидаемое:
<ожидаемое поведение>

Работай так:
1) Локализуй причину в коде (не симптом, а корень).
2) Добавь устойчивый фикс + fallback, если нужно.
3) Не ломай соседние сценарии.
4) Сборка/проверка после фикса обязательна.
5) Дай короткий postmortem: причина -> фикс -> как проверено.
```

---

## 06) Awards Product Prompt

```text
Развивай продуктовую линию AEVION Awards (music + film).

Цели:
- Единый хаб /awards
- Чёткая связь с Planet
- Поддержка метрик Y, submissions, certified
- Удобный вход в подачу заявки

Сделай:
1) Улучши витрины /awards/music и /awards/film.
2) Сохрани deep-link контекст в /planet (type/preset/productKey/title).
3) Добавь/улучши CTA между страницами awards <-> planet.
4) Проверь frontend build.
5) Опиши продуктовый эффект каждой правки.
```

---

## 07) Design Consistency Prompt

```text
Приведи UI в AEVION к более консистентному виду без тотального рефактора.

Сфокусируйся на:
- одинаковые карточки/отступы/радиусы
- единая семантика CTA
- читаемость на мобильных
- визуальная иерархия метрик и действий

Правила:
- Минимальные локальные правки.
- Не менять архитектуру страницы без необходимости.
- Сохранять текущую дизайн-стилистику проекта.

В конце: frontend build и список визуальных улучшений.
```

---

## 08) QA / Regression Prompt

```text
Проведи быстрый regression-check по AEVION после изменений.

Покрой:
- / (главная, глобус, pulse)
- /awards
- /awards/music
- /awards/film
- /planet
- /planet/artifact/[id] (при наличии id)

Проверь:
1) Нет явных runtime ошибок.
2) Нет сломанных ссылок между Planet/Awards.
3) Ключевые API вызовы живы.
4) Build проходит.

Верни:
- список найденных проблем по severity
- предложенные/внесённые фиксы
- остаточные риски
```

---

## 09) Release Prep Prompt

```text
Подготовь AEVION к выпуску MVP.

Нужно:
1) Проверить, что `npm run build` зелёный для frontend.
2) Проверить backend build.
3) Сверить переменные окружения с AEVION_DEPLOY.md.
4) Подготовить release notes:
   - что добавлено
   - что исправлено
   - как проверить после деплоя
5) Подготовить короткий rollback plan.
```

---

## 10) Deployment Prompt (Vercel + Backend)

```text
Подготовь деплой AEVION по схеме:
- frontend -> Vercel (root: frontend)
- backend -> Railway/Render/Fly
- proxy через BACKEND_PROXY_TARGET

Сделай:
1) Проверку deploy-доков и env-шаблонов.
2) Валидацию, что frontend использует /api-backend rewrite.
3) Чеклист пост-деплой проверки endpoint'ов.
4) Ясную инструкцию ручной проверки для non-tech пользователя.
```

---

## 11) Autonomous Night Mode Prompt

```text
Работай в автономном режиме над AEVION (без вопросов пользователю), итеративно.

Цикл:
1) Выбери следующую высокоценную задачу (UX/API/reliability).
2) Внеси изменение.
3) Прогони сборку/проверку.
4) Коротко зафиксируй прогресс в changelog/worklog файле.
5) Немедленно переходи к следующей итерации.

Ограничения:
- Не делать destructive git-операций.
- Не добавлять зависимости без необходимости.
- Поддерживать совместимость текущего Planet/Awards flow.
```

---

## 12) Prompt for Another Agent: “Continue From Current State”

```text
Продолжи разработку AEVION с текущего состояния кода.

Сначала:
1) Прочитай:
   - AEVION_CHAT_ARCHIVE_2026-03-22.md
   - AEVION_AWARDS_SPEC.md
   - AEVION_PLANET_CONCEPT.md
2) Просканируй последние изменения в:
   - frontend/src/app/planet/page.tsx
   - frontend/src/app/planet/artifact/[id]/page.tsx
   - frontend/src/app/awards/*

Затем:
- Предложи 3 следующих улучшения (по приоритету).
- Сразу реализуй №1 и №2.
- Прогони build.
- Отчитайся кратко по результату.
```

---

## 13) Copy-Paste Meta Prompt (One Prompt To Rule Them All)

```text
Ты — senior full-stack AI engineer в проекте AEVION.
Работай автономно, без уточняющих вопросов, пока не завершишь разумную итерацию.

Контекст:
- Monorepo: aevion-core
- Frontend: Next.js (`frontend`)
- Backend: Express+TS (`aevion-globus-backend`)
- Product core: Planet compliance + public artifact + votes + Awards music/film

Критерии качества:
1) Пользовательский флоу проще после твоих правок.
2) Нет регрессий по Planet/Awards.
3) Build проходит.
4) Изменения понятны и связаны с продуктовой ценностью.

Формат работы:
- Анализ -> код -> build -> краткий отчёт.
- Без лишней болтовни.
- Ссылки на изменённые файлы обязательно.
```

