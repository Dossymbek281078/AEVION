# AEVION: полная пошаговая инструкция по выкладке (вручную)

Здесь расписано **что именно нажимать и что куда вставлять**. Порядок: сначала **код в GitHub**, потом **backend + база** в облаке, затем **сайт** на Vercel.

---

## Что в итоге получится

| Часть | Где живёт | Зачем |
|--------|-----------|--------|
| **Сайт** (Next.js) | Vercel | То, что открывают в браузере |
| **API** (Node + Express) | Railway или Render | Ответы `/api/...`, база данных |
| **PostgreSQL** | Там же (к сервису API) | Хранение данных Prisma |

Браузер ходит на ваш домен Vercel, а запросы вида `/api-backend/...` Vercel **проксирует** на URL вашего API (вы укажете его в переменной окружения).

---

## Часть 0. Подготовка: аккаунты и код на GitHub

### 0.1. Аккаунты

Создайте (если ещё нет):

1. **GitHub** — https://github.com  
2. **Vercel** — https://vercel.com (можно «Sign up with GitHub»)  
3. **Railway** — https://railway.app (рекомендуем для первого раза; можно тоже через GitHub)

### 0.2. Репозиторий с проектом

Нужно, чтобы папка **`aevion-core`** (с подпапками `frontend` и `aevion-globus-backend`) лежала **в репозитории на GitHub**.

Если код только на компьютере:

1. На GitHub: **New repository** → имя, например `aevion-core` → **Create repository**.  
2. На компьютере в папке с проектом (где лежит `aevion-core`):

```bash
cd aevion-core
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/aevion-core.git
git push -u origin main
```

Подставьте **свою** ссылку с GitHub вместо `ВАШ_ЛОГИН`.

Дальше в инструкции считаем, что репозиторий уже на GitHub.

---

## Часть 1. Backend + PostgreSQL на Railway

Ниже — пошагово для **Railway**. Интерфейс сайта иногда меняют, но смысл тот же: **база**, **сервис с Node**, **переменные**, **публичный URL**.

### 1.1. Новый проект

1. Зайдите на https://railway.app и войдите.  
2. **New Project**.  
3. Выберите **Deploy from GitHub repo** (или аналог «подключить GitHub» и дать доступ к репозиториям).  
4. Укажите репозиторий, где лежит **aevion-core**.

### 1.2. Добавить PostgreSQL

1. В том же проекте Railway нажмите **New** → **Database** → **PostgreSQL**.  
2. Дождитесь создания. Откройте карточку PostgreSQL → вкладка вроде **Variables** или **Connect**.  
3. Найдите переменную **`DATABASE_URL`** (или **Connection URL**) — это длинная строка `postgresql://...`. **Скопируйте её** (понадобится для сервиса API).

> На Railway часто можно **подключить** Postgres к другому сервису кнопкой «Connect» — тогда `DATABASE_URL` подставится сама. Если не подставилась — вставьте скопированную строку вручную (шаг 1.5).

### 1.3. Сервис для API (папка `aevion-globus-backend`)

1. **New** → **GitHub Repo** → снова выберите тот же репозиторий (или добавьте сервис из уже подключенного репо).  
2. Railway создаст **сервис**. Откройте его **Settings** (шестерёнка).

**Важно — корневая папка:**

- Найдите поле **Root Directory** (или «Watch paths» / корень сборки).  
- Впишите **ровно**:

```text
aevion-globus-backend
```

Если репозиторий называется иначе и код лежит в корне без вложенности — уточните путь; для нашего монорепо это **`aevion-globus-backend`**.

### 1.4. Команды сборки и запуска

В настройках того же сервиса найдите **Deploy** (или **Build** / **Start**).

**Build Command** — вставьте одной строкой:

```text
npm install && npx prisma generate && npx prisma db push && npm run build
```

- `prisma db push` создаёт таблицы в пустой базе при первом деплое (в репозитории нет папки `migrations`).

**Start Command** — вставьте:

```text
npm start
```

Сохраните настройки.

### 1.5. Переменные окружения (Variables)

Откройте сервис API → **Variables** (или **Environment**).

Добавьте **каждую** строку: кнопка **New Variable**, **имя** слева, **значение** справа.

| Имя переменной (копировать как есть) | Что вставить в значение |
|--------------------------------------|-------------------------|
| `DATABASE_URL` | Строка `postgresql://...` из PostgreSQL (если Railway не подставил сам — вставьте вручную). |
| `AUTH_JWT_SECRET` | Любая длинная случайная строка, например 32+ символов (латиница и цифры). Пример формата: `mY7kQ9pL2vN4xR8sT1wZ3bC5dF6gH0j` — **не копируйте этот пример**, сгенерируйте свою. |
| `AUTH_JWT_EXPIRES_IN` | `7d` |
| `PORT` | Обычно **не нужно**: Railway сам задаёт порт. Если просят — оставьте как предлагает платформа. |

Опционально (если нужен чат QCoreAI с OpenAI):

| `OPENAI_API_KEY` | Ключ из кабинета OpenAI |
| `OPENAI_MODEL` | Например `gpt-4o-mini` |

Сохраните. Railway пересоберёт сервис.

### 1.6. Публичный URL API

1. В сервисе API откройте **Settings** → раздел **Networking** / **Public Networking**.  
2. Включите **Generate Domain** (или «Public URL»).  
3. Скопируйте выданный адрес. Он будет вида:

