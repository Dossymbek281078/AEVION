## AEVION worklog (2026-03-20)

**Координация двух чатов / приоритеты WIP:** см. **`AEVION_COORDINATION.md`** (источник истины «кто что делает»; обновляйте перед параллельной работой).

### What we restored on this laptop
- Found existing backend `QRight` implementation:
  - `aevion-core/aevion-globus-backend/src/routes/qright.ts`
  - Endpoints: `GET /api/qright/objects`, `POST /api/qright/objects`
- Found existing frontend pages:
  - `aevion-core/frontend/src/app/qright/page.tsx`
  - `aevion-core/frontend/src/app/qsign/page.tsx`
  - `aevion-core/frontend/src/app/qtrade/page.tsx`

### What we added/updated for Globus + Bureau
- Updated Globus v1 landing page to be “portal + globe-like node map” with links:
  - `frontend/src/app/page.tsx`
- Added dynamic project route so clicking `/${project.id}` doesn’t 404:
  - `frontend/src/app/[id]/page.tsx`
  - Shows project details from `GET /api/globus/projects/:id`
- Added “IP Bureau / building portal” page with QRight re-instating + QSign actions:
  - `frontend/src/app/bureau/page.tsx`
  - Loads QRight objects from `GET /api/qright/objects`
  - Signs/verifies a deterministic payload via:
    - `POST /api/qsign/sign`
    - `POST /api/qsign/verify`
  - Stores signatures locally in `localStorage` (MVP)

### Current blocker (root cause)
- `GET /api/qright/objects` returns `500` due to PostgreSQL connection failure.
- Verified that PostgreSQL is not reachable on `localhost:5432` from this environment.

### Minimal robustness fix applied (prevents “missing table” on fresh DB)
- Updated `QRight` backend to bootstrap the `QRightObject` table on first request and to generate `id` in app:
  - `backend/src/routes/qright.ts`
  - This removes dependency on Postgres UUID extensions for MVP table creation.

### Next steps (max efficiency, minimal surface)
1. Start PostgreSQL so `localhost:5432` is reachable.
2. Ensure DB `aevion_dev` exists and is initialized.
3. Re-test:
   - `GET /api/qright/objects`
   - Open `/qright` and `/bureau` in the browser

---

## Update (Globus v1 + Bureau + QSign integration)
- Fixed real DB auth issue:
  - `C:\Users\user\aevion-core\aevion-globus-backend\.env` had incorrect `DATABASE_URL` password for user `postgres`.
- After updating env:
  - `GET /api/qright/objects` returns `200`
  - `POST /api/qright/objects` successfully inserts a record
- UI / routing added:
  - `frontend/src/app/page.tsx` (Globus v1 portal + node map)
  - `frontend/src/app/[id]/page.tsx` (project detail for unknown nodes)
  - `frontend/src/app/bureau/page.tsx` (IP Bureau: reuses QRight + QSign)
- QSign integration:
  - `POST /api/qsign/sign` + `POST /api/qsign/verify` confirmed to work.

## Where this chat was preserved
- Snapshot/worklog stored at `C:\Users\user\aevion-core\AEVION_WORKLOG_2026-03-20.md`.

---

## Continuation plan for tomorrow (без “с нуля”)
### 1) Восстановить окружение (5 минут)
1. Убедиться, что PostgreSQL запущен.
2. Проверить, что backend слушает `4001`.
3. Убедиться, что frontend слушает `3000`.

### 2) Быстрые проверки рабочих MVP
1. API:
   - `GET http://localhost:4001/health`
   - `GET http://localhost:4001/api/globus/projects` (должны прийти узлы на Globus)
   - `GET http://localhost:4001/api/qright/objects` (должны прийти объекты реестра)
2. UI:
   - `http://localhost:3000/` (Globus 3D + узлы проектов + “Создать продукт здесь”)
   - `http://localhost:3000/qright` (форма QRight с полями `country/city`)
   - `http://localhost:3000/bureau` (карточки QRight + sign/verify через QSign)
   - `http://localhost:3000/auth` (register/login/me)

### 3) На что именно продолжать (следующий логичный шаг)
1. Следующее усиление “реальных пользователей”:
   - сейчас `QRight` (ownerName/ownerEmail) ещё можно заполнять вручную
   - завтра можно сделать привязку `ownerName/ownerEmail` автоматически из JWT (`/api/auth/me`) при `POST /api/qright/objects`
