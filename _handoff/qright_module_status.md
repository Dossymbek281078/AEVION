# QRight module status (MVP -> production-ready)

Статус:
- Backend: готово создание объекта + список реестра + подпись (QSign integration bridge).
- Database: PostgreSQL + Prisma migrations (таблица `QRightObject` создана).
- Frontend: страница `/qright` со сценариями создания объекта, просмотра реестра и подписи.

Endpoints:
- `GET  /api/qright/objects` — список всех объектов.
- `POST /api/qright/objects` — создать объект (обязательные: `title`, `description`).
- `POST /api/qright/objects/:id/sign` — подписать объект и сохранить `signature`.
- `GET  /api/qright/objects/signed` — экспорт только подписанных записей.

UI:
- `http://localhost:3000/qright`
- Кнопка “Подписать/Переподписать” рядом с каждой карточкой.
- Переключатель: “Все” / “Подписанные”.

Проверки (1 шаг = 1 команда):
- Backend GET objects:
```bash
$uri="http://localhost:4001/api/qright/objects"; $res=Invoke-WebRequest -Method GET -Uri $uri -UseBasicParsing; $res.StatusCode; ($res.Content|ConvertFrom-Json).total
```
- Signed endpoint:
```bash
$uri="http://localhost:4001/api/qright/objects/signed"; $res=Invoke-WebRequest -Method GET -Uri $uri -UseBasicParsing; $res.StatusCode; ($res.Content|ConvertFrom-Json).total
```
- Frontend page:
```bash
$res=Invoke-WebRequest -Method GET -Uri "http://localhost:3000/qright" -UseBasicParsing; $res.StatusCode
```

