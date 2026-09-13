import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Ключевые страницы не показывают имя платформы дважды.
 *
 * Корневой layout добавляет к каждому заголовку « · AEVION». Страница, у
 * которой имя уже стоит В САМОМ заголовке, получает его второй раз. Замер на
 * ЖИВОМ сайте 13.09.2026, выборка из 14 адресов: удвоение у **14 из 14**
 * (`/acquire`, `/agent`, `/api-explorer`, `/apps`, `/awards`, `/bank`, `/build`,
 * `/developers`, `/help`, `/modules`, `/press`, `/security`, `/shop`, `/planet`).
 * Контроль, что прибор различает: `/aev/tokenomics` в той же проверке НЕ удвоен.
 *
 * Лечение — `title: { absolute: … }`: шаблон к такому заголовку не применяется,
 * текст остаётся ровно тем, что задумали. Слова не переписывались.
 *
 * ⚠️ ГРАНИЦЫ, названные честно.
 *
 * 1. Здесь стерегутся только ДВЕНАДЦАТЬ ключевых страниц — восемь модулей волны
 *    20 сентября и главные входы (`/go`, `/apps`, `/modules`, `/shop`,
 *    `/pricing`). Остальной сайт этим сторожем НЕ покрыт.
 * 2. Полный масштаб измерен и составляет **173 файла-кандидата** по исходникам.
 *    В храповик они не занесены намеренно: список на 173 строки никто не читает,
 *    а сторож, который всегда красный, перестают открывать. Долг назван в отчёте
 *    основателю числом.
 * 3. Соседний сторож `titleSuffixNotDoubled.guard.test.ts` (07.09) ловит УЖЕ
 *    БОЛЕЕ УЗКИЙ случай — дословный хвост « · AEVION» в исходнике, и он зелёный.
 *    Наш случай шире: имя стоит в середине заголовка. Два сторожа на один класс
 *    заводить не стал — этот проверяет ровно то, чего тот не видит.
 */

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Страницы, где имя платформы стоит в самом заголовке и шаблон отключён. */
const KLYUCHEVYE = [
  "qright/layout.tsx",
  "bureau/layout.tsx",
  "devhub/layout.tsx",
  "qsign/layout.tsx",
  "bureau/launch/page.tsx",
  "devhub/launch/page.tsx",
  "multichat-engine/launch/page.tsx",
  "go/page.tsx",
  "apps/layout.tsx",
  "modules/page.tsx",
  "shop/page.tsx",
  "pricing/layout.tsx",
];

function metadataBlok(rel: string): string {
  const s = readFileSync(join(APP, rel), "utf8");
  // Метаданные бывают константой или функцией. Функция нужна там, где заголовок
  // зависит от времени (бюро: после дня запуска «обещали», а не «запуск»), и
  // правило «absolute с именем платформы» относится к ней точно так же.
  const konst = s.indexOf("export const metadata");
  const i = konst >= 0 ? konst : s.indexOf("export async function generateMetadata");
  expect(i, rel + ": в файле нет metadata — сторож смотрит не туда").toBeGreaterThan(0);
  const og = s.indexOf("openGraph", i);
  return og > i ? s.slice(i, og) : s.slice(i, i + 1400);
}

describe("ключевые заголовки не повторяют имя платформы", () => {
  it("контроль: корневой шаблон действительно дописывает суффикс", () => {
    const root = readFileSync(join(APP, "layout.tsx"), "utf8");
    expect(root, "шаблон исчез — правило потеряло предмет, проверьте заново").toContain(
      'template: "%s · AEVION"',
    );
  });

  for (const rel of KLYUCHEVYE) {
    it(rel + ": заголовок absolute, шаблон второй бренд не добавит", () => {
      const blok = metadataBlok(rel);
      const nachalo = blok.indexOf("title:");
      expect(nachalo, rel + ": в metadata нет title").toBeGreaterThan(-1);
      const okno = blok.slice(nachalo, nachalo + 200);
      expect(okno, rel + ": title снова строка — корневой шаблон удвоит имя")
        .toContain("absolute:");
      expect(okno, rel + ": в заголовке пропало имя платформы — тогда absolute не нужен")
        .toContain("AEVION");
    });
  }
});
