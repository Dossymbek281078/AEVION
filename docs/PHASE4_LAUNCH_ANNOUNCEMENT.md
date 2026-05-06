# Phase 4 — Public Launch Announcement (draft)

> Черновик публичного анонса AEVION для запуска Phase 4. Используется
> в Twitter / LinkedIn / habr / vc.ru / Telegram-каналы.
>
> **Состояние:** draft. Перед публикацией — вычитка и финальный тайминг.

---

## Twitter / X (1 thread, 5 tweets)

**1/**
> AEVION выходит из приватной беты.
>
> Один pipeline вместо четырёх: register → sign → certify → vote → earn.
> 14 production-модулей. Постквантовая криптография на витрине.
>
> 🔗 aevion.app

**2/**
> Что внутри:
>
> 🪪 QRight — реестр IP с SHA-256 + Bitcoin timestamp
> 🔏 QSign — ML-DSA-65 (NIST FIPS 204, постквантовая подпись)
> 📜 Bureau — юридический cert + Trust Graph
> 🌍 Planet — compliance snapshots
> 🏦 Bank — AEC роялти автоматом

**3/**
> Платный E2E flow live на проде:
>
> Stripe → Bureau cert → Trust Graph edge → AEC reward
> Bronze 50 / Silver 150 / Gold 500 / Platinum 1000
>
> Daily smoke 24/24. Velocity: 114 PR за 30 дней.

**4/**
> AI Trust Oracle — B2B API «оригинален ли этот контент». Аналог Clearbit
> ($150M ARR) для эры ИИ-генерации. TikTok / Spotify / YouTube могут
> тянуть наши Merkle-snapshot'ы вместо своей анти-плагиат стек.

**5/**
> Открыты для первых reference customers:
>
> 10 сертификатов Verified бесплатно + 1 Notarized + onboarding-звонок,
> в обмен — 4 недели реального юзкейса и отзыв.
>
> Пишите → <email/Telegram>
> aevion.app · github.com/Dossymbek281078/AEVION

---

## LinkedIn (1 post)

**Заголовок:**
AEVION выходит из приватной беты — операционная система доверия для эпохи ИИ-контента.

**Тело:**

ИИ ежедневно генерирует миллиарды единиц контента. Граница между оригинальным творчеством и копией исчезла. Чтобы доказать авторство, проверить качество и получить роялти, создатель сегодня жонглирует **четырьмя разорванными платформами** — для регистрации, для подписи, для мониторинга, для выплат.

AEVION собирает это в один pipeline в одном UI: `register → sign → certify → vote → earn`.

🔗 **aevion.app**

**Что уже работает на проде:**

• 14 production-модулей в `main`, из них 9 — Tier 2 (webhooks, embed, revoke, transparency, admin, audit, тесты, SDK)
• Уникальные техактивы: ML-DSA-65 (постквантовая подпись, NIST FIPS 204), Quantum Shield (Shamir 2-of-3 + Ed25519)
• Платный E2E flow: Stripe → Bureau cert → Trust Graph edge → AEC reward (Bronze 50 / Silver 150 / Gold 500 / Platinum 1000)
• Daily smoke 24/24 в GitHub Actions
• Velocity: 114 merged PR за 30 дней, 561 коммит за 30 дней

**Бизнес-модель:** подписки + транзакционные комиссии + Trust Oracle API (B2B) + сертификаты. Целевой ARR год 3 — $180M, оценка ~$1.8B при консервативном 10× мультипликаторе (Snowflake 15-20×, Palantir 18×).

**Сейчас:**
• Открыт seed-раунд $5M на ускорение GTM и юр. плечо в 6 юрисдикциях.
• Открыты для первых **reference customers** — пилотный пакет 10 cert Verified + 1 Notarized бесплатно за 4 недели реального юзкейса и письменный отзыв.

Демо платформы (8 минут): `<unlisted YouTube link после P3-1>`
Onepager: `<aevion.app/onepager>` *(добавить публичный URL когда будет)*
Repo: `github.com/Dossymbek281078/AEVION`

Связь — в DM или `<email>`.

#AI #IntellectualProperty #PostQuantumCryptography #CreatorEconomy #B2BSaaS #StartupKZ

---

## Habr / vc.ru (тех-разбор, 1500-2000 слов)

**Заголовок:** «Постквантовая подпись + Trust Graph + AEC: как мы строим один pipeline вместо четырёх»

**Структура (TODO в момент написания):**
1. Контекст — почему 2026 это переломный год для IP-инфраструктуры (200 слов)
2. Стек — почему ML-DSA-65 а не RSA, какие boundaries (300 слов)
3. Trust Graph — что это такое, как накапливается, почему moat (400 слов)
4. AEC ↔ fiat — наша граница: почему AEC не выводится в фиат, и зачем это надо (300 слов)
5. Demo — что можно потрогать прямо сейчас на `aevion.app` (300 слов)
6. Метрики — 14 модулей / 114 PR / 24-step daily smoke (200 слов)
7. Что дальше — open call для reference customers и инвесторов (200 слов)

**Когда писать:** после P3-1 (запись демо) и P3-3 (первый закрытый клиент). Без них пост получается «пустым» — нет видео и нет соцпруфа.

---

## Telegram-каналы (RU IT / стартапы)

**Каналы (приоритет):**
- @razgovornik (KZ tech) — личное знакомство admin'а
- @paywall (StartupKZ) — открытый submission
- @cryptobranch (RU crypto) — для пост-квантовой части
- @vc_io_news (vc.ru) — кросс-постинг
- @startupkz (Almaty Tech) — ICP-1 живёт там

**Шаблон сообщения (1500 знаков, читаемо в одном экране телеги):**

```
🚀 AEVION — открытая бета

Платформа для авторов: один pipeline вместо четырёх (register → sign → certify → vote → earn).

Что есть:
• Постквантовая подпись ML-DSA-65 (NIST FIPS 204)
• Bureau-сертификат с Bitcoin-таймстампом
• Trust Graph — социальный капитал автора
• AEC роялти автоматом за каждый verified cert

Live на проде: https://aevion.app
Repo: github.com/Dossymbek281078/AEVION

Velocity 114 PR/30d, 14 production-модулей.

Ищем reference customers (студии, агентства, фотографы, авторы) — пилот 10 сертификатов бесплатно за 4 недели юзкейса и отзыв.

Пишите в @<контакт>
```

---

## Чек-лист публикации (пройти по порядку)

- [ ] **P3-1 done** — записан 8-min демо, залит на YouTube unlisted, ссылка добавлена в onepager.
- [ ] **P3-3 done** — есть 1 reference customer с подписанным пилотом.
- [ ] **DNS / domain** — `aevion.app` стабилен 14 дней без падений (для habr / vc.ru — обязательно).
- [ ] **Email** — корпоративный `<name>@aevion.app` работает.
- [ ] **Telegram** — публичный канал `@aevion_official` создан + 1-2 поста для прогрева.
- [ ] **Twitter / X** — handle создан, фото профиля + bio + linktree.
- [ ] **LinkedIn page** — Aevion компания-страница активна.
- [ ] **Press kit** — onepager публично доступен, скриншоты, логотипы (.png/.svg).
- [ ] **Investor demo audit** — `bash scripts/investor-demo-audit.sh` 18/18 green в день публикации.
- [ ] **Sentry / observability** — alerts включены, оперативный канал «прод сломался» работает.

Запуск **только** после прохождения чек-листа. Иначе HN-эффект сжигает мост.
