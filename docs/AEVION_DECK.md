---
marp: true
theme: default
paginate: true
size: 16:9
header: 'AEVION · Seed Round · 2026'
footer: 'aevion.app · github.com/Dossymbek281078/AEVION'
style: |
  section { background: #0b0e14; color: #e8efe9; font-family: -apple-system, system-ui, sans-serif; }
  h1 { color: #4ade80; }
  h2 { color: #4ade80; border-bottom: 2px solid #2c3b3a; padding-bottom: 8px; }
  strong { color: #4ade80; }
  table { font-size: 0.85em; }
  code { background: #1e293b; color: #e8efe9; padding: 2px 6px; border-radius: 4px; }
---

<!-- _class: lead -->
<!-- _paginate: false -->

# AEVION

## Операционная система доверия
## для эпохи ИИ-контента

**Seed round · $5 M · 2026**

`aevion.app` · *(контакт)*

---

## 1. Проблема

ИИ генерирует **миллиарды** единиц контента ежедневно.
Граница между оригинальным творчеством и копией **исчезла**.

**Чтобы заработать на своей работе, создатель сегодня жонглирует 4 платформами:**

| Что нужно | Где сейчас | Боль |
|---|---|---|
| Создать | Spotify / YouTube / GitHub | работает |
| Зарегистрировать IP | ВОИС / Роспатент | месяцы, юристы |
| Мониторить копии | ContentID / Audible Magic | дорого, B2B-only |
| Получать роялти | ASCAP / BMI / SoundExchange | разрозненно |

**Никто не решает все 4 в одном месте.**

---

## 2. Решение

# Один pipeline в одном UI

```
register  →  sign  →  certify  →  vote  →  earn
 QRight     QSign v2   Bureau    Planet    Bank
```

- **QRight** — реестр IP (SHA-256 + временная метка)
- **QSign v2** — подпись **ML-DSA-65** (NIST FIPS 204, постквантовая)
- **Bureau** — сертификат, готовый к юр. оформлению
- **Planet** — валидаторы → evidenceRoot → Merkle snapshot голосов
- **AEVION Bank** — автоматические роялти в AEC

**Время от создания до монетизации: минуты, не месяцы.**

---

## 3. Demo

**Откройте `aevion.app` — это live-продукт, не мокап.**

| Маршрут | Что показать |
|---|---|
| `/` | 3D-глобус: 29 продуктовых узлов |
| `/qright` | Регистрация работы → хеш → подпись |
| `/qsign` | Постквантовая подпись + публичный verify по ID |
| `/planet` | Submit → валидаторы → сертификат → голос |
| `/awards/music` | Лидерборд с медалями, метрика Y |
| `/qcoreai/multi` | 3 LLM в параллели + live cost |
| `/cyberchess` | Полный шахматный движок уровня chess.com |

---

## 4. Почему именно мы — 6 барьеров

1. **Trust Graph** — данные с первой подписи. FICO строила 30 лет, Google — 10.
2. **Атомарные транзакции** в один клик vs 4 платформы у конкурентов.
3. **Quantum Shield + ML-DSA-65** — постквантовая крипта **на витрине** для B2C.
4. **AI Trust Oracle (B2B)** — аналог Clearbit ($150 M ARR), больший TAM.
5. **Creator lock-in** — заработок + история = высокая стоимость переключения.
6. **Super-app** — 29 модулей кросс-продают друг друга. WeChat, но глобально.

---

## 5. Рынок

- **TAM = $340 B**
  - IP-лицензирование: $180 B
  - Creator economy: $104 B
  - Цифровые платежи: $56 B

- **SAM = $48 B** — трансграничный IP + цифровые музыка/кино + платежи создателям

- **SOM (Y3) = $180 M ARR** — захват 0.4% SAM

---

## 6. Бизнес-модель

| Поток дохода | Y1 | Y2 | Y3 |
|---|---:|---:|---:|
| Подписки платформы (creators, teams) | $2 M | $15 M | $45 M |
| Транзакционные комиссии (Bank, 0.1–2%) | $0.5 M | $8 M | $35 M |
| **Trust Oracle API** (enterprise) | $1 M | $12 M | $40 M |
| Сертификаты (Planet, Bureau) | $0.5 M | $5 M | $20 M |
| CyberChess premium + турниры | $0.2 M | $3 M | $15 M |
| Awards: спонсоры + ивенты | $0.1 M | $2 M | $10 M |
| AI Studio подписки | — | $5 M | $15 M |
| **ARR** | **$4.3 M** | **$50 M** | **$180 M** |

**Оценка @ 10×:** Y1 $43 M · Y2 $500 M · **Y3 $1.8 B**

---

## 7. Traction (на 2026-05-01)

- **14 production-модулей** в `main`
- **9 из них — Tier 2** (webhooks, embed, revoke, audit, transparency, admin, тесты, SDK)
- **30 merged PR за 9 дней** (22.04 → 30.04.2026)
- **295 коммитов** за 6 недель
- **Mobile SDK** для QCoreAI: Kotlin + Swift
- **CI зелёный** на GitHub Actions
- Open-source видимая velocity: `github.com/Dossymbek281078/AEVION`

*Пользовательские метрики (DAU, ARPU, retention) — после публичного запуска Q3 2026.*

---

## 8. Конкуренты

| Функция | AEVION | Chess.com | WeChat | Spotify | GitHub |
|---|:---:|:---:|:---:|:---:|:---:|
| Реестр IP | ✅ | ❌ | ❌ | ❌ | ❌ |
| Постквантовая крипта | ✅ ML-DSA | ❌ | ❌ | ❌ | ❌ |
| Цифровой банкинг | ✅ | ❌ | ✅ | ❌ | ❌ |
| Авто-роялти | ✅ | ❌ | ❌ | частично | ❌ |
| Compliance pipeline | ✅ Planet | ❌ | ❌ | ❌ | ❌ |
| Шахматы / игры | ✅ | ✅ | ❌ | ❌ | ❌ |
| Trust Score | ✅ | ❌ | ❌ | ❌ | ❌ |
| Глобальный, без цензуры | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Всё-в-одном** | **✅ 29 модулей** | ❌ | ✅ только Китай | ❌ | ❌ |

---

## 9. Roadmap

| Фаза | Окно | Что закрываем |
|---|---|---|
| **A — работает сейчас** | 2026-05 | 9 Tier-2 модулей в проде, mobile SDK |
| **B — IP+финтех** | май–июнь 2026 | QBuild, Payments Rail, QRight v2, Bank UI, GTM |
| **C — финтех-фронт** | июль–сент 2026 | QPayNet sandbox, QTradeOffline, QMaskCard scoping |
| **D — контент и здоровье** | окт 2026 – март 2027 | AI Music/Cinema Studio, HealthAI, Kids AI, StartupX |
| **E — сеть и токеномика** | 2027+ | VeilNetX, QChainGov DAO, LifeBox, остальные 8 |

---

## 10. Команда

**Фаундер** *(имя)* — продукт, архитектура, deal-flow.
**Ведущий разработчик** *(имя)* — full-stack, криптография.
**ИИ-ассистент в конвейере** — генерация роутов, тестов, миграций.

*После seed:*
- +3 senior разработчика (frontend, backend, infra)
- +2 продакта (compliance, creator economy)
- +1 юрист (IP, KYC, лицензирование)
- +1 BD/sales (B2B Trust Oracle)
- +2 community / content

**= 10 человек в команде.**

---

## 11. Что мы делаем со $5M

| Категория | % | Сумма | На что |
|---|---:|---:|---|
| Команда (10 людей × 18 мес) | 40% | $2.0 M | senior + senior+, +1 юрист |
| User acquisition | 25% | $1.25 M | creators onboarding, content, performance |
| Юр+compliance | 20% | $1.0 M | IP-лицензирование, KYC-вендоры, аудит |
| Runway / OPEX | 15% | $0.75 M | infra, страховка, юр. структуры |

**Раунд закрывает 18 месяцев** до Series A на $200M+ оценке.

---

## 12. Запрос и milestones

# $5 M seed

**Что инвестор получает:**
- Долю в платформе с **14 production-модулями** и ясным путём к $1B+
- Преимущество первого хода в **Trust Infrastructure** — новой категории
- **Сетевой эффект** через Trust Graph: усиливается с каждым пользователем

**Milestones до Series A (18 мес):**
1. **Q3 2026** — 50 K активных пользователей
2. **Q4 2026** — Mobile apps (iOS/Android), public API launch
3. **Q1 2027** — первые enterprise-клиенты Trust Oracle ($500K ARR)
4. **Q2 2027** — 200 K пользователей, музыкальные/кино партнёрства

---

<!-- _class: lead -->
<!-- _paginate: false -->

# Спасибо

**aevion.app**
**github.com/Dossymbek281078/AEVION**

*(контакт: email, Telegram, Calendly)*

# Ваши вопросы — лучшая часть встречи.
