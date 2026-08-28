import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Production answers `{"qsign":{"mode":"preview","reason":"seed_unset"}}` until the
 * signing seed is set. Any page that tells a buyer the post-quantum signature is
 * shipping, GA or "in production" is therefore a claim the runtime contradicts —
 * and these are exactly the pages an investor or acquirer checks.
 *
 * Wording that stays true in both modes ("key-activated", "включается ключом")
 * is allowed. This guard is static on purpose: it fails in CI before a page ever
 * reaches a reader, whereas the runtime check (claims-vs-runtime smoke) can only
 * catch it after deploy.
 */

// Путь от самого файла теста, а не от process.cwd(): при полном прогоне
// достаточно одного теста, сменившего рабочую папку в том же воркере, чтобы
// сторож начал сканировать не тот каталог. Это уже случилось — он упал в
// общем прогоне и был зелёным в одиночку.
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Phrases that assert the signature is live in production, not merely implemented. */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  // Ловим «GA» на любом расстоянии в пределах предложения, а не только вплотную
  // и не только в скобках: partner/print писал «ML-DSA-65 FIPS 204 GA», и обе
  // прежние узкие формы это пропустили — нашёл рантайм-смок claims-vs-runtime.
  { pattern: /ML-DSA-65[^.\n]{0,60}\bGA\b/i, why: "«GA» в одном предложении с ML-DSA-65" },
  { pattern: /FIPS\s*204[^.\n]{0,60}\bGA\b/i, why: "«GA» в одном предложении с FIPS 204" },
  { pattern: /In production\s*·\s*QSign/i, why: "«In production» над блоком QSign" },
  { pattern: /FIPS\s*204[^.\n]{0,30}\bin prod\b/i, why: "«in prod» — прод отвечает preview" },
  { pattern: /FIPS\s*204[^.\n]{0,30}в production/i, why: "«в production» — прод отвечает preview" },
  { pattern: /we already ship it/i, why: "«we already ship it» о постквантовой подписи" },
  { pattern: /ML-DSA-65 on the shelf/i, why: "«on the shelf» — утверждение о доступности" },
  { pattern: /No one else ships ML-DSA-65/i, why: "непроверяемое «никто больше не поставляет»" },
  // Добавлено 28.08.2026. Прежние восемь шаблонов — ровно те формулировки, что
  // отгрузились в августе. Сторож по образцам знает только их: скажи то же самое
  // иначе — не заметит. Ниже равнозначные формы и, главное, РУССКИЕ: весь список
  // выше английский, а половина страниц говорит по-русски.
  //
  // Проверено ДО добавления: на сегодняшнем тексте эти шаблоны дают НОЛЬ
  // совпадений — они не требуют переписывать ни одну живую страницу.
  { pattern: /ML-DSA-65[^.\n]{0,40}\b(live|active|enabled|shipping)\b/i, why: "ML-DSA-65 названа действующей — прод отвечает preview" },
  { pattern: /постквантов[а-яё]*[^.\n]{0,40}(работает|включена|активна|уже есть)/i, why: "по-русски сказано, что постквантовая подпись работает" },
  { pattern: /FIPS\s*204[^.\n]{0,40}(работает|включен)/i, why: "по-русски сказано, что FIPS 204 включён" },
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

export function findClaimViolations(files: string[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const { pattern, why } of FORBIDDEN) {
      const match = text.match(pattern);
      if (!match) continue;
      const line = text.slice(0, match.index ?? 0).split("\n").length;
      violations.push(`${file.replace(APP_DIR, "src/app")}:${line} — ${why}: «${match[0]}»`);
    }
  }
  return violations;
}

// Сканирование сотен файлов делается один раз при загрузке модуля, а не внутри
// it(): в одиночном прогоне это 0.5 с, но в полном — параллельно с остальными
// 45 файлами тестов — упиралось в дефолтные 5 с и падало по таймауту. Тест,
// который краснеет от загруженности машины, не отличить от настоящей находки.
const FILES = collectSourceFiles(APP_DIR);
const VIOLATIONS = findClaimViolations(FILES);

describe("post-quantum claims match what production answers", () => {
  it("scans a real, non-trivial set of page sources", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("no page claims the signature is GA or in production", () => {
    expect(VIOLATIONS).toEqual([]);
  });

  it("the guard actually catches a violation (negative test)", () => {
    const seeded = join(APP_DIR, "__tests__", "fixtures", "qsignClaimViolation.txt");
    // The fixture holds the exact wording that shipped on /acquire before this
    // guard existed. If the matcher ever stops recognising it, the check above
    // becomes decoration.
    const found = findClaimViolations([seeded]);
    expect(found.length).toBeGreaterThan(0);

    // Усилено 28.08.2026. «Больше нуля» доказывает, что сработал КАКОЙ-ТО
    // шаблон, а не каждый: перечень выглядит охватом, а ловить может половину.
    // Поэтому образец обязан задевать ВСЕ шаблоны — иначе добавленный сегодня
    // может молча не работать.
    // Нарушения — СТРОКИ с уже вписанной причиной, а не объекты: первый заход я
    // читал у них поле `why` и получил «не сработал ни один» на шаблонах,
    // которые заведомо срабатывают. Пустое поле значило «читаю не ту форму».
    const silent = FORBIDDEN.filter((f) => !found.some((v) => v.includes(f.why))).map((f) => f.why);
    expect(silent, "шаблоны не сработали ни на одной строке образца: " + silent.join(" | ")).toEqual([]);
  });
});
