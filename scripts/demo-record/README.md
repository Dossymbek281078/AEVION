# AEVION Demo Recording Pipeline

Автоматическая сборка 9-минутного демо-видео из скриншотов + готового voiceover.

## Шаги

### Шаг 1 — Установить Playwright (один раз)
```
cd frontend
npx playwright install --with-deps chromium
```

### Шаг 2 — Сделать скриншоты (2 мин)
```
cd ..    # вернись в корень aevion-core
node scripts/demo-record/01-screenshot.mjs
```
Скриншоты сохраняются в `scripts/demo-record/screenshots/`

Против прода:
```
node scripts/demo-record/01-screenshot.mjs https://aevion.app
```

### Шаг 3A — Самый простой способ (без FFmpeg)

```
node scripts/demo-record/02-build-presentation.mjs
```

Откроет `demo-presentation.html` — самодостаточный HTML с аудио и слайдами.

1. Открой файл в Chrome двойным кликом
2. **Запусти запись экрана:**
   - Windows: `Win+G` → кнопка Record (или OBS)
   - Mac: `Cmd+Shift+5`
3. Нажми кнопку **▶ Начать демо**
4. Слайды переключаются автоматически по окончании каждого MP3
5. В конце — останови запись

Результат: MP4/WebM из скринрекордера (экранное качество 1080p).

### Шаг 3B — FFmpeg (лучшее качество)

Установи FFmpeg:
```
winget install ffmpeg     # Windows
brew install ffmpeg       # Mac
```

Затем:
```
node scripts/demo-record/03-ffmpeg-assemble.mjs
```

Результат: `scripts/demo-record/AEVION_DEMO.mp4` (~1080p, H.264+AAC)

## Структура

```
scripts/demo-record/
  01-screenshot.mjs        ← Playwright скриншоты
  02-build-presentation.mjs ← HTML презентация с аудио
  03-ffmpeg-assemble.mjs   ← FFmpeg финальный MP4
  screenshots/             ← Создаётся при запуске 01
  demo-presentation.html   ← Создаётся при запуске 02
  AEVION_DEMO.mp4          ← Создаётся при запуске 03

assets/demo/voiceover-ru/  ← 9 MP3 файлов (уже есть)
  01-opening.mp3
  02-qright.mp3
  03-qsign.mp3
  04-bureau-pay.mp3
  05-bureau-after.mp3
  06-aec-reward.mp3
  07-awards-planet.mp3
  08-bank.mp3
  09-closing.mp3
```

## После записи

1. Загрузи на YouTube (Unlisted)
2. Скопируй ссылку
3. Добавь в:
   - `docs/AEVION_DEMO_SCRIPT.md` → раздел "После демо"
   - `docs/press/PRESS_RELEASE.md` → строку "8-минутное демо"
   - `docs/press/EMAIL_REFERENCE_CUSTOMER.md` → шаблон D (investor)
