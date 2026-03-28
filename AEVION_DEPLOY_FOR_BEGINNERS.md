# AEVION — Деплой для полного новичка (каждый клик)

---

## ЧАСТЬ 1: Подготовка файлов (5 минут)

### 1.1 Применить патч

1. Скачай из нашего чата файл `aevion-core-4-patch.zip`
2. Открой папку `C:\Users\user\aevion-core`
3. Распакуй zip **прямо в эту папку** (правой кнопкой → «Извлечь сюда» или «Extract Here»)
4. Windows спросит «Заменить файлы?» → **Да, заменить все**

Проверка: открой `C:\Users\user\aevion-core\frontend\src\app\qsign\page.tsx` в блокноте — в первых строках должно быть `import { useToast }`. Если видишь это — патч применён.

---

## ЧАСТЬ 2: GitHub (15 минут)

### 2.1 Проверить, есть ли репозиторий

1. Открой браузер
2. Иди на: **https://github.com/Dossymbek281078**
3. Посмотри список репозиториев — есть ли `AEVION`?

**Если `AEVION` есть** → переходи к шагу 2.3
**Если `AEVION` нет** → делай шаг 2.2

### 2.2 Создать репозиторий (только если нет)

1. На GitHub нажми зелёную кнопку **«New»** (сверху слева, или https://github.com/new)
2. Заполни:
   - **Repository name:** `AEVION`
   - **Description:** `IP infrastructure, compliance, Planet ecosystem`
   - Выбери **Public** (чтобы Vercel мог читать бесплатно)
   - **НЕ** ставь галку «Add a README file»
   - **НЕ** ставь .gitignore
   - **НЕ** ставь license
3. Нажми **«Create repository»**
4. GitHub покажет страницу с инструкциями — не закрывай её

### 2.3 Подключить папку к GitHub и загрузить код

Открой **PowerShell** (или терминал / cmd):
- Нажми `Win + X` → выбери **«Terminal»** или **«PowerShell»**

Скопируй и вставь команды **одну за другой** (после каждой жми Enter):

```
cd C:\Users\user\aevion-core
```

Теперь проверим, инициализирован ли git:

```
git status
```

**Если видишь «fatal: not a git repository»** — значит git ещё не инициализирован. Выполни:

```
git init
git branch -M main
git remote add origin https://github.com/Dossymbek281078/AEVION.git
```

**Если видишь список файлов (modified, untracked и т.д.)** — значит git уже инициализирован. Проверь remote:

```
git remote -v
```

Если пусто — добавь:
```
git remote add origin https://github.com/Dossymbek281078/AEVION.git
```

Если remote уже есть — всё ок, двигаемся дальше.

### 2.4 Загрузить код в GitHub

Скопируй и вставь ВСЕ эти команды по одной:

```
git add -A
```

```
git commit -m "AEVION core: Globus, QRight, QSign, Bureau, Planet, Awards"
```

```
git push -u origin main
```

**Если спросит логин/пароль:**
- GitHub больше не принимает пароли. Нужен **Personal Access Token**:
  1. Зайди на https://github.com/settings/tokens
  2. Нажми **«Generate new token (classic)»**
  3. Note: `aevion-deploy`
  4. Поставь галку **«repo»** (первый чекбокс)
  5. Нажми **«Generate token»**
  6. **СКОПИРУЙ ТОКЕН** (он покажется один раз!)
  7. Когда терминал спросит Password → **вставь этот токен** (не пароль от GitHub!)

**Если ошибка «rejected» или «non-fast-forward»:**
```
git push -u origin main --force
```

### 2.5 Проверка

1. Открой **https://github.com/Dossymbek281078/AEVION**
2. Ты должен видеть папки: `frontend`, `aevion-globus-backend` (и, возможно, документы .md)
3. Если видишь — **GitHub готов!**

---

## ЧАСТЬ 3: Railway — Backend (10 минут)

### 3.1 Регистрация

1. Открой **https://railway.app**
2. Нажми **«Login»** (или «Start a New Project»)
3. Выбери **«Login with GitHub»**
4. Разреши доступ к аккаунту Dossymbek281078

### 3.2 Создать проект

1. На дашборде Railway нажми **«+ New Project»**
2. Выбери **«Deploy from GitHub Repo»**
3. Выбери репозиторий **«AEVION»**
4. Railway создаст сервис — появится карточка

### 3.3 Настроить Root Directory

1. Кликни на карточку сервиса (название будет типа «AEVION»)
2. Перейди во вкладку **«Settings»**
3. Найди раздел **«Source»** → поле **«Root Directory»**
4. Введи: **`aevion-globus-backend`**
5. Сохрани (иногда сохраняется автоматически)

### 3.4 Настроить Build и Start

В тех же Settings найди:
- **Build Command:** впиши:
```
npm install && npx prisma migrate deploy && npm run build
```
- **Start Command:** впиши:
```
npm start
```

### 3.5 Добавить базу данных Postgres

1. Вернись на экран проекта (нажми на название проекта сверху)
2. Нажми **«+ New»** → **«Database»** → **«Add PostgreSQL»**
3. Railway создаст базу данных — появится вторая карточка
4. Кликни на карточку PostgreSQL → вкладка **«Connect»**
5. Найди строку **«DATABASE_URL»** → нажми на неё чтобы скопировать

### 3.6 Добавить переменные окружения

1. Кликни обратно на карточку backend-сервиса (не PostgreSQL)
2. Перейди во вкладку **«Variables»**
3. Нажми **«+ New Variable»** и добавь по одной:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Вставь скопированную строку из PostgreSQL (начинается с `postgresql://...`) |
| `QSIGN_SECRET` | `aevion-hmac-secret-2026` |
| `JWT_SECRET` | `aevion-jwt-secret-2026` |
| `PORT` | `4001` |
| `NODE_ENV` | `production` |

Если Railway автоматически подставил `DATABASE_URL` через ссылку `${{Postgres...}}` — это тоже ок, не трогай.

### 3.7 Деплой

1. Railway автоматически начнёт билд после сохранения
2. Жди 2-5 минут — следи за логами (вкладка **«Deployments»**)
3. Когда увидишь **зелёный статус «Success»** — backend готов

### 3.8 Получить URL backend

1. В Settings сервиса найди раздел **«Networking»** → **«Public Networking»**
2. Нажми **«Generate Domain»**
3. Railway даст URL, например:
   `aevion-backend-production-ab12.up.railway.app`
4. **ЗАПИШИ / СКОПИРУЙ ЭТОТ URL** — он нужен для Vercel

### 3.9 Проверка backend

Открой в браузере (подставь свой URL):
```
https://aevion-backend-production-ab12.up.railway.app/api/health
```

Если видишь `{"status":"ok"}` — **backend работает!**

---

## ЧАСТЬ 4: Vercel — Frontend (10 минут)

### 4.1 Регистрация

1. Открой **https://vercel.com**
2. Нажми **«Sign Up»** → **«Continue with GitHub»**
3. Разреши доступ к аккаунту Dossymbek281078

### 4.2 Импорт проекта

1. На дашборде Vercel нажми **«Add New...»** → **«Project»**
2. В списке репозиториев найди **«AEVION»** → нажми **«Import»**

### 4.3 Настройка проекта (ВАЖНЫЙ экран!)

Vercel покажет экран «Configure Project». Заполни:

**Framework Preset:** Next.js (обычно определяется автоматически)

**Root Directory:**
- Нажми **«Edit»** рядом с Root Directory
- Введи: **`frontend`**
- Нажми **«Continue»**

**Environment Variables:**
- Нажми **«Environment Variables»** (секция внизу экрана)
- Добавь две переменные:

| Name | Value |
|------|-------|
| `BACKEND_PROXY_TARGET` | `https://твой-railway-url.up.railway.app` |
| `API_INTERNAL_BASE_URL` | `https://твой-railway-url.up.railway.app` |

**ВАЖНО:**
- Подставь свой реальный URL из шага 3.8
- URL без `/` на конце!
- Нажми **«Add»** после каждой переменной

### 4.4 Deploy!

1. Нажми большую кнопку **«Deploy»**
2. Жди 2-4 минуты — Vercel покажет лог сборки
3. Когда увидишь **«Congratulations!»** и конфетти — готово!
4. Vercel покажет URL, например:
   `https://aevion-abc123.vercel.app`

### 4.5 Проверка

Открой этот URL в браузере. Ты должен увидеть:
- 3D Globus с маркерами
- Блок «Planet Ecosystem — live» с метриками
- Навигация: Auth, QRight, QSign, Bureau, Planet, Awards

---

## ЧАСТЬ 5: Проверить весь путь (5 минут)

Открой свой Vercel URL и пройди по шагам:

| Шаг | Что сделать | Что должно произойти |
|-----|------------|----------------------|
| 1 | Открой `/auth` | Страница входа |
| 2 | Создай аккаунт (имя, email, пароль) | Получишь токен |
| 3 | Открой `/qright` | Форма регистрации объекта |
| 4 | Заполни название + описание → «Зарегистрировать» | Зелёный toast «Объект зарегистрирован» |
| 5 | На объекте нажми «Открыть в QSign» | QSign с payload, пометка «deep link» |
| 6 | Нажми «Подписать» | Зелёный toast «Payload подписан» |
| 7 | Открой `/bureau` | Список твоих объектов |
| 8 | Нажми «Подписать QRight» | Toast «Объект подписан» |
| 9 | Нажми «Проверить подпись» | Toast «Подпись VALID» |
| 10 | Открой `/awards` | Хаб премий с метриками |

**Если всё работает — поздравляю, AEVION в продакшне!**

---

## Что делать если что-то не работает

| Проблема | Что делать |
|----------|-----------|
| Vercel показывает ошибку сборки | Скопируй лог ошибки и скинь мне |
| «Backend недоступен» на главной | Проверь что Railway URL правильный в переменных Vercel (без `/` на конце). Перезапусти деплой в Vercel: Deployments → «...» → Redeploy |
| Railway билд падает | Проверь что Root Directory = `aevion-globus-backend`. Проверь что DATABASE_URL задан. Скинь мне лог |
| GitHub push отклоняет | Используй `git push -u origin main --force` |
| Globus показывает 0 узлов | Backend ещё стартует — подожди 1 мин и обнови страницу |
| Planet stats всё нули | Это нормально — нет данных пока. Создай артефакт в Planet → появятся |
| Страница белая / 500 | Проверь что `API_INTERNAL_BASE_URL` задан в Vercel — без него SSR-страницы (/awards) не работают |

**В любом непонятном случае — скриншот мне, разберёмся.**

---

## Бонус: как обновлять после правок

После любых изменений в коде на компьютере:

```
cd C:\Users\user\aevion-core
git add -A
git commit -m "описание что изменил"
git push
```

Vercel и Railway **автоматически** подхватят изменения и пересоберутся. Ничего нажимать не нужно — через 2-3 минуты новая версия будет на том же URL.

---

*Инструкция: 25.03.2026 · AEVION*
