# AEVION CyberChess — HANDOFF (живой)

> **Последнее обновление:** 2026-05-03 ~19:30 — drag/click/premove МЕХАНИКА всё ещё НЕ работает после полного переписывания дважды. Юзер останавливается, переходит на другой ноут чтобы попробовать продолжить с той сессии где механика работала.

---

## ТЕКУЩЕЕ СОСТОЯНИЕ (END-OF-SESSION 2026-05-03)

### ❌ ЧТО НЕ РАБОТАЕТ
- **Drag фигур мышью** — фигура не следует за курсором (или мелькает на миг)
- **Премувы** — не создаются драгом, премув-арроу показывают неверные ходы
- **Touch/touchpad** — не тестировалось

### ✅ ЧТО РАБОТАЕТ
- Click-to-move работает (юзер сделал ходы Nf3, Nc3 кликами)
- Опции: streamer overlay (YouTube/Twitch), 4 piece sets, settings
- v4 hook ЗАГРУЖЕН в браузер (зелёный баннер "INPUT v4 LOADED" виден)
- showGhost ВЫЗЫВАЕТСЯ (HUD показал 4 calls)
- showGhost-done логирует `vis:visible` — DOM правильно мутируется
- НО юзер всё равно не видит ghost при drag

### 🔍 ДИАГНОСТИКА СДЕЛАНА
- BoardDebugHud (Ctrl+Shift+D) — счётчики событий + DOM snapshot
- Version banner (зелёная полоса наверху) — подтверждает v4 загружен
- showGhost CustomEvent telemetry — подтверждает hook вызывается

### КОММИТЫ (chess-tournaments → main):
- `9526c8b` → `98db5bd` — hook v4: imperative DOM ghost (createElement+appendChild на body)
- `aec0ee8` — rainbow version banner
- `98e5a6e` — fix banner rotation
- `a0ce80e` → `9491f0f` — premove legality validation + dots для премувов

---

## ГИПОТЕЗЫ что осталось проверить

1. **Браузер всё-таки кэширует** — даже инкогнито может показывать что-то странное. На другом ноуте — проверить в Firefox.
2. **CSS из globals.css** — есть много правил `[data-drag-from]` которые я добавил. Может что-то перекрывает ghost.
3. **Pointer-events на ancestor** — может body или main имеет `pointer-events:none` где-то.
4. **Z-index конфликт** — z-index 99999 ghost, но что-то может быть выше.
5. **Может ghost создаётся, но innerHTML пустой** — getPieceHtml возвращает "" если piece не найден.

## ЧТО ДЕЛАТЬ НА СЛЕДУЮЩЕЙ СЕССИИ

### Если на другом ноуте есть рабочая версия 2026-04-30:
1. Сравнить useBoardInput.ts из той сессии vs текущий v4
2. Найти концептуальное различие
3. Перенести рабочую механику

### Если нет рабочей версии:
1. Проверить getPieceHtml вручную в DevTools console: `document.getElementById('cc-ghost-v4').innerHTML`
2. После клика на фигуру — должно быть SVG markup
3. Если пусто — баг в getPieceHtml/lookup пути
4. Если есть — баг в visibility/positioning

### Альтернативный подход — использовать готовую библиотеку
- `react-chessboard` (production-grade, drag из коробки)
- `chessground` (Lichess engine, JS не TS, но работает гарантированно)

---

## КАК ЗАПУСТИТЬ (на любом ноуте)

```bash
# Pull latest
cd ~/aevion-core/frontend-chess && git pull --ff-only origin chess-tournaments

# Or на main:
cd ~/aevion-core && git pull --ff-only origin main

# Dev server
cd ~/aevion-core/frontend-chess/frontend && npm run dev
# → http://localhost:3000/cyberchess
```

Зелёный баннер вверху страницы = v4 загружен. Если баннера нет — пересобрать (`rm -rf .next; npm run dev`).

---

## ВЕТКИ
- `chess-tournaments` (worktree `frontend-chess`) — основная для CyberChess работы
- `main` — продакшн, синхронизирован с chess-tournaments
- Worktrees: `git worktree list`

---

## ПРЕДЫДУЩИЕ ИТЕРАЦИИ (что пробовали)

### 2026-05-03 (эта сессия)
- v1 → v2 → v3 → v4 переписываний hook'а
- v3: DOM-imperative ghost через React Portal (React reconciler перезаписывал style)
- v4: ghost создаётся через document.createElement в useEffect, вне React дерева
- Premove legality validation с premoveLegalMoves helper
- Rainbow → green version banner
- BoardDebugHud для диагностики

### 2026-05-02 (попытка дня)
- Множественные fixes drag/click/premove
- 5 новых функций: streamer overlay, piece sets, click-deselect
- Реальная проблема не была найдена

### 2026-04-30 (последняя якобы работающая)
- Юзер помнит что drag работал на другом ноуте
- Та сессия не запушена → потеряна
- Текущая попытка восстановить — не получилось
