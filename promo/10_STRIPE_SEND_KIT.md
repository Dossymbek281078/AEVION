# Stripe send-kit — первое холодное письмо

> Один цельный документ под first send: финальный текст письма, три заготовленных ответа на возможные реакции, send-чеклист, tracking-схема.
> **Не отправляй без того, чтобы прочитать своими глазами три раза.**

---

## 1. Финальное письмо (v2 — sharpened)

**Subject:** `AEVION acquisition — $1B floor + advisor seat (extends Stripe's rail)`

**Send to:** `patrick@stripe.com`
**CC (optional, only if нет ответа на 7-й день):** `bd@stripe.com`
**From:** твой основной адрес (не Gmail group), plain-text mode.

```
Patrick,

Pitching AEVION acquisition. Floor: $1B USD net, founder stays as Senior
Advisor 24 months, brand + AEV cap 21M kept. Full brief — 5-page printable
PDF, 90-second audio, live module health-board:

  https://aevion.app/acquire?ref=stripe

Why this email finds you specifically — three pieces extend Stripe's rail
without competing with it:

  • QRight — IP attestation registry. Stripe Connect creators of AI-generated
    assets need notary-as-default. We ship it; you don't have it.
  • QSign v2 — post-quantum signatures (ML-DSA-65 FIPS 204 GA), SDK published
    on npm. Most peers still in proposal stage.
  • AEVION DevHub — single workspace proxying nine integrations under one
    AEV-billed rail (GitHub, Vercel, Railway, Cloudflare, ElevenLabs, Brevo,
    Stripe, DALL-E, Drive). Stripe Connect for the developer-tools era.

Plus 30+ live modules, AEV in circulation under hard cap 21M, Constitution
v1 cryptographically attested via QSign envelope, daily smoke 24/24.

Comparable transactions: GitHub × Microsoft $7.5B, Plaid × Visa $5.3B
(unwound), Figma × Adobe $20B (unwound). AEVION sits at all three
intersections.

Ask: 30-min call. Calendar light Tue/Wed/Thu mornings PT next two weeks.

— [Founder name]
yahiin1978@gmail.com
```

### Чем отличается от v1 (`08_OUTBOUND_QUEUE.md`)

- ✂️ Убрал «We've built» — лидируем с offer'ом, не с биографией.
- 🎯 Subject теперь несёт **главную мысль** (`extends Stripe's rail`) — не теряется в inbox-предпросмотре.
- 🔗 Ссылка на `/acquire?ref=stripe` — UTM-tracking + персональный chip на странице (см. §4).
- 📏 -28% длины (примерно). Patrick читает первые 150 слов; всё что после — игнорирует.
- 💼 Three pieces теперь bulleted с **активным глаголом первым** (`QRight — IP attestation`, не `QRight — an IP attestation`).

---

## 2. Reply template — POSITIVE («interested, schedule call»)

**Если приходит:** `Sure, happy to chat. Send some times.` или `Sounds interesting — when works?`

```
Patrick,

Thank you for the quick reply.

Calendar options, 30 minutes, your timezone:

  • [День 1, 10:00 PT — 19:00 GMT]
  • [День 2, 09:00 PT — 18:00 GMT]
  • [День 3, 11:00 PT — 20:00 GMT]

Zoom / Google Meet / Stripe internal — your pick.

Before the call, two things to make the 30 minutes substantive instead of
Q&A:

  1. https://aevion.app/acquire — same brief, 5-page printable
  2. https://aevion.app/transparency — live health-board

Looking forward.

— [Founder]
```

**Заполни 3 окна перед отправкой** — выбери дни, когда у тебя в календаре нет других обязательств.

---

## 3. Reply template — PUSHBACK («interesting but not now / wrong fit»)

**Если приходит:** `Interesting but not a priority right now` / `Wrong fit for current roadmap` / `Hard to find time`.

```
Patrick,

Appreciate the candid reply.

Three options to keep the conversation open without locking your calendar:

  1. 90-day pilot on a single pillar (Trust $50K / Dev $75K / Financial
     $100K) — full pilot fee credited against any future acquisition.
     Details: https://aevion.app/pilot
     Low-commitment way to see the tech inside your stack.

  2. Quarterly update — 5-line status email at the start of each quarter.
     No call required. Reply only if something becomes interesting.

  3. Warm intro to a more relevant partner inside Stripe (Connect / Atlas
     / Climate / Issuing) — your read, if any.

Whichever fits. Either way, thanks for engaging.

— [Founder]
```

**Главный приём:** даёт Patrick'у три **разной величины** опции. Он почти наверняка возьмёт #2 (quarterly update) — потому что это **zero-cost для него** и оставляет дверь открытой. Это твоя цель.

---

## 4. Reply template — SILENCE 30 days (no reply at all)

**Отправлять на 28-30 рабочий день после первого send.** Один раз. Если снова молчание — закрыть thread.

**Subject:** `Re: AEVION acquisition — quarterly checkpoint`

```
Patrick,

Following up once on the AEVION acquisition brief from [DATE].

In the four weeks since, two concrete things shifted that may matter:

  1. [НАПРИМЕР: «QSign v2 SDK downloaded by 200+ teams on npm, including 3
     YC-batch fintech startups» — что-то проверяемое на момент send]

  2. [НАПРИМЕР: «AEVION DevHub now proxies 11 integrations live (+2 since
     last email: DeepL translation + Brevo SMS)»]

If timing remains wrong — no reply needed. If a 15-min call would help, the
brief lives at https://aevion.app/acquire?ref=stripe-fu1

— [Founder]
```

