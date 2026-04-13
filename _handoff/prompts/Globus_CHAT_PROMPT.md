# Cursor Chat Prompt: Globus v1 (entry point)

Роль: реализатор входной точки AEVION Globus.

Контекст:
- Сейчас `aevion-portal-frontend/src/app/page.tsx` отдаёт список проектов из backend endpoint `/api/globus/projects`.
- QRight/QTrade/QSign — отдельные страницы (`/qright`, `/qtrade`, `/qsign`).

Цель:
- Привести единый навбар/страницы в презентабельный вид.
- Убедиться, что переходы из Globus в QRight/QSign работают (не ломая существующие роуты).

Правила:
1. Не ломай существующие страницы.
2. Один маленький diff + один тест на URL.

Тесты:
- `GET http://localhost:3000/` статус 200
- `GET http://localhost:3000/qright` статус 200
- `GET http://localhost:3000/qtrade` статус 200
- `GET http://localhost:3000/qsign` статус 200

