import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * У каждой страницы воронки есть своя карточка для пересылки ссылки.
 *
 * ЗАЧЕМ. Замер на проде 28.08.2026: у русских `/go` и `/longevity` карточка
 * генерировалась, а у английских `og:image` не было ВОВСЕ — я создал страницы
 * и забыл про `opengraph-image.tsx`. Пересланная ссылка приходила без
 * картинки, а для трафика из роликов это заметная потеря: в ленте мессенджера
 * карточка без изображения почти не кликается.
 *
 * Дефект тихий: страница открывается, тесты зелёные, ничего не падает. Видно
 * его только в чужом мессенджере — то есть уже после того, как ссылку
 * разослали.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

/** Страницы, на которые ведут ролики и внешние ссылки. Список ведётся руками:
 *  он и есть утверждение о том, что мы считаем входом в воронку. */
const FUNNEL = ["go", "longevity", "en/go", "en/longevity", "shop", "constitution/pricing", "qsign", "compare", "partner", "qrenew", "qventure", "qlearn", "bank", "qnews", "qai", "studio", "explore", "sdk"];

describe("карточки страниц воронки", () => {
  it("у каждой входной страницы есть opengraph-image", () => {
    for (const route of FUNNEL) {
      const file = join(APP, ...route.split("/"), "opengraph-image.tsx");
      expect(existsSync(file), `/${route}: нет opengraph-image.tsx — ссылка придёт без картинки`)
        .toBe(true);
    }
  });

  it("карточка объявляет размер и тип, иначе Next её не отдаст", () => {
    for (const route of FUNNEL) {
      const src = readFileSync(join(APP, ...route.split("/"), "opengraph-image.tsx"), "utf8");
      expect(src, `/${route}: нет size`).toMatch(/export const size/);
      expect(src, `/${route}: нет contentType`).toMatch(/export const contentType/);
      expect(src, `/${route}: нет alt`).toMatch(/export const alt/);
    }
  });

  it("английские карточки написаны по-английски", () => {
    // Обратный контроль: файл может существовать и при этом нести русский
    // текст, скопированный с русской страницы. Для англоязычного читателя это
    // хуже отсутствующей картинки — он видит незнакомый алфавит.
    for (const route of ["en/go", "en/longevity"]) {
      const src = readFileSync(join(APP, ...route.split("/"), "opengraph-image.tsx"), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
      const cyr = (src.match(/[а-яА-ЯёЁ]/g) || []).length;
      expect(cyr, `/${route}: в карточке ${cyr} русских букв`).toBe(0);
    }
  });

  it("у коротких адресов карточки НЕТ — они только перенаправляют", () => {
    // Иначе они начнут соревноваться в выдаче с той страницей, на которую ведут.
    for (const route of ["tt", "ig", "yt", "en/tt", "en/ig"]) {
      const file = join(APP, ...route.split("/"), "opengraph-image.tsx");
      expect(existsSync(file), `/${route}: у редиректа появилась карточка`).toBe(false);
    }
  });
});
