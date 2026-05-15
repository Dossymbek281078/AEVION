# Mobile Responsive Audit — 2026-05-14

Аудит 9 новых/расширенных файлов на mobile-проблемы. Все правки нацелены только на реально-проблемные случаи (overflow, iOS zoom, sticky overlap, fixed-width grid colaps).

---

## 1. `frontend/src/app/qstore/[id]/page.tsx` (item detail)

**Найдено:**
- Hero grid `gridTemplateColumns: "minmax(0, 1fr) 320px"` — на mobile 320px правая колонка вылезает за viewport.
- Sticky purchase card на mobile перекрывает контент при скролле.
- Side padding `24px` многовато для узких экранов.

**Поправлено:**
- Hero grid вынесен в className `qstore-hero-grid` с media query: `@media (max-width: 768px)` → `grid-template-columns: 1fr`.
- Sticky отключается на mobile через class `qstore-purchase-card` (на `<768px` становится `static`).
- Padding изменён с `32px 24px 80px` → `32px 16px 80px`.

**Не трогали:** review form / reviews list (уже стандартный flex flex-direction column, ОК).

---

## 2. `frontend/src/app/qstore/page.tsx` (marketplace)

**Найдено:**
- Search input `minWidth: 140` + `fontSize: 13` → на iOS вызывает zoom при фокусе.
- Product grid `minmax(280px, 1fr)` может вылезти за viewport при ширине <300px.
- Side padding 24px.

**Поправлено:**
- Search input: `fontSize: 13` → `16` (анти-iOS zoom), добавлен `flex: "1 1 160px"` + `maxWidth: 240`.
- Product grid: `minmax(280px, 1fr)` → `minmax(min(100%, 260px), 1fr)` (защита от overflow).
- Padding: `40px 24px 80px` → `32px 16px 80px`.

**Не трогали:** Featured tabs (`flexWrap: "wrap"` уже есть), create form (внутри редко используется).

---

## 3. `frontend/src/app/planet/activity/page.tsx` (feed page)

**Найдено:**
- `<main>` без `overflow-x: hidden` (потенциальный риск если дочерний компонент создаст overflow).
- h1 `fontSize: 30` крупно для маленьких экранов.

**Поправлено:**
- `<main style={{ overflowX: "hidden" }}>`.
- h1 `fontSize: "clamp(22px, 5vw, 30px)"` — fluid heading.

**Не трогали:** Wave1Nav, ProductPageShell (вне списка).

---

## 4. `frontend/src/app/qevents/page.tsx` (events)

**Найдено:**
- CreateEventModal inputs `fontSize: 14` → iOS zoom при фокусе.
- Modal `padding: 28` слишком много на mobile (модал и так в `padding: 20` контейнере).
- Events grid `minmax(280px, 1fr)` риск overflow на узких экранах.

**Поправлено:**
- `inputStyle.fontSize: 14` → `16` (анти-iOS zoom).
- Modal padding `28` → `clamp(16px, 4vw, 28px)`.
- Events grid: `minmax(min(100%, 260px), 1fr)`.

**Не трогали:** Time tabs / Category tabs (`flexWrap: "wrap"` уже есть, ОК).
EventCard layout (внутренний padding 16 нормальный, кнопки full-width column).

---

## 5. `frontend/src/app/qlearn/page.tsx` (courses + StreakBadge + bookmarks)

**Найдено:**
- Modal inputs/selects `fontSize: 14` → iOS zoom.
- Modal `padding: 28` много для mobile.
- Modal не имел `maxHeight` + `overflowY: auto` — длинная форма на маленьком экране уходит за viewport.
- Modal selects без `minWidth: 0` — в `1fr 1fr` grid могут вылезти.
- Course grid `minmax(280px, 1fr)` риск.
- Continue learning cards `minWidth: 240` → форсирует overflow если контейнер уже.
- Continue grid `minmax(260px, 1fr)` риск.
- Side padding 24px.

**Поправлено:**
- Все inputs/selects/textarea: `fontSize: 16` + `boxSizing: "border-box"` + `width: 100%`.
- Selects: добавлен `minWidth: 0`.
- Modal: padding `28` → `clamp(16px, 4vw, 28px)`, outer padding `24` → `16`, добавлены `maxHeight: 90vh` + `overflowY: auto`.
- Course grid: `minmax(min(100%, 260px), 1fr)`.
- Continue learning cards: `minWidth: 240` → `minWidth: 0`.
- Continue grid: `minmax(min(100%, 240px), 1fr)`.
- Page padding: `40px 24px 80px` → `32px 16px 80px`.

**Не трогали:** StreakBadge, CourseCard sizing, bookmark panel (`overflow + ellipsis` корректные для title).

---

## 6. `frontend/src/app/devhub/page.tsx` (snippet shelf + projects)

