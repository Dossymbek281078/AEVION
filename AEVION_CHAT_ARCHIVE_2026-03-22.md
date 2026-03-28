# Архив выжимки чата (22.03.2026)

Файл создан по запросу «сохранить чат»: здесь **суть договорённостей и правок**, не дословная переписка. Полная история сообщений хранится в **Cursor** (панель чата / история проекта).

## Продукт и контекст

- **AEVION / Planet:** доверие, compliance, сертификаты, голосование; витрины **премий музыка и кино** (свои бренды Aevion).
- Метрика **Y** — участники с активным Planet CodeSymbol (`GET /api/planet/stats` → `eligibleParticipants`).
- Долгосрочный ориентир и нарратив зафиксированы в `AEVION_PLANET_CONCEPT.md`, worklog и смежных документах.

## Глобус (frontend)

**Проблема:** в браузере не отображался 3D Globus.

**Сделано в коде (`frontend`):**

- Убран `next/dynamic` для `Globus3D`; используется прямой импорт и флаг **`globeClient`** (`useEffect` → `setGlobeClient(true)`), до монтирования показывается `Globus3DPlaceholder`.
- В **`Globus3D.tsx`:** `failIfMajorPerformanceCaveat: false`, стили canvas (`display: block`, ширина/высота 100%), обёртка инициализации в `try/catch`, оверлей при ошибке, `TextureLoader.setCrossOrigin("anonymous")`, цепочка URL текстур (threejs.org + fallback jsDelivr r160), дедуп пинов премий на карте в `page.tsx`.
- **`PlanetPulse`:** при ошибке API показывается сообщение, а не пустой блок.
- **`Globus3DPlaceholder`:** тёмный стиль как у слота глобуса.

Ключевые файлы: `src/app/page.tsx`, `src/app/components/Globus3D.tsx`, `Globus3DPlaceholder.tsx`, `PlanetPulse.tsx`.

## Деплой (MVP)

- Добавлены **`AEVION_DEPLOY.md`** (пошагово: GitHub → Railway + Postgres → Vercel, что куда вставлять), **`frontend/.env.example`**, **`frontend/vercel.json`**.
- В **`README.md`** в таблицу документов добавлена ссылка на деплой.

**Важно для Vercel:** `BACKEND_PROXY_TARGET` = публичный URL API **без** завершающего `/`. Root Directory = **`frontend`**. Для API на Railway/Render root = **`aevion-globus-backend`**, build/start и переменные — в `AEVION_DEPLOY.md`.

## GitHub / скрин пользователя

- Репозиторий: **`Dossymbek281078/AEVION`** — его подключать к Vercel и Railway при совпадении структуры папок (`frontend`, `aevion-globus-backend`). Если структура другая — пути в панелях нужно скорректировать.

## Как снова открыть «чат»

1. **История Cursor:** чаты обычно доступны в боковой панели AI / списке прошлых разговоров (зависит от версии Cursor).
2. **Этот файл:** быстрая выжимка по темам чата для репозитория и команды.

---

*При необходимости обновите дату в имени файла или перенесите содержимое в `AEVION_WORKLOG_*.md`.*

## Дополнение (автономный режим, позже)

- Пользователь попросил продолжать разработку без пауз и подтверждений, а к Vercel/GitHub вернуться позднее.
- Запущена следующая итерация продукта: добавляется единый хаб `awards` (музыка + кино + агрегированные метрики Planet).

## Дополнение (автономная UX-итерация Planet + Awards)

- В `Planet` добавлены быстрые пресеты Music/Film, автозаполнение полей заявки и подсказки по productKey.
- Добавлено локальное автосохранение черновика формы Planet (восстановление после перезагрузки при отсутствии preset-параметров в URL).
- В блок результата Planet добавлены явные CTA: открыть карточку артефакта, вернуться в витрину премии, начать новую заявку.
- В `awards/music` и `awards/film` усилен deep-link на Planet (`type/preset/productKey/title`) и добавлен CTA «Подать работу в Planet» в хабе `/awards`.
