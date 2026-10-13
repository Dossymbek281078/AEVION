import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { yazykZaprosa } from "../yazykZaprosa";

/*
 * 🔴 Лёгкий маршрут /cyberchess/p/<id> не тянет ни монолит шахмат, ни корневой макет.
 *
 * Повод 13.10.2026: страница React на этом адресе везла 577 КБ сжатого JS, из них
 * ≈420 — корневой макет (ClientProviders: словарь сайта 174 КБ, шапка, перевод).
 * Маршрут стал Route Handler: HTML собирается на сервере, ходы проверяет сервер,
 * на клиенте — инлайн-скрипт без React. Порог прода: JS ≤310 КБ, Fast 3G ≤2,8 с.
 */
const КОРЕНЬ = join(process.cwd(), "src/app/cyberchess");
const МАРШРУТ = join(КОРЕНЬ, "p");
const ЗАПРЕЩЕНО = ["page.tsx", "page", "./AiCoach", "../AiCoach", "coachKnowledge", "chessCoachEngine", "coachLessons", "variants", "tournament", "chessSounds", "deepEngine", "stockfish", "react", "react-dom", "next/dynamic", "@/components/ClientProviders", "@/components/SiteHeader", "@/components/AutoTranslate", "@/lib/i18n", "@/lib/track"];
const ПРЕДЕЛ_БАЙТ = 230_000; // products.ts (77 КБ, только на сервере: channelFrom/postFrom) + словарь шахмат + apiBase + логика

function файлыМаршрута(): string[] {
  const out: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (n === "__tests__") continue; if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(n)) out.push(p); } };
  walk(МАРШРУТ);
  return out;
}
function импорты(src: string): string[] {
  // без привязки к началу строки: мутация 13.10 дописала второй import на ту же строку и прошла мимо ^-якоря
  const out: string[] = []; const re = /\bimport (?!type )[^;]*? from "([^"]+)";/g; let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}
function путьМодуля(изФайла: string, спец: string): string | null {
  let base: string;
  if (спец.startsWith("@/")) base = join(process.cwd(), "src", спец.slice(2)); else if (спец.startsWith(".")) base = join(изФайла, "..", спец); else return null;
  for (const c of [base + ".ts", base + ".tsx", join(base, "index.ts")]) if (existsSync(c)) return c;
  return null;
}

describe("лёгкий маршрут задачи — Route Handler без монолита и без корневого макета", () => {
  const файлы = файлыМаршрута();

  it("знаменатель: маршрут — обработчик и логика, страницы React нет", () => {
    const имена = файлы.map((f) => f.slice(МАРШРУТ.length + 1).replace(/\\/g, "/")).sort();
    expect(имена).toEqual(["[id]/route.ts", "logikaZadachi.ts", "pzSlova.ts", "yazykZaprosa.ts"]);
  });

  it("🔴 обработчик не импортирует React, провайдеры сайта и тяжёлые модули шахмат", () => {
    for (const f of файлы) {
      const src = readFileSync(f, "utf8");
      for (const спец of импорты(src)) for (const з of ЗАПРЕЩЕНО) {
        const хвост = спец.split("/").pop() ?? спец;
        expect(спец === з || хвост === з || спец.endsWith("/" + з), `${f.slice(КОРЕНЬ.length)} импортирует ${спец}`).toBe(false);
      }
      // по импортам, не по тексту: слово «ClientProviders» законно живёт в комментарии-пояснении
      expect(импорты(src).some((s) => /ClientProviders|SiteHeader|AutoTranslate/.test(s))).toBe(false);
      expect(src).not.toMatch(/import\("\.\.\/page"\)|import\("\.\.\/\.\.\/page"\)|import\("@\/components\/ClientProviders"\)/);
    }
  });

  it(`храповик: исходники локальных импортов маршрута ≤ ${ПРЕДЕЛ_БАЙТ.toLocaleString("ru-RU")} байт`, () => {
    const видели = new Set<string>(); let сумма = 0;
    for (const f of файлы) for (const спец of импорты(readFileSync(f, "utf8"))) { const p = путьМодуля(f, спец); if (!p || видели.has(p)) continue; видели.add(p); сумма += statSync(p).size; }
    expect(видели.size, "знаменатель: модулей").toBeGreaterThan(3);
    expect(сумма, `сумма ${сумма} байт по ${видели.size} модулям`).toBeLessThanOrEqual(ПРЕДЕЛ_БАЙТ);
  });

  it("события воронки — те же, что у полной версии, с channel/post из ?c=", () => {
    const r = readFileSync(join(МАРШРУТ, "[id]/route.ts"), "utf8");
    for (const s of ['feature:"puzzle_link_open"', 'feature:"first_move"', 'type:"puzzle_solved"', 'source:"cyberchess/board"', 'type:"page_view",source:"cyberchess-p"', "channelFrom(c)", "postFrom(c)", "aevion_gtm_sid", "/api-backend/api/pricing/events"]) expect(r, s).toContain(s);
    expect(r).toContain('og:title');
    expect(r).toContain('data-hydrated');
  });

  it("язык по правилу 120: ?lang и кука старше Accept-Language; иное → en", () => {
    expect(yazykZaprosa(null, null, "ru-RU,ru;q=0.9")).toBe("ru");
    expect(yazykZaprosa("aevion_lang_v1=kk", null, "en-US")).toBe("kk");
    expect(yazykZaprosa("aevion_lang_v1=kk", "en", "ru-RU")).toBe("en");
    expect(yazykZaprosa(null, null, "de-DE,de;q=0.9")).toBe("en");
    expect(yazykZaprosa(null, null, null)).toBe("en");
  });
});
