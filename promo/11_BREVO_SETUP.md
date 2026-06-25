# Brevo setup — AEVION

> Account: yahiin1978@gmail.com · Plan: Free (299 credits) · Создано 2026-05-24.

---

## Структура аккаунта

| Тип | Имя | ID | Назначение |
|-----|-----|-----|------------|
| Folder | AEVION | 6 | Корневая папка для всех списков |
| List | AEVION Pilots | 7 | Участники 90-day pilot ($50K / $75K / $100K) |
| List | AEVION Waiting List | 8 | Все кто подписался через aevion.app waitlist |
| Template | aevion-pilot-welcome | 6 | Welcome email при старте пилота |
| Template | aevion-waitlist-broadcast | 7 | Разовая рассылка по ждущим (что зашипали) |
| Template | aevion-quarterly-update | 8 | Ежеквартальный checkpoint для тёплых контактов |

---

## Шаблон 6 — `aevion-pilot-welcome`

**Когда:** при подтверждении пилота (сейчас — вручную; в будущем — из `/pilot` form webhook).

**Переменные:**

| Переменная | Пример | Описание |
|------------|--------|----------|
| `{{params.pilot_type}}` | `Trust` | Тип пилота |
| `{{params.pilot_price}}` | `$50,000` | Цена пилота |
| `{{params.start_date}}` | `2026-06-01` | Дата старта |
| `{{params.modules}}` | `QSign v2, QShield, QRight` | Список модулей |
| `{{contact.FIRSTNAME}}` | `Patrick` | Имя получателя (из контакта) |

**Как отправить вручную:**
```python
# Через Brevo API
POST /v3/smtp/email
{
  "templateId": 6,
  "to": [{"email": "...", "name": "..."}],
  "params": {
    "pilot_type": "Trust",
    "pilot_price": "$50,000",
    "start_date": "2026-06-01",
    "modules": "QSign v2 (FIPS 204), QShield (threshold), QRight (IP registry)"
  }
}
```

---

## Шаблон 7 — `aevion-waitlist-broadcast`

**Когда:** ad-hoc, когда накопился список + есть что показать. Не автоматически.

**Переменные:**

| Переменная | Пример | Описание |
|------------|--------|----------|
| `{{params.period}}` | `Q2 2026` | Период |
| `{{params.date}}` | `May 24, 2026` | Дата рассылки |
| `{{params.modules_count}}` | `32` | Сколько модулей в проде |
| `{{params.shipped_items}}` | HTML-строки с описанием | Что зашипали |

**`shipped_items` формат (HTML):**
```html
<p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.5;padding-left:16px;">
  · <strong>QSign v2 GA</strong> — post-quantum signatures (ML-DSA-65 FIPS 204), SDK published
</p>
<p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.5;padding-left:16px;">
  · <strong>DevHub 9 integrations live</strong> — GitHub / Vercel / Railway / Cloudflare / ElevenLabs / Brevo / Stripe / DALL-E / Drive
</p>
```

---

## Шаблон 8 — `aevion-quarterly-update`

**Когда:** первый рабочий день каждого квартала (Q3 → 1 июля, Q4 → 1 октября...).
**Для кого:** тёплые контакты — те, кто ответил на cold email «интересно, но не сейчас» и попросил quarterly updates.

**Переменные:**

| Переменная | Пример | Описание |
|------------|--------|----------|
| `{{params.quarter}}` | `Q3 2026` | Квартал |
| `{{params.date}}` | `July 1, 2026` | Дата |
| `{{params.headline}}` | `32 modules, first pilot signed` | Subject-лайн заголовок |
| `{{params.update_1_headline}}` | `DevHub hit 11 integrations` | Первый факт (короткий) |
| `{{params.update_1_detail}}` | `Added DeepL + Brevo SMS...` | Детали |
| `{{params.update_2_headline}}` | `Constitution v1 signed by 3 external validators` | Второй факт |
| `{{params.update_2_detail}}` | `...` | Детали |

**Правило двух bullets:** обе должны быть **верифицируемыми** — получатель может кликнуть на `/transparency` или `/api/aevion/registry` и проверить.

---

## Как добавить контакт в список

```
POST /v3/contacts
{
  "email": "contact@example.com",
  "attributes": {"FIRSTNAME": "Patrick", "LASTNAME": "Collison", "COMPANY": "Stripe"},
  "listIds": [8]   ← AEVION Waiting List
}
```

Или через Claude Code: `mcp__brevo__contacts_create_contact` с `listIds: [8]`.

---

## Когда активировать шаблоны

Шаблоны сейчас **inactive** — чтобы они стали рабочими для программного использования:

1. Зайти в Brevo → Email Templates → найти нужный.
2. Нажать «Activate» или через API:
   ```
   PUT /v3/smtp/templates/{templateId}
   { "isActive": true }
   ```
3. После активации — ID передавать в `templateId` при отправке.

---

## SMTP relay (для кода)

```
Host:     smtp-relay.brevo.com
Port:     587 (TLS)
User:     aac686001@smtp-brevo.com
Password: [Brevo SMTP key из настроек аккаунта]
From:     yahiin1978@gmail.com
```

Не путать с API key — SMTP key отдельно в Brevo → SMTP & API → SMTP Keys.

---

## Следующий шаг (когда придут первые пользователи)

1. Добавить в `/pilot` страницу форму с полями (имя, email, тип пилота) → `POST /api/brevo/pilot-signup` → `contacts_create_contact` в список `7` + `send_transac_email` с шаблоном `6`.
2. На главной `aevion.app` добавить waitlist form → список `8`.
3. Активировать шаблоны.

---

— настроено 2026-05-24, AEVION
