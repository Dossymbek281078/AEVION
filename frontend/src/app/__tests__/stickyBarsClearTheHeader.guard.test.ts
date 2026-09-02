import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Прилипающая полоса не должна уезжать ПОД шапку сайта.
 *
 * Шапка тоже sticky, top: 0, слой 50. Любая полоса с `top: 0` и меньшим слоем
 * прилипает в то же место и пропадает — ровно тогда, когда она нужна: при
 * прокрученной странице. Смысл прилипающей полосы в том и состоит, чтобы
 * оставаться под рукой.
 *
 * ЗАМЕР ЖИВОГО ПРОДА 28.08.2026 (зонд aevion-overlay-probe, 7 адресов):
 * 26 недостижимых элементов. Среди них не только вкладки: на четырёх модулях
 * под шапку уезжала кнопка «Купить» и строка цены — то есть денежный шаг
 * исчезал у человека, который долистал страницу и решил платить.
 *
 * Доказано с обеих сторон на одном сервере (1280x900, домотано до низа):
 *   с отступом  -> вкладки 16/16, top = высота шапки
 *   с `top: 0`  -> вкладки  0/16, top = 0, закрыты шапкой
 *
 * Высоту публикует SiteHeader через ResizeObserver: она зависит от ширины
 * (89px на десктопе, 185px на телефоне), поэтому число здесь не годится.
 */

const SRC = join(__dirname, "..", "..");

// Файлы, где прилипающая полоса уже отодвинута. Список — храповик: он не
// обязан покрыть всё, но однажды исправленное не должно вернуться.
const FIXED = [
  "app/qgood/page.tsx",
  "app/pricing/compare/page.tsx",
  "app/qpersona/page.tsx",
  "app/shadownet/page.tsx",
  "app/voice-of-earth/page.tsx",
  "app/deepsan/page.tsx",
  "app/kids-ai-content/page.tsx",
  "app/qcoreai/replay/[runId]/page.tsx",
  "components/../app/bank/_components/SectionTabs.tsx",
  // Здесь стиль задан КЛАССАМИ Tailwind (`sticky top-0 z-30`), поэтому
  // первый свип по строчным стилям его не увидел: один смысл, две записи.
  "app/qmaskcard/page.tsx",
  "app/qchaingov/page.tsx",
  "app/z-tide/page.tsx",
];

describe("прилипающие полосы стоят под шапкой, а не под ней", () => {
  // Счёт вынесен в функцию, чтобы его можно было позвать на ЗАВЕДОМОМ
  // образце. Без этого проверка однажды уже была пустой: в шаблоне `0x08 (сам байт сюда писать нельзя — он и есть предмет)`
  // из heredoc превратился в символ забоя (0x08), совпадений не стало
  // вовсе, и счётчик всегда давал ноль — сторож зеленел на сломанном коде.
  // Собственный контроль ловит это при КАЖДОМ прогоне, а не когда я
  // вспомню про мутацию.
  const countBare = (text: string): number => {
    const re = /className="([^"]*sticky[^"]*top-0[^"]*)"/g;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(text))) {
      if (!text.slice(Math.max(0, m.index - 140), m.index).includes("aevion-header-h")) n++;
    }
    return n;
  };

  it("счётчик умеет находить — иначе его ноль ничего не значит", () => {
    const плохой = `<header className="border-b sticky top-0 z-10">`;
    const хороший = `<header style={{ top: "var(--aevion-header-h, 0px)" }} className="border-b sticky top-0 z-10">`;
    expect(countBare(плохой), "счётчик ослеп: не видит даже заведомо плохую строку").toBe(1);
    expect(countBare(хороший), "счётчик считает исправное плохим").toBe(0);
  });

  it("в модуле smeta-trainer не осталось полос с голым top-0", () => {
    // 250 мест в 243 файлах: у всех была одна беда — sticky top-0 со слоем
    // ниже шапки. Дефект подтверждён браузером на четырёх страницах модуля
    // (навигация «← К разделам», «Развернуть всё» уходила под шапку).
    // Считаем ОСТАТОК: правка механическая, и пропуск здесь незаметен.
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const root = join(SRC, "app", "smeta-trainer");
    let bad = 0;
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!p.endsWith(".tsx")) continue;
        bad += countBare(readFileSync(p, "utf8"));
      }
    };
    walk(root);
    expect(bad, `${bad} полос снова прилипают к нулю — уедут под шапку`).toBe(0);
  });

  it("шапка публикует свою высоту — без этого отступать не на что", () => {
    const h = readFileSync(join(SRC, "components", "SiteHeader.tsx"), "utf8");
    expect(h, "SiteHeader перестал публиковать --aevion-header-h").toContain("--aevion-header-h");
    expect(h, "публикация без ResizeObserver сломается при переносе меню")
      .toContain("ResizeObserver");
  });

  for (const rel of FIXED) {
    it(`${rel}: полоса отодвинута на высоту шапки`, () => {
      const s = readFileSync(join(SRC, rel), "utf8");
      expect(s, `в ${rel} вернулся top: 0 — полоса снова уедет под шапку`)
        .toContain("var(--aevion-header-h");
    });
  }
});
