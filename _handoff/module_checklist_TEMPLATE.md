# Checklist шаблон (Definition of done)

Используй этот шаблон для каждого модуля: `QRight`, `QSign`, `Globus v1`, `Auth`.

## 1) Backend (route работает)
- Проверь нужный endpoint(ы).

Шаблон теста (PowerShell):
```bash
$res=Invoke-WebRequest -Method GET -Uri "http://localhost:4001/API_ENDPOINT" -UseBasicParsing
$res.StatusCode
$res.Content
```

## 2) Frontend (page/route работает)
- Открой нужную страницу в браузере и проверь, что рендерится без ошибок.

Тест (PowerShell):
```bash
$res=Invoke-WebRequest -Method GET -Uri "http://localhost:3000/FRONTEND_ROUTE" -UseBasicParsing
$res.StatusCode
```

## 3) Persist в PostgreSQL (после create/list)
- Создай объект/запись через backend.
- Проверь, что затем она видна в list endpoint.

Тест (PowerShell, create + list):
```bash
$body=@{key1="v1"; key2="v2"} | ConvertTo-Json
($create=Invoke-WebRequest -Method POST -Uri "http://localhost:4001/CREATE_ENDPOINT" -ContentType "application/json" -Body $body -UseBasicParsing).StatusCode
$list=(Invoke-WebRequest -Method GET -Uri "http://localhost:4001/LIST_ENDPOINT" -UseBasicParsing).Content | ConvertFrom-Json
$list.total
```

## 4) После restart всё ещё работает
- Перезапусти backend.
- Повтори GET list endpoint и проверь, что `total`/данные те же.

Тест (PowerShell):
```bash
$json=(Invoke-WebRequest -Method GET -Uri "http://localhost:4001/LIST_ENDPOINT" -UseBasicParsing).Content | ConvertFrom-Json
$json.total
```

## 5) Понятный UI
- На странице должна быть понятная форма/кнопки и список.
- Ошибки должны выводиться пользователю.

## 6) Финальный test command + URL (обязательно указать)
- Backend URL:
  - `http://localhost:4001/...`
- Frontend URL:
  - `http://localhost:3000/...`
- Команда test:
  - 1 команда для API или 1 команда для страницы (как минимум).

