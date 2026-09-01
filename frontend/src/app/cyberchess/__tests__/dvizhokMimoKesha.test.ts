import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * 🟢 Движок шахмат ломал НАШ ЖЕ service worker.
 *
 * A/B на одной странице, 31.08.2026:
 *   service worker разрешён    → «worker sent an unknown command undefined», движок мёртв
 *   service worker заблокирован → uciok, 19 сообщений, движок играет
 *
 * Сборка движка порождает дочерние воркеры из того же адреса; скрипт, отданный
 * из кэша, рвёт эту цепочку. Обе части при этом исправны — дефект жил в стыке.
 *
 * Здесь закрепляется, что файлы движка идут МИМО кэша. Проверяю правило на
 * настоящих путях, а не наличие строки: важно поведение, а не запись.
 */

const SW = () => readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

/** Достаём правило из sw.js и применяем к настоящим путям. */
function pravilo(): (put: string) => boolean {
  const s = SW();
  const i = s.indexOf("function isEngineAsset(url) {");
  expect(i).toBeGreaterThan(0);
  const konec = s.indexOf("\n}", i);
  const telo = s.slice(i, konec + 2);
  // eslint-disable-next-line no-new-func
  const f = new Function("url", telo + "\nreturn isEngineAsset(url);") as (u: { pathname: string }) => boolean;
  return (put: string) => f({ pathname: put });
}

describe("файлы движка не проходят через кэш", () => {
  it("правило есть и вызывается в обработчике запросов", () => {
    const s = SW();
    expect(s.length).toBeGreaterThan(1000); // контроль: файл прочитан
    expect(s).toContain("if (isEngineAsset(url)) return;");
    // Проверка стоит ДО кэширования статики, иначе не сработает.
    expect(s.indexOf("if (isEngineAsset(url)) return;")).toBeLessThan(s.indexOf("if (isStaticAsset(url))"));
  });

  it("движок — мимо кэша", () => {
    const p = pravilo();
    for (const put of ["/stockfish-18-lite.js", "/stockfish-18-lite.wasm", "/stockfish-classic.js", "/stockfish.js"]) {
      expect(p(put)).toBe(true);
    }
  });

  it("остальная статика кэшируется как прежде", () => {
    // Контроль в обратную сторону: правило, выключающее кэш целиком, тоже
    // «починило» бы движок — и лишило бы офлайна весь сайт.
    const p = pravilo();
    for (const put of ["/sw.js", "/_next/static/chunks/page.js", "/manifest.json", "/aev-icon-192.svg", "/api/health"]) {
      expect(p(put)).toBe(false);
    }
  });

  it("движок не попал и в предзагрузку при установке", () => {
    const s = SW();
    const i = s.indexOf("PRECACHE_URLS");
    const spisok = s.slice(i, s.indexOf("]", i));
    expect(spisok).not.toContain("stockfish");
  });
});