2. После этого можно будет аккуратно вести “владение и реестры по пользователям” и затем разворачивать следующую точку на карте (страны/города + размещение будущих продуктов).

### 4) Ключевые файлы (куда смотреть)
- Backend:
  - `aevion-globus-backend/src/routes/qright.ts` (QRight реестр + bootstrap таблицы + `country/city`)
  - `aevion-globus-backend/src/routes/auth.ts` (register/login/me + роли)
  - `aevion-globus-backend/.env` (важно: `DATABASE_URL` должен быть с верным паролем)
- Frontend:
  - `frontend/src/app/page.tsx` (Globus portal + 3D)
  - `frontend/src/app/components/Globus3D.tsx` (3D глобус и маркеры стран/городов)
  - `frontend/src/app/qright/page.tsx` (создание QRight + owner prefill из `/api/auth/me`)
  - `frontend/src/app/bureau/page.tsx` (IP Bureau, sign/verify и location)
  - `frontend/src/app/auth/page.tsx` (Auth UI)

---

## Update (2026-03-20+) — QRight ownerUserId + «мои»

### Backend
- Таблица `QRightObject`: колонка **`ownerUserId`** (`CREATE` + `ALTER … IF NOT EXISTS`).
- **`POST /api/qright/objects`**: при валидном JWT и найденном пользователе пишется **`ownerUserId` = `AEVIONUser.id`** (плюс как раньше автоподстановка имени/email).
- **`GET /api/qright/objects?mine=1`**: выборка по **`ownerUserId = JWT sub`**, для старых записей без id — fallback **`ownerEmail` = email из JWT**.

### Frontend / Prisma
- Типы карточек: **`ownerUserId`** в `qright/page.tsx`, `bureau/page.tsx` (отображение кратко).
- **`prisma/schema.prisma`**: поле **`ownerUserId`** у `QRightObject`.

### Дорожная карта 27 проектов
- Сводный таймлайн и таблица по каждому узлу: **`AEVION_27_PROJECTS_ROADMAP.md`** (корень `aevion-core`).
- **Runtime registry:** `GET /api/globus/projects` и `GET /api/globus/projects/:id` отдают поле **`runtime`** (tier, paths, hints). Дополнительно: `GET /api/modules/status`, `GET /api/modules/:id/health`, `GET /api/openapi.json`. Файлы: `aevion-globus-backend/src/data/moduleRuntime.ts`, `src/routes/modules.ts`.
- **QCoreAI + Multichat:** `POST /api/qcoreai/chat`, `GET /api/qcoreai/health`; UI `/qcoreai`, мост `/multichat-engine`. OpenAI через `OPENAI_API_KEY` / `OPENAI_BASE_URL`, без ключа — stub. Общий пул БД: `src/lib/dbPool.ts` (qright, auth, planet).
- **Пример env:** `aevion-globus-backend/.env.example`.

### Как продолжить чат позже (Cursor)
- История диалогов хранится в **панели чата Cursor** (список прошлых чатов слева / в истории).
- Имеет смысл **не удалять** этот тред и при необходимости **открыть тот же чат** из истории — так контекст проще восстановить.
- Для «жёсткого» бэкапа смысла: **worklog** (`AEVION_WORKLOG_2026-03-20.md`) + краткая выжимка в начале нового чата («продолжаем AEVION по worklog»).

---

## Update (2026-03-20) — Planet compliance (экосистема «планета»)

### Статус проверки сборок (подтверждено)
- **Backend** (`aevion-globus-backend`): `npm run build` (tsc) — **OK**.
- **Frontend** (`frontend`): `npm run build` (Next.js 16) — **OK** (маршруты `/planet`, `/planet/artifact/[id]` в билде).

