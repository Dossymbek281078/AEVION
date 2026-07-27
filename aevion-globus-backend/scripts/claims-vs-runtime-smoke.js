#!/usr/bin/env node
/**
 * Сверяет ПУБЛИЧНЫЕ УТВЕРЖДЕНИЯ в коде страниц с тем, что отвечает прод.
 *
 * Зачем. 26.07.2026 нашлось, что `/acquire`, `/partner` и `/investor`
 * утверждают «ML-DSA-65 FIPS 204 in prod / GA / Completed / we already ship
 * it», тогда как health отвечал {"mode":"preview","reason":"seed_unset"}.
 * Расхождение прожило незамеченным неизвестно сколько: сторож консистентности
 * проверяет только файлы писем на рабочем столе, а страницы — никто.
 *
 * Класс дефекта тот же, что и всегда здесь: ничего не падает, всё зелёное,
 * а продающая страница обещает то, чего прод не делает. Ловится только
 * сопоставлением текста с живым ответом.
 *
 * Логика: если прод НЕ в режиме real — ни одно сильное утверждение о
 * работающей пост-квантовой подписи не должно присутствовать в исходниках
 * страниц. Если прод в real — утверждения законны, проверка проходит.
 *
 * Не offline: нужен живой BASE. readOnly — только чтение.
 */
const fs = require("fs");
const path = require("path");

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const PAGES_ROOT = path.join(__dirname, "..", "..", "frontend", "src", "app");

/**
 * Утверждения, законные ТОЛЬКО при mode=real. Ярлыки вроде
 * «post-quantum-ready» или «(FIPS 204, opt-in)» сюда намеренно не входят —
 * они верны в любом режиме и являются образцом честной формулировки.
 */
const STRONG_CLAIMS = [
  { re: /ML-DSA-65[^.\n]{0,40}\bin prod\b/i, label: "«ML-DSA-65 … in prod»" },
  { re: /ML-DSA-65[^.\n]{0,30}\bGA\b/i, label: "«ML-DSA-65 … GA»" },
  { re: /FIPS 204[^.\n]{0,30}\bGA\b/i, label: "«FIPS 204 … GA»" },
  { re: /FIPS 204[^.\n]{0,40}в production/i, label: "«FIPS 204 … в production»" },
  { re: /FIPS 204 compliance[\s\S]{0,120}?Completed/i, label: "«FIPS 204 compliance … Completed»" },
  { re: /post-quantum signatures[\s\S]{0,120}?We already ship it/i, label: "«post-quantum … we already ship it»" },
  { re: /(ML-DSA-65|FIPS 204)[^.\n]{0,60}already shipped as a product/i, label: "«… already shipped as a product»" },
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === "__tests__") continue;
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(e.name) && !/\.test\./.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  // 1. Что прод говорит о себе.
  let mode = null;
  let reason = null;
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(20000) });
    const json = await res.json();
    mode = json?.qsign?.mode ?? null;
    reason = json?.qsign?.reason ?? null;
  } catch (e) {
    console.log(`  ⚠ health недоступен (${BASE}): ${e.message}`);
    console.log("SKIP — без живого health сверять не с чем");
    process.exit(0);
  }

  if (!mode) {
    console.log("  ⚠ в health нет поля qsign — деплой старее PR #967");
    console.log("SKIP");
    process.exit(0);
  }

  console.log(`  прод: qsign.mode = ${mode} (${reason})`);

  // 2. Что утверждают страницы.
  const files = walk(PAGES_ROOT);
  const hits = [];
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    for (const c of STRONG_CLAIMS) {
      const m = c.re.exec(text);
      if (m) {
        const line = text.slice(0, m.index).split("\n").length;
        hits.push({ file: path.relative(PAGES_ROOT, f).replace(/\\/g, "/"), line, label: c.label });
      }
    }
  }

  // 3. Сопоставление.
  if (mode === "real") {
    console.log(`  ✓ подпись в режиме real — ${hits.length} сильных утверждений законны`);
    console.log("\nPASS — утверждения на страницах соответствуют проду");
    process.exit(0);
  }

  if (hits.length === 0) {
    console.log("  ✓ прод в preview, и сильных утверждений на страницах нет");
    console.log("\nPASS — утверждения на страницах соответствуют проду");
    process.exit(0);
  }

  console.log(
    `\n  ✘ прод подписывает в режиме "${mode}", но страницы утверждают обратное (${hits.length}):\n`,
  );
  for (const h of hits) console.log(`      ${h.file}:${h.line}  ${h.label}`);
  console.log(
    "\n  Починить можно двумя способами:\n" +
      "    1) выставить QSIGN_DILITHIUM_V1_SEED (64 hex) — утверждения станут правдой;\n" +
      "    2) смягчить формулировки до вида «post-quantum-ready» / «(FIPS 204, opt-in)»,\n" +
      "       который уже используется на /press и в partner/print.",
  );
  console.log("\nFAIL — публичные страницы обещают то, чего прод не делает");
  process.exit(1);
}

main().catch((e) => {
  console.log("  ✘ упало:", e && e.message ? e.message : e);
  console.log("\nFAIL");
  process.exit(1);
});
