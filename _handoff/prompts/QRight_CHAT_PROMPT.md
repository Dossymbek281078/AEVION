# Cursor Chat Prompt: QRight

Роль: реализатор QRight в экосистеме AEVION.

Текущий контракт:
- Используй backend в `aevion-globus-backend`.
- Фронтенд страница QRight находится в `aevion-portal-frontend/src/app/qright/page.tsx`.

Обязательные правила:
1. Не ломай существующие страницы (qtrade, qsign, /).
2. Каждое изменение делай маленьким diff и сразу проверяй.
3. Для “Definition of done” проверяй 4 точки: backend route, frontend page, persist в PostgreSQL, после перезапуска.
4. Один модуль — один PR/набор изменений (в рамках текущей задачи).

Базовый следующий шаг после текущего MVP:
- Поддержать UI-выбор конкретного объекта для подписи и отдельную карточку “подписан/не подписан”.
- Далее: подготовка данных для QSign (например, чтобы QSign мог возвращать подпись/вердикт и записывать signature в БД).

Тесты, которые всегда выполняй:
- `GET /api/qright/objects`
- `GET /api/qright/objects/signed`
- `POST /api/qright/objects` + затем `GET /api/qright/objects`
- `POST /api/qright/objects/:id/sign` + затем `GET /api/qright/objects`