### Backend (кратко)
- API Planet под **`/api/planet`**: `src/routes/planetCompliance.ts`, подключение в `src/index.ts`.
- Таблицы: submissions, версии артефактов (**`parentVersionId`**), сертификаты, история символов кода, голоса, снимки Merkle для голосов.
- Поток: submission → валидаторы → evidence root → сертификат (HMAC); **resubmit** требует изменения хешей для code/web; **плагиат** сравнивает с недавними версиями **без той же `submissionId`** (исправление ложного 100% self-match при resubmit).
- Лицензия: `declaredLicense` или `package.json` → `license` из `codeFiles`; в ответе валидатора **`licenseSource` / `resolvedLicense`**.
- Голосование по **CodeSymbol**, уникальность (user, artifact, category); **GET …/votes/my-proof** с **`categoryId`** (по умолчанию `general`).
- Публичный артефакт: **`GET …/artifacts/:id/public`** при сертификации — **`complianceSummary`**, **`voteStats`**, **`versionLineage`**.

### Frontend
- Страницы: `src/app/planet/page.tsx`, `src/app/planet/artifact/[id]/page.tsx` (сертификат, голоса, сводка compliance, родительская версия, категория, сырые валидаторы).
- Ссылка на Planet с главной; в `Globus3D.tsx` ослаблены типы там, где заглушка `three` ломала TS; в `src/types/three.d.ts` объявлен **`topojson-client`**.

### Известные нюансы
- Если **`next build`** падает из-за **`.next/lock`** — остановить параллельный `next dev` или удалить lock и пересобрать.
- **Desktop** (Electron/Tauri) — не в приоритете в этой итерации (web-first).

### Следующие шаги (для следующей сессии)
1. Movie/music: заменить MVP-отпечатки на нормальную каноникализацию + similarity.
2. Реальный CI для code/web (sandboxed `npm install` / test / build).
3. Роли: финализация snapshot не только owner; модерация/отзыв при необходимости.
4. Опционально: `@types/three` / `@types/topojson-client` и убрать `any` в Globus3D.

### Как «сохранить чат» перед выходом из Cursor
1. **Не удалять** этот диалог; при возврате открыть **тот же чат из истории** (Cursor хранит историю в аккаунте/локально в зависимости от настроек).
2. Дублировать контекст в репозитории: этот файл **`aevion-core/AEVION_WORKLOG_2026-03-20.md`** — основной handoff.
3. В новом чате написать одну строку: *«Продолжаем AEVION Planet по `AEVION_WORKLOG_2026-03-20.md`, последняя секция Planet»*.

### Ускорение процессов (инструменты)
- Корень `aevion-core`: **`npm install`** (один раз), затем **`npm run dev`** — backend + frontend в одном терминале; **`npm run verify`** — обе production-сборки подряд.
- **`README.md`** в корне — быстрый старт; **`.github/workflows/ci.yml`** — параллельный CI (build backend | build frontend).
- Принципы «максимум смысла за единицу времени» — в начале **`AEVION_27_PROJECTS_ROADMAP.md`** (п.7–9 дополняют список).

### Таймлайн «рабочих версий» (кратко для продукта)
- Полная таблица по **27 узлам** и фазам: **`AEVION_27_PROJECTS_ROADMAP.md`**.
- **Ядро (Globus, QRight, QSign, Bureau, Auth):** рабочий **MVP** — по дорожной карте **Q2 2026** (фаза **B, апр–июнь 2026**), с буфером на жизнь/приоритеты.
- **Planet:** **сейчас** уже dev MVP в коде; **демо v1** — **апр–май 2026**; **продуктовый минимум** (CI, роли, модерация) — **июнь–авг 2026** — см. новый блок в том же `AEVION_27_PROJECTS_ROADMAP.md`.
- **Остальные модули (QTrade, QPayNet, AI-чаты и т.д.):** см. фазы **C–E** в roadmap; многие **Q4 2026 – 2027+**.

---

## Update — Globus на главной (починка «не показывает в браузере»)

### Симптом
При `loading` / `error` API главная страница делала **ранний `return`** без монтирования `Globus3D` → пользователь **не видел глобус** (даже при мёртвом backend).

### Сделано
- **`frontend/src/app/page.tsx`:** убраны ранние return; при ошибке API — **баннер сверху**, глобус и разметка **всегда**; счётчик проектов показывает «…» при загрузке.
- **`Globus3D`** подключается через **`next/dynamic` с `ssr: false`** + плейсхолдер **`Globus3DPlaceholder.tsx`** (Three/WebGL только в браузере).
- Ранее: стабильные колбэки (`useCallback`), refs в `Globus3D`, `ResizeObserver`, flex вместо жёсткой сетки.

