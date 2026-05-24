# DaVinci Resolve — монтажная схема 90-сек pitch видео

> Cue-sheet с таймкодами для импорта в DaVinci Resolve. Рядом лежит готовый `frontend/public/promo/aevion-acquire.fcpxml` — открой Resolve → File → Import → Timeline → выбери fcpxml → весь edit развернётся с правильными cue-points.
> Файлы аудио в `frontend/public/promo/`: `aevion-acquire-music.mp3` (underbed) + `aevion-acquire-ru.mp3` (VO) + `aevion-acquire-en.mp3` (VO alternate).

---

## Project settings

| Параметр | Значение |
|----------|----------|
| Frame rate | 24 fps (cinematic) или 30 fps если нужен YouTube/web standard |
| Resolution | 1920 × 1080 (16:9) |
| Sample rate | 48 kHz |
| Output | H.264, 8-12 Mbps, AAC 192 kbps |
| Duration | 90 секунд ровно |

---

## Audio tracks (3 stems)

| Track | Файл | Start | Duration | Volume |
|-------|------|-------|----------|--------|
| Music underbed | `aevion-acquire-music.mp3` | 0:00 | 92 сек | -16 dB (under VO) |
| VO RU | `aevion-acquire-ru.mp3` | 0:00 | ~85 сек | 0 dB |
| VO EN | `aevion-acquire-en.mp3` | 0:00 | ~80 сек | 0 dB (disabled by default; switch for EN version) |

**Note:** музыка длиннее VO — финальные 2-5 секунд только музыка с резолвом C-minor (см. `03_VIDEO_STORYBOARD.md`).

---

## Video track — 9 cuts

| # | Start | End | Длительность | Контент | Notes |
|---|-------|-----|--------------|---------|-------|
| 1 | 0:00 | 0:08 | 8 с | **Хаос 15 вкладок** — монтажная сборка 15 SaaS-логотипов на тёмном фоне | screencap, или коллаж в After Effects/Resolve Fusion |
| 2 | 0:08 | 0:14 | 6 с | **Боль биллингов** — курсор переключается, появляются $39/$49/$99... итог "$427/мес" | text-on-screen |
| 3 | 0:14 | 0:22 | 8 с | **Тишина** — fade to black, beat-drop в музыке | hold black |
| 4 | 0:22 | 0:34 | 12 с | **AEVION reveal** — логотип AEVION (gradient emerald→blue), пульсирующая планета, подпись «Planet AEVION» | logo animation |
| 5 | 0:34 | 0:48 | 14 с | **DevHub в работе** — screen-recording `/devhub`: deploy Vercel + ElevenLabs VO + Brevo campaign + Stripe checkout = 4 зелёных галочки за 20 сек | **OBS screencap нужен** |
| 6 | 0:48 | 1:00 | 12 с | **Три макроволны** — три круга (Banking → API, IP → on-chain, Dev → agent-layer), сходятся в центр | Resolve Fusion или AE |
| 7 | 1:00 | 1:14 | 14 с | **Что уже работает** — быстрый коллаж скриншотов: `/constitution`, `/planet`, `/cyberchess`, `/healthai`, `/qsign`, `/devhub`, `/transparency` с зелёной «LIVE» точкой на каждом | **OBS screencaps нужны** |
| 8 | 1:14 | 1:24 | 10 с | **Зачем покупать** — на чёрном фоне 4 строки: «AEV — нельзя купить», «Constitution — нельзя написать», «9 интеграций — не пройти комплаенс», «30 модулей — не собрать» | text-on-screen typewriter effect |
| 9 | 1:24 | 1:30 | 6 с | **Сделка** — emerald фон, $1B USD net + Senior Advisor + acquire@aevion.app | hero card, fade to music tail |

---

## Шрифты и палитра (для consistency с `/acquire`)

- Шрифт: **Inter** (700/900) для всех overlay-текстов. Скачать с https://fonts.google.com/specimen/Inter.
- Палитра:
  - Фон: `#0a0e1a` → `#0f172a` linear gradient
  - Accent emerald: `#10b981`
  - Accent blue: `#3b82f6`
  - Accent purple: `#a855f7`
  - Gradient hero: `linear-gradient(135deg, #10b981, #3b82f6, #a855f7)`

---

## Что снять локально (OBS Studio)

Для кадров 5 и 7 нужны screencaps продакшна aevion.app. Открой **OBS Studio** (https://obsproject.com), настрой:
- Resolution: 1920×1080, 30 fps
- Output: MOV ProRes (или MP4 H.264 если ProRes недоступен)
- Source: Display Capture или Window Capture браузера

### Кадр 5 — DevHub flow (записать ~20 сек одним дублем)

1. Открой `https://aevion.app/devhub`
2. Запусти OBS record
3. Кликни **Deploy** → выбери Vercel → подтверди (галочка появится)
4. Параллельно кликни **Generate voiceover** → ElevenLabs
5. Параллельно кликни **Send campaign** → Brevo
6. Параллельно кликни **Create checkout** → Stripe
7. Останови OBS когда 4 галочки видны

### Кадр 7 — Live status коллаж (10 sec, по 1.5 сек на скрин)

Открой эти URL по очереди, сделай скриншот каждого:
- https://aevion.app/constitution
- https://aevion.app/planet
- https://aevion.app/cyberchess
- https://aevion.app/healthai
- https://aevion.app/devhub
- https://aevion.app/transparency
- https://aevion.app/launch-status

Можно использовать встроенный Snipping Tool Windows или OBS снимок кадра. На каждом скрине наложить зелёную точку «LIVE» (Resolve title с background colorset).

---

## Финальный экспорт

| Версия | Файл | Параметры |
|--------|------|-----------|
| RU | `frontend/public/promo/aevion-acquire-ru.mp4` | 1920×1080, 30 fps, 8 Mbps H.264, AAC 192 stereo |
| EN | `frontend/public/promo/aevion-acquire-en.mp4` | same |
| Poster | `frontend/public/promo/aevion-acquire-poster.jpg` | 1920×1080, JPG 90% — кадр 4 (логотип AEVION с планетой) |
| YouTube backup | unlisted upload | для embed в email при падении CDN |

---

## Workflow итог

1. **Импорт FCPXML** → `frontend/public/promo/aevion-acquire.fcpxml` в Resolve.
2. **Снять OBS** → кадры 5 и 7 (15 минут).
3. **Поверх:** добавить text overlays для кадров 1, 2, 8, 9 (по cue-sheet выше).
4. **Подложить:** music underbed + VO ru/en в правильные slots (FCPXML уже разложил, проверь).
5. **Color grade:** только если хочешь — Resolve по-умолчанию выдаст приемлемый flat-look.
6. **Render** → 2 mp4 файла + poster jpg в `frontend/public/promo/`.
7. **Закоммитить** → плеер на `/acquire` автоматически переключится с audio-only на full video.

Расчётное время монтажа: **2-3 часа** (с включёнными screencaps + первый рендер).

---

— редакция 2026-05-22, AEVION