```text
https://что-то.up.railway.app
```

**Запишите его в блокнот.** Это ваш **BACKEND URL**.

Проверка в браузере: откройте:

```text
https://ВАШ-URL/health
```

Должен вернуться JSON со `"status":"ok"`. Если ошибка — смотрите логи (**Deployments** → последний деплой → **View logs**).

---

## Часть 2. Frontend на Vercel

### 2.1. Импорт проекта

1. Зайдите на https://vercel.com → **Add New…** → **Project**.  
2. **Import** ваш GitHub-репозиторий с `aevion-core`.  
3. Если репозиторий не виден — **Adjust GitHub App Permissions** и разрешите нужный репозиторий.

### 2.2. Настройка сборки (самое важное)

На экране настройки проекта **до первого Deploy**:

1. **Framework Preset:** Next.js (часто определяется сам).  
2. **Root Directory** — нажмите **Edit** и укажите:

```text
frontend
```

3. **Build Command** — оставьте по умолчанию (`next build`) или явно:

```text
npm run build
```

4. **Output Directory** — не трогайте (для Next.js обычно пусто / по умолчанию).  
5. **Install Command** — можно оставить `npm install`.

### 2.3. Переменная для прокси на backend

На том же экране найдите **Environment Variables**.

Нажмите **Add**:

- **Name** (имя) — скопируйте **точно**:

```text
BACKEND_PROXY_TARGET
```

- **Value** (значение) — вставьте **URL Railway из части 1.6** **без** слэша в конце.

**Правильно:**

```text
https://что-то.up.railway.app
```

**Неправильно:**

```text
https://что-то.up.railway.app/
```

Нажмите **Add** / сохраните переменную.

> Эта переменная читается при **сборке** Next.js. Если потом смените URL бекенда — в Vercel сделайте **Redeploy** (пересборку).

### 2.4. Первый деплой

Нажмите **Deploy**. Дождитесь зелёной галочки. Откройте выданный домен Vercel (вида `проект.vercel.app`).

### 2.5. Проверки после деплоя

В браузере (подставьте свой домен Vercel):

1. Главная страница сайта открывается.  
2. Проверка прокси к API:

```text
https://ВАШ-ДОМЕН-VERCEL.app/api-backend/health
```

Должен быть тот же JSON, что и у `https://ВАШ-RAILWAY/health`.

3. Дополнительно:

```text
https://ВАШ-ДОМЕН-VERCEL.app/api-backend/api/globus/projects
```

Должен вернуться JSON со списком проектов.

Если `/api-backend/...` не работает — чаще всего:

- неверный `BACKEND_PROXY_TARGET`;
- лишний `/` в конце URL;
- не сделали redeploy после смены переменной.

---

## Часть 3. Локальный файл `.env` (только для компьютера, не для Vercel)

Чтобы у себя на машине фронт знал бекенд при `npm run dev` в `frontend`:

1. В папке `frontend` создайте файл **`.env.local`** (если его ещё нет).  
2. Вставьте строку (подставьте свой Railway URL **без** `/` в конце):

```env
BACKEND_PROXY_TARGET=https://что-то.up.railway.app
```

3. Перезапустите `npm run dev` в `frontend`.

Шаблон без секретов лежит в **`frontend/.env.example`**.

---

## Часть 4. Краткая шпаргалка «что куда»

| Где | Имя | Значение |
|-----|-----|----------|
| **Railway → сервис API → Variables** | `DATABASE_URL` | Из PostgreSQL |
| **Railway → сервис API → Variables** | `AUTH_JWT_SECRET` | Случайная длинная строка |
| **Railway → сервис API → Variables** | `AUTH_JWT_EXPIRES_IN` | `7d` |
| **Railway → сервис API → Settings** | Root Directory | `aevion-globus-backend` |
| **Railway → сервис API → Deploy** | Build | `npm install && npx prisma generate && npx prisma db push && npm run build` |
| **Railway → сервис API → Deploy** | Start | `npm start` |
| **Vercel → Project → Settings → Environment Variables** | `BACKEND_PROXY_TARGET` | `https://...railway.app` (без `/` в конце) |
| **Vercel → Project → Settings** | Root Directory | `frontend` |

---

## Если выбрали Render вместо Railway

Идея та же:

1. Создать **PostgreSQL** и скопировать **Internal/External Database URL**.  
2. Создать **Web Service** с тем же репо, **Root Directory** = `aevion-globus-backend`.  
3. **Build Command:** та же строка, что в таблице выше.  
4. **Start Command:** `npm start`.  
5. В **Environment** добавить те же переменные.  
6. Скопировать публичный URL сервиса и вставить его в Vercel в **`BACKEND_PROXY_TARGET`** (без `/` в конце).

---

## После выката

- Домен Vercel можно привязать к своему (в проекте Vercel → **Domains**).  
- Сменили адрес API → обновите **`BACKEND_PROXY_TARGET`** на Vercel и выполните **Redeploy**.  
- Перед коммитами полезно гонять из корня `aevion-core`: `npm run verify` (сборка backend + frontend).

Если на каком-то шаге интерфейс отличается от описанного — ориентируйтесь на названия полей из таблицы в **части 4**: они должны совпасть по смыслу.