**Правило фоллоу-апа:**
- **Один и только один** follow-up. Не три, не пять.
- **Две проверяемые цифры** в bullets — Patrick проверит. Если цифры выдуманные — потеряешь его навсегда.
- `ref=stripe-fu1` — позволяет понять, что click из follow-up, а не из первого письма.
- После follow-up — **полная тишина 90 дней**. Не мониторь его LinkedIn-активность, не комментируй его твиты.

---

## 5. Send-чеклист (за 30 минут до отправки)

- [ ] **Перечитай вслух** письмо целиком. Если запинаешься — переписывай место.
- [ ] **Имя Patrick** в первой строке без typo. (Patrick, не «Patric» / «Patric Collison».)
- [ ] **Сегодня вторник, среда или четверг.** Не отправляй в пятницу (умрёт в weekend-inbox) и не в понедельник (тонет в inbox-backlog).
- [ ] **Время отправки 07:00-09:00 PT** (= 17:00-19:00 GMT, = 22:00 — 00:00 Алматы). Patrick в SF; письмо приходит к нему в начало рабочего дня.
- [ ] **Plain-text mode** в Gmail (не HTML, не подпись с логотипами). Отправляется как «from a human, not from marketing».
- [ ] **Никаких attachments.** Brief живёт по ссылке.
- [ ] **Tracking pixel / read-receipt** — **отключи**. Patrick видит трекеры за километр и игнорирует такие письма как marketing.
- [ ] **Ссылка** `https://aevion.app/acquire?ref=stripe` — кликни сам перед отправкой, проверь что страница грузится и chip «Hello, Stripe team» виден.
- [ ] **Запиши в spreadsheet** дату/время отправки.

---

## 6. Tracking schema

**Без heavy analytics.** Используем простой query-param.

| URL | Что показывает |
|-----|-----------------|
| `/acquire?ref=stripe` | Первый send — основной email |
| `/acquire?ref=stripe-fu1` | Click из follow-up #1 (только если silence-replied) |
| `/acquire?ref=stripe-warm` | Click из warm-intro (если кто-то форвардит письмо внутри Stripe) |

**На стороне `/acquire`:**
- При `ref=stripe` в URL — наверху страницы рендерится chip **«Hello, Stripe team — this brief was prepared for you.»** Это **subtle signal**, что письмо не часть рассылки.
- Сохраняется в `localStorage` (`aevion_acquire_ref`) на 30 дней — даже если буян откроет на следующий день без `?ref=`, chip остаётся.
- LOI-mailto subject получает суффикс **`[via Stripe]`** — когда буян жмёт «Запросить LOI», ты в inbox видишь «AEVION acquisition — LOI inquiry [via Stripe]» и **сразу знаешь** какой канал сработал.

**Что НЕ делаем:**
- Google Analytics / Mixpanel / Hotjar — не нужно для одного письма в неделю; добавляет creep-factor.
- Read-receipts — нет.
- Pixel-tracking — нет.

---

## 7. Что делать в первые 2 часа после send

1. **Засеки время.** Если Patrick отвечает — он отвечает в первые 4-12 часов или вообще никогда.
2. **НЕ открывай Gmail постоянно.** Поставь пушинг на этот один thread, всё остальное закрой.
3. **Если в течение 24 часов нет ответа:**
   - Это **нормально**. ~60% Tier-1 cold-emails не получают ответ в первый день.
   - Не отправляй второе письмо. Не пиши в LinkedIn. Ничего не делай.
   - Жди.
4. **Если приходит positive** — используй template #2 в течение 4 часов. Quick reply = серьёзность.
5. **Если приходит pushback** — используй template #3 на **следующий день** (не сразу — выглядит как заранее заготовленный ответ, что и так правда, но не должно быть очевидно).
6. **Если silence 7 дней** — НЕ фоллоу-ап. Жди 28-30 дней, потом template #4.

---

## 8. Если Patrick попросит NDA до звонка

Возможный исход. Ответ:

```
Patrick,

Of course. Two options:

  1. Use Stripe's standard mutual NDA template — happy to sign as-is for
     a 30-min call.

  2. Use ours (https://aevion.app/acquire → "Запросить NDA" CTA → simple
     mutual NDA, 2 pages).

Whichever you prefer. Once signed, I can share cap table, revenue cohorts,
legal opinion on AEV classification, pricing models — все materials под
data room.

— [Founder]
```

---

## 9. Календарь следующих 30 дней

| День | Действие |
|------|----------|
| D-0 (Tue/Wed/Thu) | **Send Stripe.** Один и только один. |
| D+1 | Молчание = жди. Reply = ответ через template. |
| D+5 | Если silence — **продолжай молчать**. Не отправляй Microsoft пока. |
| D+7 | Если silence — отправляй **Microsoft** (Charles Lamanna). |
| D+10 | Если silence от обоих — **Plaid** (Zach Perret, merger-of-equals framing). |
| D+14 | Если silence от всех — **Visa Ventures**. |
| D+28-30 | Stripe follow-up если silence (template #4). |
| D+30 | Microsoft follow-up если silence. |
| D+45 | Stop. Если из 4 Tier-1 ноль ответов за 6 недель — **переосмысли pitch**, не email-rhythm. |

---

— редакция 2026-05-24, AEVION
