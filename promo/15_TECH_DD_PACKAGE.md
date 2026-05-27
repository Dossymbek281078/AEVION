# AEVION — Technical Due Diligence Package

> Для технической команды инвестора. Всё ниже проверяется самостоятельно,
> без предоставления учётных данных и без доверия к нашим словам.

---

## 1. Быстрая проверка (5 минут, только браузер)

Откройте в браузере — они работают прямо сейчас:

| URL | Что увидите |
|-----|-------------|
| **aevion.app/cyberchess** | Полноценная шахматная игра — Stockfish 18 в браузере, никакой установки |
| **aevion.app/constitution** | Учредительный документ с QSign-атестацией и AI-советником |
| **aevion.app/bank** | 30+ банковских экранов (переводы, карты, бюджет, аналитика) |
| **aevion.app/planet** | Реестр IP-атестаций — подайте артефакт и получите сертификат |
| **aevion.app/transparency** | Health-board: 24/24 daily smoke pass, статус всех модулей |
| **aevion.app/launch-status** | История запусков и версий |

---

## 2. API verification (curl, без авторизации)

Все endpoint-ы публичные. Скопируйте и выполните в терминале:

```bash
# Полный реестр всех 30+ модулей
curl https://aevion-production-a70c.up.railway.app/api/aevion/registry | python3 -m json.tool

# Health status всех сервисов
curl https://aevion-production-a70c.up.railway.app/api/aevion/health | python3 -m json.tool

# Статистика покрытия (frontend/openapi/health/og по каждому модулю)
curl https://aevion-production-a70c.up.railway.app/api/aevion/stats | python3 -m json.tool

# Planet submissions count
curl https://aevion-production-a70c.up.railway.app/api/planet/stats | python3 -m json.tool

# Полный OpenAPI 3.1 spec (все задокументированные endpoints)
curl https://aevion-production-a70c.up.railway.app/api/openapi.json | python3 -m json.tool | head -100
```

---

## 3. QSign — проверка post-quantum подписи

QSign использует ML-DSA-65 (FIPS 204, CRYSTALS-Dilithium). Проверить через API:

```bash
BASE=https://aevion-production-a70c.up.railway.app

# Создать тестовую подпись
curl -X POST "$BASE/api/qsign/v2/sign" \
  -H "Content-Type: application/json" \
  -d '{"payload": "test document 2026", "signerLabel": "tech-dd-test"}' \
  | python3 -m json.tool

# Ответ содержит: signatureId, publicKey, signature (ML-DSA-65 bytes),
# timestamp, algorithm="ML-DSA-65", fipsCompliant=true
```

Публичная верификация (не нужен ключ — алгоритм открытый):
- Алгоритм: ML-DSA-65 = NIST FIPS 204 (утверждён август 2024)
- SDK: npm install @dosymbek/qsign-v2 → полная документация
- Prod smoke: 20/20 PASS (см. aevion.app/transparency)

---

## 4. Что видит технический специалист в коде

GitHub: **github.com/Dossymbek281078/AEVION** (публичный репозиторий)

```bash
# Клонировать и посмотреть структуру
git clone https://github.com/Dossymbek281078/AEVION.git aevion-dd
cd aevion-dd

# История: 130+ PR, 500+ коммитов
git log --oneline | wc -l

# Тесты (требует Node.js 20+)
cd aevion-globus-backend && npm install && npm test
# Ожидаемо: 490+ vitest PASS

# TypeScript проверка
cd ../frontend && npm install && npx tsc --noEmit
```

Ключевые файлы для review:
- `aevion-globus-backend/src/routes/qsign.ts` — QSign implementation
- `aevion-globus-backend/src/routes/devhub.ts` — DevHub integrations
- `frontend/src/app/cyberchess/` — CyberChess (самый большой consumer-продукт)
- `frontend/src/app/bank/` — AEVION Bank (30+ экранов)

---

