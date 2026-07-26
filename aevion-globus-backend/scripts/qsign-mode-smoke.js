#!/usr/bin/env node
/**
 * Offline: проверяет, что health честно называет режим подписи.
 *
 * Зачем. Письма партнёрам утверждают «post-quantum signatures (ML-DSA-65,
 * FIPS 204)». Это включается переменной QSIGN_DILITHIUM_V1_SEED; без неё прод
 * отдаёт SHA-512-отпечаток, который наше же описание API называет
 * «NOT a cryptographic signature». Самый коварный случай — ключ ЗАДАН, но не
 * того формата: система молча падает в preview, а снаружи это неотличимо от
 * работающей подписи.
 *
 * Работает против dist/, а не против BASE, поэтому в оркестраторе offline.
 */
const path = require("path");

const mod = require(path.join(__dirname, "..", "dist", "lib", "qsignV2", "dilithium.js"));
if (typeof mod.dilithiumStatus !== "function") {
  console.log("ПРОВАЛ: dilithiumStatus не экспортируется");
  process.exit(1);
}

let ok = true;
function check(label, got, want) {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) ok = false;
  console.log(`${pass ? "  ✓" : "  ✘"} ${label}`);
  if (!pass) console.log(`      получено ${JSON.stringify(got)}\n      ожидалось ${JSON.stringify(want)}`);
}

const original = process.env.QSIGN_DILITHIUM_V1_SEED;

// 1. Ключа нет — preview, и причина названа.
delete process.env.QSIGN_DILITHIUM_V1_SEED;
check("ключ не задан → preview/seed_unset", mod.dilithiumStatus(), {
  mode: "preview",
  reason: "seed_unset",
});

// 2. Ключ задан, но короткий — САМЫЙ ВАЖНЫЙ СЛУЧАЙ.
// Без этой проверки «задал и работает» и «задал, но не то» неразличимы.
process.env.QSIGN_DILITHIUM_V1_SEED = "deadbeef";
check("ключ битый → preview/seed_malformed", mod.dilithiumStatus(), {
  mode: "preview",
  reason: "seed_malformed",
});

// 3. Ключ задан, но с нехексовым символом на нужной длине.
process.env.QSIGN_DILITHIUM_V1_SEED = "z".repeat(64);
check("ключ нужной длины, но не hex → seed_malformed", mod.dilithiumStatus(), {
  mode: "preview",
  reason: "seed_malformed",
});

// 4. Корректный ключ — real.
process.env.QSIGN_DILITHIUM_V1_SEED = "ab".repeat(32);
check("корректный 64-hex ключ → real/seed_set", mod.dilithiumStatus(), {
  mode: "real",
  reason: "seed_set",
});

// 5. Пробелы по краям не должны ломать распознавание.
process.env.QSIGN_DILITHIUM_V1_SEED = "  " + "ab".repeat(32) + "  ";
check("пробелы по краям обрезаются", mod.dilithiumStatus(), {
  mode: "real",
  reason: "seed_set",
});

// 6. Сид не должен утекать в статус ни в каком виде.
const asText = JSON.stringify(mod.dilithiumStatus());
const leaks = asText.includes("ab".repeat(8));
if (leaks) ok = false;
console.log(`${leaks ? "  ✘" : "  ✓"} значение ключа не попадает в статус`);

if (original === undefined) delete process.env.QSIGN_DILITHIUM_V1_SEED;
else process.env.QSIGN_DILITHIUM_V1_SEED = original;

console.log(ok ? "\nPASS — режим подписи сообщается честно" : "\nFAIL");
process.exit(ok ? 0 : 1);
