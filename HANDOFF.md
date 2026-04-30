# AEVION CyberChess — HANDOFF (2026-04-26 → 04-27 night session)

Этот документ — точка входа для продолжения работы на другом ноутбуке.

---

## TL;DR — как возобновить сессию утром

```bash
# 1. На другом ноутбуке — клонировать (если ещё нет) или подтянуть
git clone https://github.com/Dossymbek281078/aevion-core.git
cd aevion-core
git pull origin main

# 2. Установить зависимости (Windows ВАЖНО: --include=optional)
cd frontend
npm install --include=optional

# 3. Запустить dev (предпочтительно порт 3000 — backend ждёт оттуда CORS)
npm run dev

# 4. Запустить backend (отдельный терминал из корня)
cd backend
npm install
npm start  # слушает 4001

# 5. Открыть Claude Code из корня aevion-core, прислать промпт ниже
```

**Промпт для Claude Code на другом ноуте:**

> Продолжаем CyberChess. Прочитай HANDOFF.md в корне — там итог ночной сессии. Цель остаётся: сделать приложение лучшим в мире среди шахматных. Следующая задача из roadmap — Personal Opening Repertoire builder (отслеживание твоего дебютного репертуара + предупреждения когда уходишь от него). Стартуем с этого.

---

## Что сделано в эту ночную сессию (2026-04-26 → 04-27)

> Серия из 6 commits на `main`. Production build (`npx next build`) зелёный после каждого.
> Последний commit: см. `git log --oneline -1`.

### Файлы новые в эту сессию (всего)
- `BoardArt.tsx` — 5 SVG-узоров (Hokusai, Эйфель, шанырак, персидская геометрия, Klimt).
- `OpeningExplorer.tsx` — дерево вариантов из текущей позиции с ECO band.
- `P2P.tsx` — useP2P hook поверх PeerJS CDN, WebRTC data channel.
- `Repertoire.tsx` — модал «📚 Мой дебютный репертуар» с persist + stats per entry.
- `Tablebase.tsx` — панель perfect-play для ≤7 фигур через tablebase.lichess.ovh.
- `FamousGames.tsx` — библиотека из 10 классических партий (PGN).

### Backbone-фичи (большие)


### 🤖 Bot personalities (вместо безликих AI-уровней)

`page.tsx:21,35-65` — каждый из 6 уровней теперь персонаж:

| Level | Персонаж | Флаг | Стиль | ELO |
|---|---|---|---|---|
| Beginner | Рома Новичок | 🇰🇿 | Хаотичная атака · часто зевает | 400 |
| Casual | Сара Кэжуал | 🇪🇸 | Спокойный позиционный стиль | 800 |
| Club | Клаус Клубмейстер | 🇩🇪 | Знает дебюты · крепкая защита | 1200 |
| Advanced | Анна Аналитик | 🇷🇺 | Глубокий миттельшпиль | 1600 |
| Expert | Эрик Эксперт | 🇸🇪 | Тактический · любит жертвы | 2000 |
| Master | Магнус Мишра | 🇮🇳 | Универсальный · ФИДЕ-мастер | 2400 |

- Setup-экран: grid 3×2 SVG-портретов с флагами + цитата.
- Во время игры: персональный SVG-аватар вместо обезличенного 🤖.
- После партии: бот реагирует цитатой через 1.4с (`page.tsx:1037-1042`).

### 🎨 Свой набор фигур "AEVION" (`Pieces.tsx`)

- Полностью оригинальные SVG-пути (с нуля, не Cburnett).
- Геометрический modern-flat стиль с soft 3D через highlight + ground-shadow.
- Каждая фигура: подложка-эллипс + основной силуэт + внутренние highlight линии.
- Палитра: белые `#f8fafc` + `#1e293b` штрих, чёрные `#1e293b` + `#94a3b8` подсветка.
- **Старый набор Cburnett (CC BY-SA) сохранён** как опция "Classic".
- Переключатель в карточке "Доска и фигуры" (chip-tabs).

### ✨ Анимации фигур (`globals.css:341-352`, `page.tsx:2480`)