**Найдено:**
- Header `flex justify-between` без `flexWrap` — кнопка "New Project" сжимается рядом с заголовком на mobile.
- Modal `padding: 32` много для mobile + нет maxHeight/scroll (Stack 1fr 1fr внутри может не помещаться).
- Modal `padding: 16/24` контейнера тоже большой.
- Projects grid `minmax(320px, 1fr)` — overflow риск на экранах <340px.
- Modal inputs `fontSize: 14` → iOS zoom.
- Root `<div>` без `overflowX: hidden`.

**Поправлено:**
- Header: добавлены `flexWrap: "wrap", gap: 12`.
- Root: `overflowX: "hidden"`, page padding `28px 24px` → `28px 16px`.
- Modal outer padding +`padding: 16` для безопасности на мелких экранах.
- Modal: `padding: 32` → `clamp(16px, 4vw, 32px)` + `maxHeight: 90vh` + `overflowY: auto`.
- Inputs (name, description): `fontSize: 14` → `16`.
- Projects grid: `minmax(min(100%, 280px), 1fr)`.

**Не трогали:** Snippet shelf полностью на Tailwind (уже хорошо: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, `sm:p-8`, `sm:flex-row`).

---

## 7. `frontend/src/components/PlanetActivityFeed.tsx`

**Найдено:**
- Item description с `whiteSpace: "nowrap"` + ellipsis: на mobile вся осмысленная инфа в title уходит в ellipsis сразу — теряем 90% контента.

**Поправлено:**
- Заменено на `display: -webkit-box` + `WebkitLineClamp: 2` + `wordBreak: "break-word"` (2 строки текста на mobile, не 1).

**Не трогали:** Tabs (`flexWrap: "wrap"` уже есть), grid `auto 1fr auto` корректный (icon + content + time).

---

## 8. `frontend/src/components/MvpConceptBoard.tsx`

**Найдено:**
- Section padding `px-5` чуть мелковат для mobile (20px). Лучше 16px на mobile, 20px от sm.
- Inputs/textarea `text-sm` (14px) → iOS zoom на iPhone.

**Поправлено:**
- `px-5` → `px-4 sm:px-5`.
- Inputs/textarea: `text-sm` → `text-base sm:text-sm` (16px на mobile, 14px от 640px+).

**Не трогали:** Grid `grid-cols-1 md:grid-cols-2` (mobile-first, корректно), chip badges (компактные, ОК).

---

## 9. `frontend/src/components/ModuleOfTheDayCard.tsx`

**Найдено:** Ничего критичного.
- `flexWrap: "wrap"` уже стоит на всех flex-rows.
- `minWidth: 220` на main row — в большинстве контейнеров безопасно (карточка использована в product hero, обычно >280px).
- Текст description с `WebkitLineClamp: 2`, корректно.

**Поправлено:** ничего.

**Не трогали:** компонент УЖЕ адаптивный.

---

## Сводная таблица

| Файл | Mobile-issue | Status |
|---|---|---|
| qstore/[id]/page.tsx | Sticky purchase + 320px col overflow | Fixed (media query + class) |
| qstore/page.tsx | Search iOS zoom + grid overflow | Fixed |
| planet/activity/page.tsx | overflow-x + h1 oversize | Fixed (clamp) |
| qevents/page.tsx | Modal input iOS zoom + padding | Fixed |
| qlearn/page.tsx | Modal scroll, iOS zoom, grid risk | Fixed (full overhaul) |
| devhub/page.tsx | Header flex, modal scroll, iOS zoom | Fixed |
| PlanetActivityFeed.tsx | Description nowrap → теряем текст | Fixed (line-clamp 2) |
| MvpConceptBoard.tsx | Inputs iOS zoom + padding | Fixed (responsive Tailwind) |
| ModuleOfTheDayCard.tsx | — | OK (skip) |

## Применённые паттерны

1. **iOS zoom prevention:** все `<input>`, `<textarea>`, `<select>` имеют `font-size: 16px` (или `text-base` в Tailwind) — Safari Mobile перестаёт зумить.
2. **Safe grid columns:** `minmax(min(100%, X), 1fr)` вместо `minmax(X, 1fr)` — гарантирует что колонка не вылезет за viewport.
3. **Modal scrolling:** `maxHeight: 90vh` + `overflowY: auto` + `clamp()` для padding.
4. **Side padding:** mobile-first `16px`, desktop `24px+` (через clamp или фиксированный).
5. **overflow-x: hidden** на верхнем `<main>`/root — защита от рандомного overflow.
6. **Line-clamp** вместо `whiteSpace: nowrap` для feed items — сохраняет читаемость.

## Что НЕ затронуто

- Wave1Nav, ProductPageShell (вне списка задачи).
- Tailwind-секции уже mobile-first (snippet shelf).
- Reviews list, EventCard внутренний layout (уже flex-column с full-width кнопками).
- StreakBadge, CategoryBadge, LevelBadge (мелкие компоненты, padding tiny — норм).
