// 🔴 20.10.2026 (Продажи увидели на /verify/cert-503ab5d6bfc504a7): витрина писала
// «AEVION holds at most 1 of 3, so we cannot forge or recover this key alone», а таблица
// тут же показывала доли 2 и 3 ON-SERVER. По коду бэка (routes/pipeline.ts protectOne:
// shards[1] → QuantumShield.shards, shards[2] → PublicShardWitness — обе в нашей базе)
// у AEVION 2 доли из 3 при пороге 2: платформа одна восстанавливает ключ. Патентный
// поверенный читает эту таблицу первым делом — ложь стоила бы обещания бюро.
// Сторож держит: ни одна поверхность (frontend/src + backend/src, ru/en/kk) не говорит
// «у AEVION не больше одной доли» / «один сервер подделать не может» в смысле Шамира;
// про со-подпись автора говорить можно — её ключ действительно только в браузере.
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FRONT = path.resolve(process.cwd(), "src");
const BACK = path.resolve(process.cwd(), "..", "aevion-globus-backend", "src");

const ЛОЖЬ: RegExp[] = [
  /holds at most/i,
  /at most one shard/i,
  /at most 1 of 3/i,
  /cannot forge or recover this key alone/i,
  /server alone cannot forge/i,
  /Server alone holds 1-of-3/i,
  /no single holder can forge/i,
  /no rogue platform action can forge/i,
  /TRULY DISTRIBUTED/,
  /не больше 1 доли из 3/,
  /не более 1 доли из 3/,
  /ең көбі 1-еуі/,
  // 21.10.2026 (окно Приложения, замер языка главной): ещё 6 фраз прошли мимо сторожа — /, /privacy,
  // /qright, /quantum-shield, /verify ×2 говорили «AEVION never holds 2 / never holds enough / no single party».
  /never holds? (2|two|enough)/i,
  /no single party/i,
];
/** Правдивая фраза — контроль, что прибор читает те же файлы. */
const ПРАВДА = /AEVION keeps 2 of the 3 shards|У AEVION 2 доли из 3|AEVION-да 3 үлестің 2-еуі бар/;

function файлы(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "__tests__" && e.name !== "tests") out.push(...файлы(p)); }
    else if (/\.(ts|tsx|md|json|html)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

describe("осколки: витрина не обещает «у AEVION не больше одной доли»", () => {
  const все = [...файлы(FRONT), ...файлы(BACK)];
  test("знаменатель: файлов просмотрено > 500, бэкенд на месте", () => {
    expect(все.length, `файлов ${все.length}`).toBeGreaterThan(500);
    expect(fs.existsSync(path.join(BACK, "routes", "pipeline.ts"))).toBe(true);
  });
  test("ложных фраз 0 на всех поверхностях (frontend/src + backend/src)", () => {
    const находки: string[] = [];
    for (const f of все) {
      const s = fs.readFileSync(f, "utf8");
      for (const re of ЛОЖЬ) if (re.test(s)) находки.push(`${path.relative(process.cwd(), f)} :: ${re}`);
    }
    expect(находки, `ложных фраз ${находки.length} из ${все.length} файлов`).toEqual([]);
  });
  test("КОНТРОЛЬ: правдивая фраза есть на /verify и /qright (ru/en/kk), прибор читает те же файлы", () => {
    const где = все.filter((f) => ПРАВДА.test(fs.readFileSync(f, "utf8"))).map((f) => path.basename(f));
    expect(где, где.join(", ")).toEqual(expect.arrayContaining(["page.tsx", "verifyI18n.ts", "qrightI18n.ts"]));
  });
  test("/verify: фраза о со-подписи показывается только при authorCosign.present", () => {
    const page = fs.readFileSync(path.join(FRONT, "app", "verify", "[id]", "page.tsx"), "utf8");
    const i = page.indexOf("What AEVION cannot forge is the author co-signature");
    expect(i).toBeGreaterThan(0);
    expect(page.slice(i - 200, i)).toContain("authorCosign?.present ?");
  });
  test("КОНТРОЛЬ прибора: подложенная ложь ловится", () => {
    expect(ЛОЖЬ.some((re) => re.test("AEVION holds at most 1 of 3, so we cannot forge"))).toBe(true);
    expect(ЛОЖЬ.some((re) => re.test("У AEVION не больше 1 доли из 3"))).toBe(true);
    expect(ЛОЖЬ.some((re) => re.test("AEVION never holds 2 of them."))).toBe(true);
    expect(ЛОЖЬ.some((re) => re.test("no single party (including AEVION) ever holds enough to forge"))).toBe(true);
  });
});
