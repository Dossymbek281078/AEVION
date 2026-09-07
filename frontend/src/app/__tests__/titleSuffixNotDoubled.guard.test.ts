import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./helpers/sourceCode";

/**
 * Заголовок страницы не повторяет суффикс сайта.
 *
 * ЗАЧЕМ. Корневой layout задаёт `template: "%s · AEVION"`, то есть Next сам
 * дописывает суффикс к каждому заголовку. Страница, которая пишет его ещё и
 * у себя, отдаёт в выдачу «QPayNet — Embedded Payments · AEVION · AEVION».
 * Замер 07.09.2026 живым обходом прода: 30 адресов из 47, включая денежные
 * (/qcontract, /qpaynet, /constitution, /healthai, /startup-exchange,
 * /smeta-trainer). Google обрезает заголовок около 60 знаков — дубль съедал
 * девять из них у полезного текста, а на западном треке это первое, что
 * человек видит о продукте.
 *
 * ГРАНИЦА. Сторож судит по ИСХОДНИКУ и знает только про заголовок, к
 * которому применяется шаблон: `title: "…"` и `title: { default: "…" }`.
 * Он НЕ трогает `title: { absolute: … }` (там шаблон не применяется и хвост
 * законен) и НЕ трогает openGraph/twitter — у них своего шаблона нет, бренд
 * в них уместен. Полноту проверяет живой обход, а не этот файл.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

/** Суффикс берём из корневого layout, а не своей копией: правило и проверка
 *  обязаны ссылаться на один источник, иначе мутация шаблона переживёт тест. */
function suffixFromRootTemplate(): string {
  const root = stripComments(readFileSync(join(APP, "layout.tsx"), "utf8"));
  const i = root.indexOf("template:");
  expect(i, "в корневом layout нет template — проверять нечего").toBeGreaterThan(-1);
  const q = root.indexOf('"', i);
  const tpl = root.slice(q + 1, root.indexOf('"', q + 1));
  expect(tpl.startsWith("%s"), `неожиданный шаблон заголовка: ${tpl}`).toBe(true);
  return tpl.slice(2).trim(); // "· AEVION" → бренд с разделителем отдельно
}

function collect(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e !== "node_modules" && e !== "__tests__") collect(p, out);
    } else if (e === "layout.tsx" || e === "page.tsx") {
      out.push(p);
    }
  }
  return out;
}

/** Заголовок, к которому Next применит шаблон, либо null. */
function templatedTitle(src: string): string | null {
  const clean = stripComments(src);
  if (!/export const metadata/.test(clean)) return null;
  const i = clean.indexOf("title:");
  if (i < 0) return null;
  const rest = clean.slice(i + "title:".length);
  // объектная форма: интересует только default (absolute — вне шаблона)
  if (rest.trimStart().startsWith("{")) {
    const d = rest.indexOf("default:");
    const a = rest.indexOf("absolute:");
    if (d < 0 || (a >= 0 && a < d)) return null;
    const q = rest.indexOf('"', d);
    return q < 0 ? null : rest.slice(q + 1, rest.indexOf('"', q + 1));
  }
  const q = rest.search(/["`]/);
  if (q < 0) return null;
  const quote = rest[q];
  const end = rest.indexOf(quote, q + 1);
  return end < 0 ? null : rest.slice(q + 1, end);
}

describe("заголовок страницы не дублирует суффикс сайта", () => {
  const brand = suffixFromRootTemplate().replace(/^[^\p{L}]+/u, ""); // "AEVION"
  const files = collect(APP).filter((f) => f !== join(APP, "layout.tsx"));

  it("шаблон корневого layout прочитан, страницы найдены", () => {
    expect(brand).toBe("AEVION");
    // контроль охвата: обход обязан видеть заметную часть дерева, иначе
    // зелёный цвет означал бы «ничего не проверено»
    expect(files.length).toBeGreaterThan(200);
  });

  it("ни один шаблонный заголовок не оканчивается брендом", () => {
    const bad: string[] = [];
    for (const f of files) {
      const title = templatedTitle(readFileSync(f, "utf8"));
      if (!title) continue;
      const tail = title.trimEnd();
      if (!tail.endsWith(brand)) continue;
      // бренд как последнее слово фразы тоже даёт «… AEVION · AEVION»
      bad.push(`${relative(APP, f)} → "${tail.slice(-42)}"`);
    }
    expect(bad, `заголовки с хвостом «${brand}» (шаблон добавит второй):\n${bad.join("\n")}`)
      .toEqual([]);
  });
});
