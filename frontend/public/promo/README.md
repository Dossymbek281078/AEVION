# `/public/promo/` — media assets для `/acquire`

Папка ждёт три файла (имена жёстко прописаны в `frontend/src/app/acquire/page.tsx`):

| Файл | Что | Длительность |
|------|-----|---------------|
| `aevion-acquire-ru.mp3` | RU voiceover | ~90 сек |
| `aevion-acquire-en.mp3` | EN voiceover | ~90 сек |
| `aevion-acquire-music.mp3` | Инструментал | 92 сек |
| `aevion-acquire-poster.jpg` | Постер для `<video>` (опционально) | — |
| `aevion-acquire-ru.mp4` | Финальный смонтированный клип RU (опционально) | 90 сек |
| `aevion-acquire-en.mp4` | Финальный смонтированный клип EN (опционально) | 90 сек |

## Как сгенерить через ElevenLabs (после исправления API key)

```bash
# 1. В ~/.claude/settings.local.json убедиться, что ELEVENLABS_API_KEY валидный.
# 2. В этом чате сказать «генерируй аудио + музыку» —
#    я снова вызову mcp__elevenlabs__text_to_speech и compose_music.
```

## Параметры озвучки (если делаешь через Web UI)

- **Модель:** `eleven_multilingual_v2`
- **Settings:** stability 0.55 · similarity_boost 0.78 · style 0.2 · use_speaker_boost true · speed 0.95
- **Тексты:** `script-ru.txt` и `script-en.txt` рядом.

## Музыка (Web UI или MCP)

См. `promo/03_VIDEO_STORYBOARD.md` секцию «Музыка — ElevenLabs Music prompt». Длина — 92 000 мс.

## Видео-сборка

Сториборд + workflow — в `promo/03_VIDEO_STORYBOARD.md`. Скринкасты `/devhub` снимай в OBS Studio (1920×1080, 30 fps), монтаж — DaVinci Resolve.

## Что увидит покупатель если файлов нет

На `/acquire` показывается секция-плейсхолдер с кнопкой «Open script», ведущей на `script-ru.txt` / `script-en.txt`. Это безопасный fallback — страница не падает, и покупатель видит, что было задумано.
