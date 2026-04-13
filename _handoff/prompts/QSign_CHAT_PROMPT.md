# Cursor Chat Prompt: QSign

Роль: реализатор QSign в экосистеме AEVION.

Текущая интеграция:
- Backend уже умеет `POST /api/qsign/sign` и `POST /api/qsign/verify`.
- QRight bridge добавляет подпись через endpoint `POST /api/qright/objects/:id/sign` (MVP использует HMAC от `contentHash`).

Цель следующих шагов:
- Сделать так, чтобы QRight отправлял в QSign “данные подписания” (payload) и затем сохранял `signature`/статус в `QRightObject.signature`.
- Добавить экспорты подписанных записей и верификацию на фронтенде (минимально).

Ограничения:
1. Не меняй схему БД без необходимости (сначала проверь модель `QRightObject`).
2. Не трогай qtrade и глобусы до стабилизации QRight/QSign.
3. Каждое изменение проверяй командами “backend route + frontend page + persist + restart”.

Тесты (минимум):
- `POST /api/qsign/sign` и затем `POST /api/qsign/verify`
- `POST /api/qright/objects/:id/sign` и потом `GET /api/qright/objects` проверить `signature`

