# Post-launch follow-ups (after `aevion.app` go-live)

Делайте эти шаги по мере готовности — каждый независимый, ничего не блокирует другое.

---

## F — Brevo SMTP вместо Gmail (профессиональный send-from)

**Зачем:** Gmail отправляет с `yahiin1978@gmail.com`, headers содержат "via gmail.com" — для финтеха выглядит непрофессионально. Brevo отправит с `noreply@aevion.app`, проходит SPF/DKIM проверки, бесплатно 300 писем/день.

### F.1 Регистрация
🔗 https://www.brevo.com/free-shop/ → Sign up (email + пароль) → подтвердите email.

### F.2 Добавьте sender
🔗 Brevo dashboard → **Senders, Domains & dedicated IPs** → **Senders → Add a sender**:
- **Sender name:** `AEVION QPayNet`
- **Sender email:** `noreply@aevion.app`
→ Save. Brevo пришлёт письмо подтверждения на yahiin1978@gmail.com (т.к. там MX нет, fallback). Кликните confirm.

### F.3 Authenticate domain (SPF + DKIM)
В том же разделе → **Domains → Add a domain** → `aevion.app` → Brevo покажет 2 TXT-записи. Добавьте их в Vercel DNS:

🔗 Vercel → проект `aevion` → Settings → Domains → `aevion.app` → View DNS Records → Add:
1. **TXT** `_brevo-code` → `<значение из Brevo>`
2. **TXT** `mail._domainkey` → `<DKIM ключ из Brevo>`
3. **TXT** `@` (apex) или редактировать существующую → `v=spf1 include:spf.brevo.com ~all`

→ В Brevo нажмите **Authenticate this domain** через 5-10 мин (DNS пропагация).

### F.4 Получите SMTP credentials
🔗 Brevo → **SMTP & API → SMTP** → копируйте:
- **SMTP server:** `smtp-relay.brevo.com`
- **Port:** `587`
- **Login:** ваш Brevo email
- **SMTP key:** `xkeysib-...` (Master password) — **ОДИН РАЗ** показывается, сразу в `aevion-secrets.txt`

### F.5 Обновите Railway env vars
🔗 Railway → `nurturing-creativity` → **AEVION** → Variables → Raw Editor → найдите 4 SMTP-строки и замените на:

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<ваш Brevo login email>
SMTP_PASSWORD=<xkeysib-... key из F.4>
SMTP_FROM=AEVION QPayNet <noreply@aevion.app>
```

→ Update Variables. Railway автоматически перезапустит.

### F.6 Проверка
В PowerShell:
```powershell
curl -X POST https://api.aevion.app/api/qpaynet/notifications/test -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"channel\":\"email\"}"
```
(если у вас есть JWT токен из браузера). Email должен прийти на ваш адрес от `noreply@aevion.app`.

---

## G — Sentry для error tracking (10 мин)

**Зачем:** агрегация фронтенд+бэкенд ошибок в одном dashboard, alerts на регрессии.

### G.1 Регистрация
🔗 https://sentry.io/signup/ → Sign up (можно через GitHub) → выберите **Developer plan** (бесплатно, 5k errors/мес).

### G.2 Создайте 2 проекта
В Sentry sidebar → **Projects → Create Project**:

1. **Frontend project:**
   - Platform: **Next.js**
   - Project name: `aevion-frontend`
   - Alert: All issues → ваш email
   → Create. Sentry покажет DSN типа `https://<key>@<host>.ingest.sentry.io/<id>` — скопируйте.

2. Снова **Create Project**:
   - Platform: **Node.js → Express**
   - Project name: `aevion-backend`
   → Create. Скопируйте второй DSN.

Сохраните оба DSN в `aevion-secrets.txt`:
```
SENTRY_DSN_FRONTEND=https://...
SENTRY_DSN_BACKEND=https://...
```

### G.3 Добавьте в Vercel (frontend)
🔗 Vercel → `aevion` → Environment Variables → Production → Add:

```
NEXT_PUBLIC_SENTRY_DSN=<SENTRY_DSN_FRONTEND>
SENTRY_DSN=<SENTRY_DSN_FRONTEND>
NEXT_PUBLIC_SENTRY_ENV=production
SENTRY_ENV=production
```

→ Save → Deployments → последний → Redeploy (без cache).

### G.4 Добавьте в Railway (backend)
🔗 Railway → AEVION → Variables → Raw Editor → добавьте в конец:

```
SENTRY_DSN=<SENTRY_DSN_BACKEND>
SENTRY_ENV=production
```

→ Update. Railway перезапустит.

### G.5 Проверка
🔗 https://sentry.io/issues/ — открытое в первый раз пусто. Через 10-30 мин (когда кто-то получит первый JS error на сайте) увидите issue.

Тестово вызвать ошибку:
🔗 https://aevion.app/?_test=throw — если кодом не предусмотрено, ничего не выкидывает. Лучше открыть DevTools Console и выполнить `throw new Error("sentry test")` — Sentry должен поймать.

---

## I — Stripe Atlas (LLC + live keys)

**Зачем:** в Казахстане Stripe не позволяет регистрацию. Atlas открывает Delaware LLC + bank account за $500.

🔗 https://stripe.com/atlas/apply

Что нужно:
- Паспорт (фото + фронт)
- Адрес проживания (KZ адрес OK)
- Описание бизнеса (для AEVION: "Embedded payment + identity infrastructure for KZ small businesses")
- $500 платёж (Visa/MC из KZ работает)

После одобрения (1-2 недели):
- Получаете Delaware LLC с EIN
- Bank account (Mercury) — открывается автоматом
- Stripe live keys активируются после связки с LLC

### После активации
- Откройте https://dashboard.stripe.com/apikeys → live mode → копируйте `pk_live_...` + `sk_live_...`
- Webhooks: https://dashboard.stripe.com/webhooks → Add endpoint:
  - URL: `https://api.aevion.app/api/qpaynet/stripe-webhook`
  - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
  - Copy `whsec_...`
- Railway env:
  ```
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_PUBLISHABLE_KEY=pk_live_...
  BUREAU_PAYMENT_PROVIDER=stripe
  ```

---

## J — Local KZ payment processors (Kaspi / Halyk / BCC Pay)

**Зачем:** для KZ-резидентов Atlas+Stripe это $500 + комиссия 3.4% + USD-конверсия. Локальные процессоры — комиссия ~1-2%, KZT нативно, без LLC.

**Не готово в коде** — отдельная интеграция, ~3-7 дней работы для каждого:

- **Kaspi Pay merchant API:** https://kaspi.kz/business/online-acquiring/ (нужна регистрация ИП + договор)
- **Halyk Bank:** https://halykbank.kz/business/internet-acquiring (договор + интеграция через iframe или REST)
- **BCC Pay:** https://bcc.kz/services/business/internet-acquiring/

Когда будете готовы — скажите, добавлю отдельный провайдер в `aevion-globus-backend/src/lib/payment/`.

---

## K — `@aevion` npm scope (когда разблокируется)

Сейчас SDK под `@dosymbek/qpaynet-client`. Если в будущем удастся занять scope `@aevion` (через npm support):

🔗 https://www.npmjs.com/support → запрос с обоснованием (вы — реальный AEVION-проект, scope занят dormant аккаунтом).

После одобрения:
1. Создать организацию `aevion` (см. предыдущие инструкции)
2. В `packages/qpaynet-client/package.json` поменять `"name": "@aevion/qpaynet-client"`
3. Bump version → `npm publish --access public`
4. Депрекейт старый: `npm deprecate @dosymbek/qpaynet-client "moved to @aevion/qpaynet-client"`
