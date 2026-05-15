# Черновики для социальных сетей

> НЕ публиковать — черновики для финального вычитки перед запуском.
> Персонализируй [контакт/ссылки] перед публикацией.

---

## Twitter/X thread (5 твитов)

**1/**
> AEVION выходит из закрытой беты.
>
> Один pipeline вместо четырёх: register → sign → certify → vote → earn.
> 16 production-модулей. Постквантовая криптография в проде.
>
> 🔗 aevion.app

---

**2/**
> Что внутри:
>
> 🪪 QRight — IP-реестр: SHA-256 + временная метка
> 🔏 QSign — ML-DSA-65 (NIST FIPS 204, постквантовая)
> 📜 Bureau — юридический сертификат + Trust Graph
> 🌍 Planet — compliance snapshots + Merkle proof
> 🏦 Bank — AEC роялти автоматом
>
> Каждый шаг криптографически связан с предыдущим.

---

**3/**
> Почему ML-DSA-65, а не RSA?
>
> Harvest-now, decrypt-later: гос-ва уже сохраняют трафик,
> рассчитывая расшифровать через 7–10 лет на квантовом компьютере.
>
> Документы, подписанные RSA сегодня, через 7 лет не будут доказательством.
> Наши — будут.
>
> Это не "будущее" — это юридическая разница в 2031 году.

---

**4/**
> Velocity: 130+ merged PR за 30 дней.
>
> Не "наговорил Cursor'у".
> Каждый PR прошёл tsc + vitest + playwright + CI gate.
>
> Daily smoke 24/24. Платный E2E на проде:
> Stripe → Bureau cert → Trust Graph → AEC.
>
> Открытый репо: github.com/Dossymbek281078/AEVION

---

**5/**
> Ищем первых reference customers:
>
> 10 сертификатов Verified + 1 Notarized — бесплатно.
> В обмен: 4 недели реального юзкейса + отзыв.
>
> Студии, агентства, фотографы, музыканты, разработчики.
>
> DM или [контакт]
> aevion.app · github.com/Dossymbek281078/AEVION

---

## LinkedIn post (длинный)

**Заголовок:**
AEVION выходит из закрытой беты — операционная система доверия для эпохи ИИ-контента.

---

ИИ ежедневно генерирует миллиарды единиц контента.

Граница между оригинальным творчеством и копией исчезла.

Чтобы доказать авторство, зафиксировать его юридически и получить роялти — создатель сегодня жонглирует **четырьмя разорванными платформами**. Отдельная регистрация, отдельная подпись, отдельный мониторинг, отдельные выплаты.

Мы это собрали в один pipeline в одном UI.

**aevion.app**

---

**Что уже работает на проде:**

• 16 production-модулей в `main`, 9 из них — Tier 2 (webhooks, SDK, audit, embed, revoke, transparency)
• Уникальные техактивы: ML-DSA-65 (постквантовая подпись NIST FIPS 204), Quantum Shield (Shamir 2-of-3 + Ed25519), Trust Graph
• Платный E2E: Stripe → Bureau cert → Trust Graph edge → AEC reward (Bronze 50 / Silver 150 / Gold 500 / Platinum 1000 AEC)
• Daily smoke 24/24 PASS в GitHub Actions
• Velocity: 130+ merged PR за 30 дней, 600+ коммитов

**Бизнес-модель:** подписки + транзакционные комиссии + Trust Oracle API (B2B) + сертификаты.
Целевой ARR год 3 — $180M.

**Сейчас:**
Открыт seed-раунд $5M на ускорение GTM и юр. плечо в 6 юрисдикциях.
Ищем первых **reference customers** — пилот 10 cert Verified + 1 Notarized бесплатно за 4 недели юзкейса.

8-минутное демо: [ссылка]
Repo: github.com/Dossymbek281078/AEVION

#AI #IntellectualProperty #PostQuantumCryptography #CreatorEconomy #B2BSaaS #StartupKZ #Kazakhstan

---

## Telegram (короткий вариант)

```
🚀 AEVION — открытая бета

Платформа для авторов: один pipeline вместо четырёх
register → sign → certify → vote → earn

Что есть:
• Постквантовая подпись ML-DSA-65 (NIST FIPS 204)
• Bureau-сертификат + Trust Graph
• Planet compliance snapshots
• AEC роялти автоматом
• 16 production-модулей, 130+ merged PR

Prod: https://aevion.app
Repo: github.com/Dossymbek281078/AEVION

Ищем reference customers: 10 certs Verified бесплатно за 4 недели юзкейса.
Пишите: [контакт]
```

---

## Habr/vc.ru (тизер для анонса публикации)

> Перед публикацией полной статьи — короткий пост-анонс

```
Написал статью о том, как мы строили постквантовую IP-инфраструктуру за 30 дней:
«Постквантовая подпись + Trust Graph + AEC: один pipeline вместо четырёх»

Ключевые темы:
— Почему ML-DSA-65 а не RSA (harvest-now, decrypt-later)
— Trust Graph как долгосрочный moat
— AEC ↔ fiat boundary: почему не выводим в деньги
— Что потрогать на aevion.app прямо сейчас
— 130+ PR за 30 дней: как работает velocity-of-1

[ссылка на статью]
```
