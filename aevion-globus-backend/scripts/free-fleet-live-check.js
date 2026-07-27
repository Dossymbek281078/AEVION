#!/usr/bin/env node
/**
 * Бесплатный флот: кто РЕАЛЬНО отвечает, а не просто числится настроенным.
 *
 * `configured: true` означает «ключ задан», и ничего больше. Ключ может быть
 * просроченным, кредиты — кончиться, модель — исчезнуть из каталога провайдера
 * (у бесплатных это происходит регулярно). Разница видна только живым запросом.
 *
 * Скрипт спрашивает у каждого настроенного бесплатного провайдера одно слово и
 * печатает: ответил / не ответил, сколько миллисекунд, какой моделью.
 *
 * Запуск (по умолчанию — прод через фронт):
 *   node scripts/free-fleet-live-check.js
 *   BASE=https://aevion.vercel.app/api-backend node scripts/free-fleet-live-check.js
 *   ONLY=nvidia,groq node scripts/free-fleet-live-check.js
 *
 * Стоит несколько бесплатных запросов — это и есть цена проверки.
 */
const BASE = (process.env.BASE || "https://aevion.vercel.app/api-backend").replace(/\/$/, "");
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const PROMPT = process.env.PROMPT || "Ответь одним словом: LIVE";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 45_000);

async function getJson(path, init) {
  const r = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

function firstText(payload) {
  // Ответ /chat менялся по ходу жизни модуля; не привязываемся к одной форме.
  const d = payload?.data ?? payload;
  return (
    d?.text ?? d?.content ?? d?.message?.content ?? d?.reply ??
    d?.choices?.[0]?.message?.content ?? null
  );
}

async function run() {
  console.log(`\nБесплатный флот → ${BASE}\n`);

  const list = await getJson("/api/qcoreai/providers");
  if (list.status !== 200) {
    console.error(`✗ Каталог провайдеров недоступен: ${list.status}`);
    process.exit(2);
  }
  const data = list.body?.data ?? list.body;
  const all = data?.providers ?? [];
  const free = all.filter((p) => p.free || p.tier === "free");
  const configured = free.filter((p) => p.configured);
  const waiting = free.filter((p) => !p.configured);

  console.log(`Всего провайдеров: ${all.length} · бесплатных: ${free.length} · с ключом: ${configured.length}`);
  if (waiting.length) {
    console.log(`Ждут ключа: ${waiting.map((p) => p.id).join(", ")}`);
    console.log("Где взять и что даёт — docs/free-ai-fleet.md\n");
  }

  const targets = ONLY.length ? configured.filter((p) => ONLY.includes(p.id)) : configured;
  if (!targets.length) {
    console.log("Проверять нечего: ни один бесплатный провайдер не настроен.");
    process.exit(1);
  }

  let alive = 0;
  const dead = [];
  for (const p of targets) {
    const started = Date.now();
    let verdict;
    try {
      const r = await getJson("/api/qcoreai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p.id, messages: [{ role: "user", content: PROMPT }] }),
      });
      const ms = Date.now() - started;
      const text = firstText(r.body);
      if (r.status === 200 && typeof text === "string" && text.trim()) {
        alive++;
        console.log(`  ✓ ${p.id.padEnd(11)} ${String(ms).padStart(6)} мс · ${text.trim().slice(0, 40).replace(/\s+/g, " ")}`);
        verdict = null;
      } else {
        // Код ошибки важнее самого факта: 429 — кончились лимиты (провайдер
        // жив), 401 — ключ протух, 404 — модель исчезла из каталога.
        const err = r.body?.error ?? r.body?.message ?? `HTTP ${r.status}`;
        verdict = typeof err === "string" ? err.slice(0, 120) : JSON.stringify(err).slice(0, 120);
        console.log(`  ✗ ${p.id.padEnd(11)} ${String(ms).padStart(6)} мс · ${verdict}`);
      }
    } catch (e) {
      verdict = `не ответил за ${TIMEOUT_MS} мс (${e instanceof Error ? e.name : "ошибка"})`;
      console.log(`  ✗ ${p.id.padEnd(11)} ${" ".repeat(6)}    · ${verdict}`);
    }
    if (verdict) dead.push({ id: p.id, why: verdict });
  }

  console.log(`\nОтвечают ${alive} из ${targets.length}.`);
  if (dead.length) {
    console.log("Не ответили:");
    for (const d of dead) console.log(`  • ${d.id}: ${d.why}`);
    console.log("\n429 — упёрлись в бесплатный лимит (провайдер жив, ключ верный).");
    console.log("401/403 — ключ протух или не тот. 404 — модель исчезла из каталога провайдера,");
    console.log("поправьте список моделей или задайте <PROVIDER>_MODEL в Railway.");
  }
  process.exit(dead.length ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(2); });
