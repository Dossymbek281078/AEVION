#!/usr/bin/env node
/**
 * Автоперевод: отвечает ли ручка ПЕРЕВОДОМ, а не «успешно».
 *
 * Зачем отдельная проверка. 21.08.2026 `POST /api/i18n/translate` на проде
 * отвечал 200 и возвращал ПУСТЫЕ строки для en/de/fr, `[untranslatable]` для
 * одних входов и выдуманные фразы для других («Забронировать слот» →
 * «Comprehensive analysis»). Ни один сторож этого не видел: код ответа 200,
 * в Sentry тишина, длина массива совпадает с запросом.
 *
 * Фронтенд при пустом ответе подставляет исходную строку И КЛАДЁТ ЕЁ В КЭШ
 * браузера как готовый перевод. Кэш без версии и без срока — значит поломка
 * закрепляется у каждого посетителя навсегда.
 *
 * Что проверяем: перевод НЕПУСТОЙ и ОТЛИЧАЕТСЯ от исходника. Второе не менее
 * важно первого: «вернули то же самое» — обычный вид отказа переводчика.
 *
 * Запуск:
 *   BASE=https://api.aevion.app node scripts/i18n-translate-smoke.js
 *   node scripts/i18n-translate-smoke.js            # локально, 127.0.0.1:4001
 *
 * Читающая проверка: ничего не создаёт, безопасна на проде.
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");

// Слова выбраны так, чтобы перевод был однозначен и НЕ совпадал с исходником
// ни в одном из целевых языков. Числа и бренды намеренно не берём: их правила
// велят оставлять как есть, и «не изменилось» было бы законным ответом.
const CASES = [
  { target: "en", text: "кошка", forbid: ["кошка"] },
  { target: "en", text: "вода", forbid: ["вода"] },
  { target: "de", text: "кошка", forbid: ["кошка"] },
  { target: "kk", text: "кошка", forbid: ["кошка"] },
];

let step = 0, failed = 0;
const pass = (n, extra = "") => console.log(`  ${String(++step).padStart(2, "0")}  PASS  ${n}${extra ? "  — " + extra : ""}`);
const fail = (n, why) => { failed++; console.log(`  ${String(++step).padStart(2, "0")}  FAIL  ${n}  — ${why}`); };

async function main() {
  console.log(`i18n translate smoke → ${BASE}\n`);

  // 1. Ручка состояния: она называет движок и настроенность ключей.
  try {
    const r = await fetch(`${BASE}/api/i18n/health`, { signal: AbortSignal.timeout(15000) });
    const h = await r.json();
    if (r.ok && h.status === "ok") pass("health отвечает", `engine=${h.engine}`);
    else fail("health отвечает", `код ${r.status}`);
    // Настроенность НЕ считаем провалом: локально ключей может не быть.
    // Но печатаем — без этого «перевод пуст» невозможно истолковать.
    console.log(`      deepl=${h.deeplConfigured} anthropic=${h.anthropicConfigured} cache=${h.cacheSize}`);
  } catch (e) {
    fail("health отвечает", e.message);
  }

  // 2. Сам перевод.
  for (const c of CASES) {
    const name = `«${c.text}» → ${c.target}`;
    try {
      const r = await fetch(`${BASE}/api/i18n/translate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: c.target, texts: [c.text] }),
        signal: AbortSignal.timeout(40000),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        // Отсутствие ключа — законная причина, но она обязана быть ВИДНОЙ.
        fail(name, `код ${r.status}: ${JSON.stringify(body).slice(0, 80)}`);
        continue;
      }
      const tr = Array.isArray(body.translations) ? body.translations[0] : undefined;
      if (typeof tr !== "string") { fail(name, "в ответе нет строки перевода"); continue; }
      if (!tr.trim()) { fail(name, "перевод ПУСТОЙ при коде 200 — это и есть тихий отказ"); continue; }
      if (c.forbid.some((f) => tr.trim().toLowerCase() === f.toLowerCase())) {
        fail(name, `вернулся исходник «${tr}» — переводчик отказал молча`);
        continue;
      }
      if (/^\[.*\]$/.test(tr.trim())) { fail(name, `служебный маркер вместо перевода: ${tr}`); continue; }
      pass(name, `«${tr}»`);
    } catch (e) {
      fail(name, e.message);
    }
  }

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAIL"}  (${step - failed}/${step} passed, FAIL=${failed})`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