## 5. Архитектура (краткий обзор)

```
Frontend: Next.js 14 (App Router) → Vercel
Backend:  Node.js + Express + TypeScript → Railway
Database: PostgreSQL (Railway managed)
Auth:     JWT + bcrypt
AI:       Anthropic Claude + OpenAI + Mistral (QCoreAI router)
Crypto:   ML-DSA-65 (FIPS 204) — QSign
Storage:  Railway volumes + Cloudflare (static assets)
```

**Тест-покрытие:**
- Backend: 490+ vitest (aevion-globus-backend)
- E2E: Playwright (frontend/e2e/)
- Daily smoke: 24/24 против production URL

**Деплой:**
- Frontend: Vercel (auto-deploy from main branch)
- Backend: Railway (auto-deploy from main branch)
- Uptime: public на aevion.app/transparency

---

## 6. Честная оценка: что production-ready, что MVP

### Production-ready (можно коммерциализировать сегодня)

| Продукт | Готовность | Что нужно для запуска |
|---------|-----------|----------------------|
| **QSign v2** | 98% | Только маркетинг и продажи |
| **CyberChess** | 90% | Монетизация (Premium уже есть) |
| **HealthAI** | 85% | Медицинская верификация контента |
| **QShield** | 90% | Enterprise onboarding |
| **Planet** | 85% | Legal opinion на attestation |
| **Constitution** | 95% | Маркетинг на corpora

### MVP (нужна команда для продакшна)

| Продукт | Что есть | Что нужна команда |
|---------|---------|------------------|
| **DevHub** | 9 интеграций в проде | Sales, compliance per-provider |
| **AEVION Bank** | 30+ UI экранов, backend | Банковская лицензия, KYC-провайдер |
| **QBuild** | Полный ATS | Sales, customer success |
| **QCoreAI** | AI routing работает | Enterprise contracts с провайдерами |
| **QRight** | IP registry | Legal recognition стратегия |

### Что ограничено в KZ контексте (для справки)

| Ограничение | Причина | Решение при партнёрстве |
|------------|---------|------------------------|
| QPayNet payments | Stripe не работает с KZ мерчантами | DIFC структура + Adyen |
| QTrade real trading | Нет брокерской лицензии | License через DIFC |
| AEVION Bank real banking | Нет банковской лицензии | CBUAE/DIFC/AFK KZ |

---

## 7. 18-минутный демо-сценарий (для встречи)

**Правило:** первые 12 минут — только браузер и curl, ни одного слайда.

| Минута | Что показываем | Почему это важно |
|--------|---------------|-----------------|
| 0-2 | aevion.app/cyberchess — сыграть 5 ходов | Proof: AI в браузере, полноценный продукт |
| 2-4 | curl /api/aevion/registry → JSON 30+ модулей | Proof: это не landing pages, это реальный backend |
| 4-6 | curl /api/qsign/v2/sign → ML-DSA-65 подпись | Proof: FIPS 204 в production прямо сейчас |
| 6-8 | aevion.app/bank — показать 5 экранов | Proof: banking-grade UI без команды |
| 8-10 | aevion.app/devhub — показать 9 интеграций | Proof: DevHub concept работает |
| 10-12 | aevion.app/transparency → health-board | Proof: ничего не скрываем, всё мониторится |
| 12-16 | aevion.app/partner — финансовый сценарий | Предложение |
| 16-18 | Условия LOI — 8 строк | Запрос решения |

---

## 8. Что покажет NDA-уровень (после подписания)

- Полная cap table
- Revenue cohorts (пилотные клиенты)
- Legal opinion по AEV token classification
- Детальная архитектура QSign с исходным кодом review
- AEVION Bank prototype: test payment cycle end-to-end
- CIO Innovation Pipeline: 5+ незапущенных концепций

---

— AEVION · Technical Due Diligence Package · 2026-05-27
— Contact: yahiin1978@gmail.com · aevion.app/partner