- `cc-piece-place` — фигура «приземляется» с лёгким overshoot после хода (0.28s, ease-out-back).
- `cc-piece-breathe` — выбранная или premove-source фигура «дышит» (scale 1.08↔1.13, infinite).
- Just-moved клетка слегка масштабирует фигуру (scale 1.04).
- Transition сокращён 0.18s → 0.10s для snappy feel + `will-change: transform` для GPU.

### 🪪 Темы доски расширены (`page.tsx:259-275`)

12 свободных + 3 премиум:
- **AEVION** (signature `#e8efe9`/`#2c3b3a`) — фирменная.
- Mint, Slate, Sand — новые free.
- Classic, Emerald, Ocean, Purple, Wood, Dark, Ice, Rose — оригинальные.
- Premium: Neon, Obsidian, Sakura.

Storage key bumped `_v1` → `_v2` чтобы новые юзеры стартовали с AEVION.

### 🎨 Художественные фоны на доске (`BoardArt.tsx`)

5 оригинальных SVG-узоров (рисуем сами, без растровых картинок):
- **Волна** — гребень в стиле Хокусая (Большая волна, PD с 1849).
- **Эйфель** — силуэт башни с решёткой.
- **Шанырак** — казахский орнамент 🇰🇿.
- **Персид.** — 8-конечные звёзды исламской геометрии.
- **Klimt** — золотые круги (PD после 2018).

**ВАЖНО про права:** Marvel/Disney умышленно НЕ трогаем — всё public domain или собственная отрисовка.

Реализация в `page.tsx:2487-2489`:
- Overlay с `mix-blend-mode: overlay`, прозрачность настраивается слайдером 3-25%, дефолт 10%.
- Persist в `aevion_board_art_v1` + `aevion_board_art_op_v1`.

### 🚀 Скорость ходов и premoves

- AI delay min: `Math.max(800, delay)` → `Math.max(180, delay)` (`page.tsx:1215`). Теперь AI начинает считать через ~180мс вместо 800.
- `touchAction: "manipulation"` + `WebkitTapHighlightColor: "transparent"` на каждой клетке — убирает 300мс double-tap-zoom delay на мобильных.
- Piece transition: 0.18s → 0.10s.
- Удалён `console.log` из премув-очереди.

### 🎙 Голосовой ввод улучшен

В `page.tsx:2631-2649`:
- `interimResults: true` — Web Speech начинает стримить сразу, не буферизит.
- `maxAlternatives: 4 → 5`.
- При старте — короткий **beep 880Hz** через WebAudio (подтверждение слушания).
- Через `enumerateDevices()` показываем тост с именем активного микрофона: «🎙 Микрофон: Bose QC35 II · +2 устр.» — пользователь видит, переключился ли на наушники. Если не на нужный — меняет в OS, перезапускает голос.

### 🎬 Studio Mode — auto-fetch live стримеров

В `studio/page.tsx`:
- Новая первая вкладка SourcePicker **«🔴 СЕЙЧАС в эфире»**.
- Источник: `https://lichess.org/api/streamer/live` (CORS, без авторизации).
- Автообновление каждые 60 сек, кнопка ↻, поиск по имени/языку/титулу.
- Кнопки **📺 Twitch** + **💬 Чат** (Twitch) или **▶ YouTube live**.
- **Twitch chat overlay** — отдельный SourceKind `twitch-chat` (embed `/embed/{ch}/chat?parent=...&darkpopout`).
- **PiP мини-шахматы** — плавающий drag/resize iframe `/cyberchess?embed=1`, тоггл «♞ PiP» в top bar.

### 📖 Opening Explorer (`OpeningExplorer.tsx`)

В стиле Lichess но своё:
- Загружается в analysis/coach табе при `hist.length<=22`.
- Из текущей FEN строится дерево возможных продолжений по `openingsDb`.
- Каждая ветка: SAN-ход (моноширинный, цвет по ECO-band: A=голубой, B=янтарный, C=красный, D=пурпурный, E=зелёный) + название топ-дебюта + count + percentage.
- Клик на ветку играет ход (в analysis/coach view) или делает реальный ход (в live game на твоём ходу).
- Bottom bar показывает proportion-визуализацию вариантов.