### Продолжить позже
1. Открыть проект из **`aevion-core`**, `npm run dev` (корень) или frontend отдельно.
2. Если глобус пустой по маркерам — проверить backend + CORS + `NEXT_PUBLIC_API_BASE_URL`.
3. Если снова чёрный canvas — смотреть консоль WebGL / блокировщики; опционально fallback 2D.

---

## Update (2026-03-22) — концепция Planet и премии (музыка / кино)

### Добавлено в репозиторий
- **`AEVION_PLANET_CONCEPT.md`** — что такое Planet, ценность для авторов и аудитории, нарратив для инвесторов, честное разделение **MVP** и **последующих доработок**, принципы **параллельного выпуска** витрин при общем Planet API и `npm run verify`.
- **`AEVION_AWARDS_SPEC.md`** — **два отдельных продукта** (музыка и кино), премии в духе Грэмми/Оскара на **собственных брендах Aevion**, общий backend Planet; **голоса в контексте участников Planet** (варианты A/B/C + открытый пункт: определение пула Y для «X из Y»).

### README и координация
- В **`README.md`** (таблица «Документы») добавлены ссылки на оба файла.
- В **`AEVION_COORDINATION.md`** (порядок источников истины) добавлены пункты 4–5 со ссылками на эти документы.

### Продолжение работы в этом чате
- Имеет смысл держать **этот тред** как рабочий для Planet/премий и при смене сессии начинать с: *«продолжаем по `AEVION_PLANET_CONCEPT.md` / `AEVION_AWARDS_SPEC.md` и последнему worklog»*.

---

## Update (2026-03-22) — отдельный чат на разработку, цель $1B, глобус

### Отдельный чат Cursor (параллельная разработка)
- **Имеет смысл завести отдельный диалог**, например **`AEVION | Planet + Awards DEV`**, чтобы не смешивать с системной координацией; в начале сессии копировать handoff из **`AEVION_COORDINATION.md`** (шаблон внизу файла) и одну строку:
  - *«Planet/премии: `AEVION_PLANET_CONCEPT.md`, `AEVION_AWARDS_SPEC.md`; код Planet — `aevion-globus-backend/src/routes/planetCompliance.ts`, UI `/planet`; после правок — `npm run verify` из корня `aevion-core`».*
- Границы: правки **в зоне Planet, премий (витрины музыка/кино), Globus3D** — ок в этом чате; **ломка Auth / общих контрактов** — согласовать с чатом SYSTEM или пометить в WIP.

### Продуктовая цель (фиксация для команды и инвест-нарратива)
- **Долгосрочная цель:** вывести экосистему AEVION к **оценке порядка 1 млрд USD** — за счёт масштабируемого слоя доверия (Planet), IP-контура и продуктовых вертикалей; **привлечение инвестиций** на эту величину **или продажа компании/продукта** — как стратегическая опция после доказанных метрик (участники Planet, выручка/партнёрства, повторяемость сценариев).
- Детализация метрик и этапов — не в worklog; краткий нарратив см. **`AEVION_PLANET_CONCEPT.md`** (раздел про инвесторов); при подготовке **data room / pitch deck** вынести в отдельный документ по запросу (не дублировать сюда всё подряд).

### Глобус (визуал)
- Усилен **реалистичный вид Земли** в `Globus3D.tsx`: текстуры albedo/specular/normal и **облака** с `threejs.org/examples/textures/planets/`, **звёздный фон** (Points), **световой ореол** (BackSide + AdditiveBlending), Hemisphere + Directional + слабый ambient, **ACES tone mapping** + **sRGB output**; сетка и границы приглушены; маркеры/границы/сетка в **`earthGroup`** — вращаются вместе с планетой; тултип по маркеру через `getWorldPosition`.
- В начале файла **`// @ts-nocheck`**: пакет `three@0.183` в этой среде без полных typings — иначе `next build` падает на `PointsMaterial`, `HemisphereLight` и т.д.; рантайм Three.js совместим с кодом. При появлении полноценных типов — можно убрать директиву и поправить импорты.

---

## Update (2026-03-22) — витрины премий + deep link Planet

