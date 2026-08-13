import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Сторож: кастомный keyGenerator обязан нормализовать адрес — 13.08.2026.
//
// У пакета express-rate-limit нормализация встроена в keyGenerator ПО
// УМОЛЧАНИЮ, и это проверено фактом на живом сервере: три адреса одного
// префикса при лимите 2 дают 200/200/429, чужой префикс сохраняет свой бюджет.
//
// Но кастомный keyGenerator дефолтный ЗАМЕНЯЕТ — вместе с нормализацией. И тогда
// лимит по адресу не ограничивает IPv6-клиента вовсе: провайдер выдаёт клиенту
// целый префикс, каждый адрес из него получает свой счётчик, обход делается
// сменой последних групп адреса.
//
// На момент написания все 5 кастомных keyGenerator нормализуют (qpaynet × 3,
// build/ai, build/public) — сторож закрепляет это, а не чинит. Проверен
// отрицательным контролем: с убранной нормализацией в build/ai.ts краснеет.
//
// Локального хелпера (src/lib/rateLimit.ts) это не касается — там нормализация
// внутри, и на неё есть отдельный тест rateLimitIpNormalization.

const SRC = join(__dirname, "..", "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("сторож: кастомный keyGenerator нормализует адрес", () => {
  const files = walk(SRC);

  test("сканер вообще что-то нашёл — иначе зелёный ничего не значит", () => {
    // Без этой проверки переезд файлов или опечатка в пути дали бы «0 нарушений»
    // при нулевом охвате.
    const withPkg = files.filter((f) => readFileSync(f, "utf8").includes("express-rate-limit"));
    expect(files.length).toBeGreaterThan(100);
    expect(withPkg.length).toBeGreaterThan(3);
  });

  test("ни один кастомный keyGenerator не берёт адрес сырым", () => {
    const offenders: string[] = [];
    let seen = 0;

    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (!src.includes("express-rate-limit")) continue;
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!/keyGenerator\s*:/.test(lines[i])) continue;
        seen++;
        const body = lines.slice(i, i + 14).join("\n");
        // Нормализация либо прямо здесь, либо ключ вовсе не содержит адреса
        // (например, только идентификатор партнёрского ключа).
        const normalises = body.includes("ipKeyGenerator");
        const noAddress = !/req\.ip|x-forwarded-for|clientIp/i.test(body);
        if (!normalises && !noAddress) {
          offenders.push(`${f.replace(SRC, "src")}:${i + 1}`);
        }
      }
    }

    expect(seen).toBeGreaterThanOrEqual(5);
    expect(offenders, `адрес в ключе без нормализации: ${offenders.join(", ")}`).toEqual([]);
  });
});