### 🌐 P2P игра с другом через WebRTC (`P2P.tsx`)

Без бэкенда AEVION — через PeerJS public broker.
- В setup новая кнопка **«🌐 С другом онлайн»** (фиолетовый градиент).
- Хост создаёт комнату → получает 6-знач. код типа `RKDP4M` + ссылку `?room=RKDP4M&color=w`.
- Друг открывает ссылку → автоподключение, берёт противоположный цвет.
- Сообщения: `mv` (ход), `resign`, `draw-offer/accept`, `rematch/accept`, `ping/pong` (показывает latency).
- Resign/Draw/Rematch кнопки автоматически отправляются по сети в P2P-режиме.
- В opponent-панели вместо бота показывается «👥 [имя друга]» + бейдж «P2P · 23мс».
- При рематче цвета меняются автоматически.

### 🛒 Shop reorganized (`page.tsx:4087-4170`)

- Smart **«⭐ Подобрано для тебя»** секция — 3 рекомендации на основе rating, streak, кол-ва пазлов, hint inventory, длины партии.
- Items сгруппированы: **⚡ Power-ups · 🔓 Permanent unlocks · 🚀 Бусты · 🎨 Темы**.
- Featured cards с accent border + glow + animated badge.
- **Premium puzzles** теперь даёт реальный perpetual benefit — ×2 Chessy за каждый пазл. Cost bumped 30 → 80.

### 🎓 Coach как живой человек (`AiCoach.tsx`)

- SVG-портрет «Алексея» (turtleneck, очки, улыбка) вместо 🤖 в header и в greeting card.
- Typewriter-эффект для assistant сообщений (3-8 chars/tick).
- TTS озвучка через SpeechSynthesis с авто-выбором RU голоса, voice picker.
- Bouncing dots typing indicator («Алексей печатает...»).
- Greeting карточка с приветствием по времени суток + streak/rating context.

### 📊 Launchpad перегруппирован (`page.tsx:2173,2214`)

Дашборд-виджеты разделены подзаголовками:
- **📊 Статистика**: Rating · Chessy · Ачивки · Win Rate.
- **🧰 Инструменты**: Puzzles · Coach · Analysis · DNA.

### 🔧 Layout polish

- Кнопки под доской перегруппированы по контексту (всегда / во время игры / после партии).
- Правая панель: `flex 1 1 360px, minWidth 300, maxWidth 560` (было 440/380/720).
- Каждая кнопка строго в своём контексте — больше не дублируется между рядами.

### 🐛 Bug fix

- `ChessyState.owned: Record<string, boolean>` → `Record<string, boolean|string>` (`page.tsx:165`) — позволяет хранить `hint_credits` (строка с числом) и `daily_double_until` (строка с timestamp). Production build теперь зелёный.

### 📚 Personal Opening Repertoire (`Repertoire.tsx`)

- Модал «📚 Мой репертуар» — сохраняй текущую дебютную последовательность как именованную линию для своего цвета (white / black).
- Storage в `aevion_repertoire_v1`. Per-entry stats: uses, wins, losses, draws, win rate.
- В live-game в opening detection card два бейджа: **📖 В РЕПЕРТУАРЕ** (зелёный) если текущая позиция совпадает с сохранённой линией, **↗ ВНЕ КНИГИ** (оранжевый) если ушёл от своего репертуара.
- Если в книге и есть запланированный продолжение: кнопка ▶ {nextMove} играет его одним кликом.
- Stats авто-обновляются при game-over для самой глубокой совпавшей линии.
- Хоткей **R** открывает / закрывает модал.

### 🧮 Tablebase для эндшпилей (`Tablebase.tsx`)

- В analysis/coach табе (после 14 ходов) появляется панель TABLEBASE.
- Запрос к `https://tablebase.lichess.ovh/standard?fen=...` (бесплатный публичный API).
- Только для позиций с ≤7 фигур (для них существует решённая 7-фигурная база Lomonosov 2018).
- Throttle 350мс + module-level cache по FEN.
- Показывает классификацию (WIN/LOSS/DRAW + cursed-win/blessed-loss), DTZ, до 8 best-moves кнопок.
- Клик играет ход.

### 🏆 Famous Games library (`FamousGames.tsx`)