### Frontend
- **`/awards/music`**, **`/awards/film`** — лендинги AEVION Music / Film Awards (`AwardPortal.tsx`), ссылки на Auth, перекрёстная ссылка между витринами, CTA на Planet с `?type=music` / `?type=movie`.
- **`/planet`**: при открытии с **`type`** или **`artifactType`** (`music` | `movie` | `code` | `web`) пресет типа, заголовка и `productKey` для музыки/кино; баннер «режим премии»; смена типа в `<select>` сбрасывает баннер.
- **Главная** (`page.tsx`): кнопки и карточки быстрого доступа на обе витрины.

### Документация
- **`AEVION_AWARDS_SPEC.md`**: таблица маршрутов и query-параметров.

### Проверка
- `npm run build` в `frontend` после изменений.

### Починка сборки (QCoreAI)
- **`frontend/src/app/qcoreai/page.tsx`**: удалён лишний закрывающий `</ProductPageShell>` без открывающего тега; добавлен импорт **`Link`**; убраны неиспользуемые импорты `ProductPageShell` / `Wave1Nav`.

---

## Update (2026-03-22) — Planet stats API, номинации, витрины

### Backend
- **`GET /api/planet/stats`** (`planetCompliance.ts`): публичный JSON — `eligibleParticipants` (активный CodeSymbol), `distinctVotersAllTime`, `submissions`, `artifactVersions`, `certifiedArtifactVersions`, поле `definitions`, `generatedAt`.

### Frontend
- **`src/lib/planetNominations.ts`**: стабильные **`categoryId`** для music / movie / code / web.
- **`/planet/artifact/[id]`**: блок метрик Y; голосование — **select номинаций** вместо свободного ввода; синхронизация категории при смене типа артефакта.
- **`/planet`**: строка с метриками из stats API.
- **`AwardPortal`**: live-блок статистики Planet на витринах премий.

### Документация
- **`AEVION_AWARDS_SPEC.md`**: описание `GET /api/planet/stats` и номинаций.

### Проверка
- `npm run build` в `aevion-globus-backend` и `frontend`.

---

## Update (2026-03-22) — stats по префиксу, голоса по номинациям, навигация

### Backend
- **`GET /api/planet/stats`**: опциональный query **`productKeyPrefix`** → объект **`scopedToProductKeyPrefix`** (submissions, artifactVersions, certifiedArtifactVersions по `productKey LIKE prefix%`).
- **`GET /api/planet/artifacts/:id/public`**: поле **`voteStatsByCategory`**.

### Frontend
- **`Wave1Nav`**: ссылки **Премия · музыка** / **Премия · кино**.
- **`planetNominations`**: функция **`nominationLabel`**.
- **`/planet/artifact/[id]`**: таблица **«Голоса по номинациям»**.
- **`AwardPortal`**: второй запрос stats с **`productKeyPrefix`** (`aevion_award_music` / `aevion_award_film`) и блок «трек этой премии».

### Документация
- **`AEVION_AWARDS_SPEC.md`** — дополнено.

### Проверка
- `npm run build` (backend + frontend).

---

## Update (2026-03-22) — лента сертификатов, глобус премий, пульс Planet, SEO

### Backend
- **`GET /api/planet/artifacts/recent`** — сертифицированные версии, сортировка по `createdAt`, фильтры `limit`, `productKeyPrefix`, `artifactType`.
- **`/api/openapi.json`** — добавлены пути Planet (**stats**, **artifacts/recent**, **artifacts/{id}/public**).

### Frontend
- **`PlanetPulse`** на главной: метрики Planet + до 4 ссылок на недавние сертифицированные артефакты + быстрые ссылки.
- **Глобус:** виртуальные узлы **`aevion-awards-music`** / **`aevion-awards-film`** (Нэшвилл / Лос-Анджелес) → `/awards/music`, `/awards/film`, маркеры с акцентным цветом.
- **AwardPortal:** секция «Лента сертифицированных работ» по префиксу премии и типу media.
- **Метаданные** (`metadata`) на страницах `/awards/music` и `/awards/film`.

### Документация
- **`AEVION_AWARDS_SPEC.md`** — описание `artifacts/recent`.

### Проверка
- `npm run build` в backend и frontend.

- **`PlanetPulse`:** запросы к Planet через **`apiUrl()`** (совместимо с rewrite `/api-backend`).

