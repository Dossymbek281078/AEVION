import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Личный адрес основателя не стоит на публичных страницах — только на /acquire
 * (LOI/NDA: рука основателя). Везде остальное — ролевой ящик data@aevion.app
 * (живость подтверждена Почтой 11.10: MX improvmx, проба дошла).
 *
 * Повод 13.10.2026 (bd): на /proof рядом с data@aevion.app стоял личный mailto —
 * из подвала и JSON-LD contactPoint корневого макета; адрес жил в 37 файлах фронта.
 * Свип со знаменателем по ВСЕМ файлам src и public; allowlist — только acquire.
 */
const ЛИЧНЫЙ = ["yahiin", "1978@gmail.com"].join("");
const РОЛЕВОЙ = "data@aevion.app";
const ALLOWLIST = [/^src[\\/]app[\\/]acquire[\\/]/];

function файлы(dir: string, acc: string[] = []): string[] {
  for (const имя of readdirSync(dir)) {
    const p = join(dir, имя);
    if (имя === "node_modules" || имя === ".next") continue;
    if (statSync(p).isDirectory()) файлы(p, acc);
    else if (/\.(ts|tsx|js|mjs|json|md|txt|xml|html|svg)$/.test(имя)) acc.push(p);
  }
  return acc;
}

describe("личный адрес основателя — только на /acquire", () => {
  const корень = process.cwd();
  const список = [...файлы(join(корень, "src")), ...файлы(join(корень, "public"))];

  it("🔴 ни в одном файле вне allowlist личного адреса нет (знаменатель — все файлы src и public)", () => {
    expect(список.length, "знаменатель: файлов просмотрено").toBeGreaterThan(3000);
    const нарушители: string[] = [];
    let вAllowlist = 0;
    for (const f of список) {
      const rel = f.slice(корень.length + 1);
      if (!readFileSync(f, "utf8").includes(ЛИЧНЫЙ)) continue;
      if (ALLOWLIST.some((re) => re.test(rel))) { вAllowlist += 1; continue; }
      нарушители.push(rel);
    }
    expect(вAllowlist, "allowlist acquire всё ещё несёт адрес (иначе сторож проверяет пустоту)").toBeGreaterThan(0);
    expect(нарушители).toEqual([]);
  });

  it("ролевой ящик стоит там, где был личный: подвал, корневой макет (JSON-LD), security.txt", () => {
    for (const rel of ["src/components/SiteFooter.tsx", "src/app/layout.tsx", "public/.well-known/security.txt"]) {
      expect(readFileSync(join(корень, rel), "utf8"), rel).toContain(РОЛЕВОЙ);
    }
  });

  it("КОНТРОЛЬ: прибор находит личный адрес там, где он разрешён", () => {
    const acquire = readFileSync(join(корень, "src/app/acquire/page.tsx"), "utf8");
    expect(acquire).toContain(ЛИЧНЫЙ);
  });
});