- 10 классических партий (PGN, public domain — нотация не охраняется авторским правом):
  - Морфи vs герцог Брауншвейгский (Опера, 1858)
  - Андерссен vs Кизерицкий (Бессмертная, 1851)
  - Андерссен vs Дюфрень (Вечнозелёная, 1852)
  - Каспаров vs Топалов (Вейк-ан-Зее 1999, «Бессмертная Каспарова»)
  - Фишер vs Спасский партия 6 (WC 1972)
  - Полугаевский vs Нежметдинов (Сочи 1958)
  - Бирн vs Фишер «Партия века» (NY 1956)
  - Карлсен vs Ананд WC 2013 партия 9
  - Карлсен vs Каруана WC 2018 партия 12
  - Каспаров vs Deep Blue 1996 партия 1
- Каждая партия: emoji, lesson (один абзац — почему важна), ECO, players.
- Карточка «🏆 Великие партии» в Launchpad → модал → клик загружает PGN в Analysis tab.
- Хоткей **G** открывает модал.

### 📝 PGN export с annotations

- `buildPGN()` теперь принимает `analysis` массив и эмитит PGN NAGs:
  - `$1` = `!`, `$2` = `?`, `$3` = `!!`, `$4` = `??`, `$5` = `!?`, `$6` = `?!`
- Каждый ход получает `[%eval +0.42]` или `[%eval #5]` комментарий.
- Header `[Annotator "AEVION Stockfish"]` добавлен.
- Экспортированный PGN сразу совместим с lichess.org/import, chess.com analysis, scid и др.

### 🎭 Persona-aware "thinking" lines

- Каждый бот теперь имеет свою фразу когда думает:
  - Рома — «хм…»
  - Сара — «размышляю»
  - Клаус — «планирую»
  - Анна — «анализирую»
  - Эрик — «вижу комбинацию»
  - Магнус — «считаю варианты»
- Status-bar labels переведены на RU.

### ⌨ Новые хоткеи

- `R` — toggle 📚 Repertoire модал
- `G` — toggle 🏆 Great Games модал
- (старые: ←/→ ходы, Home/End, F flip, M mute, N new game, Esc clear premoves, ?  help, ПКМ-drag arrows)
- Help модал обновлён.

### 👋 Onboarding

- Первый визит в `/cyberchess` показывает плавающую welcome-карточку справа-снизу с 5 пунктами (Quick Start / С другом / Репертуар / Великие партии / Coach).
- Скрывается через 22 сек или по кнопке «Понял». Persistent flag `aevion_cc_visited_v1`.

---

## Файлы изменённые / новые в эту сессию

```
M frontend/next.config.ts                  (per-route COEP headers — done в прошлой сессии)
M frontend/src/app/cyberchess/AiCoach.tsx  (SVG аватар Алексея)
M frontend/src/app/cyberchess/Pieces.tsx   (новый AEVION-набор + Cburnett fallback)
M frontend/src/app/cyberchess/page.tsx     (большая часть фич — bot personas, P2P, opening explorer, art, shop)
M frontend/src/app/cyberchess/ui.tsx       (Tooltip popover — done в прошлой сессии)
M frontend/src/app/globals.css             (cc-piece-place + cc-piece-breathe keyframes)

NEW frontend/src/app/cyberchess/BoardArt.tsx        (5 SVG art overlays)
NEW frontend/src/app/cyberchess/CoachPredictions.tsx (top-3 opponent moves widget — прошл. сессия)
NEW frontend/src/app/cyberchess/DailyMission.tsx     (4-target daily plan — прошл. сессия)
NEW frontend/src/app/cyberchess/OpeningExplorer.tsx  (FEN-tree of opening continuations)
NEW frontend/src/app/cyberchess/P2P.tsx              (PeerJS WebRTC hook)
NEW frontend/src/app/cyberchess/WhatIfButton.tsx     (per-multipv Coach explanation — прошл. сессия)
NEW frontend/src/app/cyberchess/gameShare.ts         (SVG share image — прошл. сессия)
NEW frontend/src/app/cyberchess/studio/page.tsx      (Studio mode — прошл. сессия + сегодня live streamers)
```

