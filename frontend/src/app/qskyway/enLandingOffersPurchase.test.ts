import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Английская посадочная QSkyway предлагает купить модуль, а не только
 * «посмотреть тарифы».
 *
 * До 14.09.2026 на /en/qskyway не было ни цены, ни кнопки покупки: человек из
 * англоязычного канала видел питч и ссылку на общую страницу тарифов, где
 * QSkyway ещё надо найти. В приложении (/qskyway) чип покупки стоит с того же
 * дня — посадочная отставала.
 *
 * Проверка по исходнику, потому что страница серверная; что кнопка
 * действительно ведёт в кассу, проверяется кликом на проде
 * (aevion-buy-click.mjs /en/qskyway).
 */
const EN = path.join(__dirname, "..", "en", "qskyway", "page.tsx");

function stripBlockAndLineComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("/*", i)) {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
    } else if (src.startsWith("//", i) && src[i - 1] !== ":") {
      const end = src.indexOf(String.fromCharCode(10), i);
      i = end === -1 ? src.length : end;
    } else {
      out += src[i];
      i++;
    }
  }
  return out;
}

describe("/en/qskyway предлагает покупку", () => {
  const code = stripBlockAndLineComments(readFileSync(EN, "utf8"));

  it("на посадочной стоит чип покупки именно этого модуля", () => {
    expect(code).toContain('import ModulePricingChip from "@/components/ModulePricingChip"');
    expect(code).toMatch(/<ModulePricingChip\s+moduleId="qskyway"/);
  });

  it("контроль: упоминание в комментарии не считается", () => {
    const onlyComment = '/* <ModulePricingChip moduleId="qskyway" /> */ const x = 1;';
    expect(stripBlockAndLineComments(onlyComment)).not.toMatch(/<ModulePricingChip\s+moduleId="qskyway"/);
  });
});
