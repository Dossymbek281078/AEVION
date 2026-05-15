# CyberChess — фоновая музыка

Папка содержит **royalty-free** треки которые игрок может включать как фон во время игры.

## Как добавить трек

1. Положи MP3/OGG файл сюда: `frontend/public/music/<file>.mp3`
2. Открой `index.json` и добавь запись в массив `tracks`:

```json
{
  "id": "midnight-bishop",
  "name": "Midnight Bishop",
  "artist": "Author Name",
  "file": "midnight-bishop.mp3",
  "license": "CC0",
  "duration": 215
}
```

## Поля

| Поле | Что |
|---|---|
| `id` | уникальный slug (kebab-case) — стабильный, не меняется |
| `name` | название трека для UI |
| `artist` | автор |
| `file` | имя файла в этой папке (без `/music/` префикса) |
| `license` | CC0 / CC-BY / Free for non-commercial / Public Domain |
| `duration` | (опционально) длина в секундах |

## Где искать royalty-free

- [Pixabay Music](https://pixabay.com/music/) — CC0
- [Free Music Archive](https://freemusicarchive.org/) — CC0/CC-BY
- [YouTube Audio Library](https://studio.youtube.com/) — free for commercial
- [Incompetech](https://incompetech.com/music/) — CC-BY

**Не клади сюда** mainstream-треки (Spotify/Apple Music) — это нарушение авторских прав.