---

## Roadmap — что дальше для «лучшее шахматное приложение планеты»

### Приоритет 1 (следующая сессия)

- [ ] **Personal Opening Repertoire builder** — пользователь сохраняет свой репертуар (за белых / за чёрных), система предупреждает когда играешь не свой дебют. Killer-фича Pro chess.com.
- [ ] **Tournament organizer** — Swiss/Round-Robin для друзей через тот же P2P-канал, ladder system.
- [ ] **Opening Explorer enhancement** — добавить win-rate за/против каждого хода (на основе сохранённых партий пользователя + симулированных против каждого бота).

### Приоритет 2 (дальше)

- [ ] **Speech-to-move через Whisper API** (на сервере) — заменит Web Speech, идеальное распознавание + независимо от браузера. Backend endpoint `/api/voice/transcribe`.
- [ ] **Personal AI clone** — после 50 партий обучаем мини-модель твоего стиля, играешь против себя.
- [ ] **Tablebase для эндшпилей** — встроенная Syzygy 5-piece tablebase для perfect endgame play.
- [ ] **Replay studio** — генерация highlight reel из партии (best moves, blunders, finish) как короткое видео для соцсетей.

### Приоритет 3 (амбициозное)

- [ ] **AR-режим через WebXR** — играть на физическом столе через камеру.
- [ ] **Voice + face emotion analysis** — Coach реагирует на твоё выражение лица во время blunder.
- [ ] **Глобальная P2P-лестница** — DHT-based ranking без центрального сервера.

---

## Важные технические нюансы

- **PeerJS CDN**: `https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js` — публичный broker `0.peerjs.com`. Если CDN заблокирован, P2P падает с status `error` и осмысленным сообщением.
- **COEP**: `/cyberchess/*` использует `require-corp` для Stockfish SharedArrayBuffer. Studio (`/cyberchess/studio`) переопределён на `unsafe-none` чтобы пускать Twitch/YouTube iframes с cookies.
- **Storage keys** активные:
  - `aevion_chess_theme_v2` (board theme idx)
  - `aevion_piece_set_v1` (aevion / cburnett)
  - `aevion_board_art_v1` + `_op_v1`
  - `aevion_studio_v3` (studio panes)
  - `aevion_studio_pip_v1` (PiP position)
  - `aevion_p2p_name_v1` (P2P display name)
  - `aevion_coach_tts_v1` + `_voice_v1`
  - `aevion_ladder_hist_v1`, `aevion_daily_mission_v1`, `aevion_coach_pred_v1`, `_stats_v1`

- **Backend**: `backend/server.js` слушает 4001, endpoint `/api/coach/chat` ожидает Anthropic API ключ в `.env` (`ANTHROPIC_API_KEY`).

- **gh CLI** на этом ноуте по полному пути: `"/c/Program Files/GitHub CLI/gh.exe"`. Авторизован как `Dossymbek281078`.

---

## Известные NOT-DONE / TODO в коде

- Voice input всё ещё использует Web Speech API (зависит от Chrome). Whisper-backend в roadmap.
- P2P не имеет fallback signalling — если PeerJS broker упадёт, P2P не работает. Можно добавить self-host через peer-server npm package.
- Opening Explorer показывает только до 22-го полухода (после этого "outside of book").
- Premove sometimes can fire on illegal positions if AI played unexpected continuation — handler в `doPremove` уже фильтрует, но edge cases возможны.
- Background art `mix-blend-mode: overlay` слегка тинтит фигуры на тёмных темах — приемлемо при дефолтных 10% opacity.

---

## Команды для дев-окружения

```bash
# Frontend dev
cd frontend && npm run dev          # порт 3000

# Frontend prod build (для смоук-теста перед коммитом)
cd frontend && npx next build       # должен быть зелёный

# TypeScript check без сборки
cd frontend && npx tsc --noEmit -p .

# Backend (Coach API proxy)
cd backend && npm start             # порт 4001

# Запустить Studio mode напрямую
http://localhost:3000/cyberchess/studio

# P2P игра — host создаёт комнату, делится URL вида:
http://localhost:3000/cyberchess?room=RKDP4M&color=w
```
