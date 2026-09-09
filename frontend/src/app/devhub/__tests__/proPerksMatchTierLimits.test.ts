import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Числа, которыми продаётся Studio Pro, обязаны совпадать с пределами, по
 * которым стоит ограничитель.
 *
 * Строка `pro.perks` («50 видео с ИИ · 200 картинок · …») живёт в словаре
 * витрины, а пределы — в `TIER_LIMITS` на бэкенде. Это разные файлы, разные
 * репозитории в голове и разные люди. 27.08.2026 такая же копия уже нашлась
 * ВНУТРИ бэкенда (ручка отдавала клиенту литеральный дубль таблицы) — здесь
 * третья.
 *
 * Правильная починка — подставлять числа из ручки состояния тарифа, и она
 * стоит больше одной правки: строку надо развести на три языка с подстановкой.
 * До тех пор сторож держит хотя бы совпадение: цену меняют редко, а разойтись
 * молча она может при первой же правке.
 *
 * Почему это важнее, чем кажется: расхождение здесь не падает и не пишется в
 * журнал. Человек покупает за $149 «50 видео», упирается в 30 и считает, что
 * у нас не работает.
 */

const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..", "..");
const DICT = path.join(__dirname, "..", "i18n.ts");
const BACKEND = path.join(REPO_ROOT, "aevion-globus-backend", "src", "routes", "devhub.ts");
const STUDIO = path.join(__dirname, "..", "..", "studio", "page.tsx");

/** Пределы тарифа pro, прочитанные из объявления на бэкенде. */
function backendProLimits(): { video: number; image: number } {
  const src = fs.readFileSync(BACKEND, "utf8");
  const m = src.match(/pro:\s*\{\s*video:\s*(-?\d+),\s*image:\s*(-?\d+)/);
  if (!m) throw new Error("не найдено объявление пределов тарифа pro на бэкенде");
  return { video: Number(m[1]), image: Number(m[2]) };
}

/** Все переводы строки, которой продаётся тариф. */
function perkStrings(): string[] {
  const src = fs.readFileSync(DICT, "utf8");
  const found = [...src.matchAll(/"pro\.perks":\s*"([^"]*)"/g)].map((m) => m[1]);
  return found;
}

describe("продаваемые числа совпадают с пределами", () => {
  test("прибор работает: оба файла прочитаны, объявления найдены", () => {
    const limits = backendProLimits();
    expect(limits.video).toBeGreaterThan(0);
    expect(limits.image).toBeGreaterThan(0);
    // Языков в словаре три; если строка исчезнет из всех, проверка ниже станет
    // пустой и «пройдёт» — поэтому наличие проверяется отдельно.
    expect(perkStrings().length).toBeGreaterThanOrEqual(3);
  });

  test("каждая языковая версия называет те же числа", () => {
    const { video, image } = backendProLimits();
    for (const s of perkStrings()) {
      const numbers = [...s.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
      expect(
        numbers,
        `строка тарифа обещает не те числа, что сдерживает ограничитель (${video}/${image}): ${s}`,
      ).toContain(video);
      expect(numbers).toContain(image);
    }
  });
});


/**
 * РАСШИРЕНИЕ ОХВАТА 08.09.2026. Сторож выше сверял ОДНУ строку витрины и только
 * два числа из неё — видео и картинки. Слепая зона нашлась там, где дороже
 * всего: карточки тарифов на /studio, то самое место, где человек выбирает,
 * платить ли $149. Замер против TIER_LIMITS:
 *
 *     Free: «100k TTS chars»  предел 10 000   переобещание ВДЕСЯТЕРО
 *     Pro:  «30k TTS chars»   предел 200 000  платный выглядел ВТРОЕ ХУЖЕ Free
 *
 * Второе хуже первого не по цене ошибки, а по последствию: человек сравнивает
 * две карточки рядом и видит, что за $149 озвучки дают меньше, чем даром.
 * Ни один сторож этого не видел, потому что охват был описан списком «видео и
 * картинки», а не вопросом «все ли числа карточек сверены».
 */
function backendTierLimits(): Record<string, Record<string, number>> {
  const src = fs.readFileSync(BACKEND, "utf8");
  const out: Record<string, Record<string, number>> = {};
  for (const tier of ["free", "pro"]) {
    const line = src.split(String.fromCharCode(10)).find((l) => l.trim().startsWith(tier + ":"));
    if (!line) throw new Error("не найдены пределы тарифа " + tier);
    const limits: Record<string, number> = {};
    for (const m of line.matchAll(/(\w+):\s*(-?\d+)/g)) limits[m[1]] = Number(m[2]);
    out[tier] = limits;
  }
  return out;
}

/** Числа из карточки тарифа на /studio: «50 videos / month», «200k TTS chars». */
function studioCardNumbers(tier: "Free" | "Pro"): Record<string, number> {
  const src = fs.readFileSync(STUDIO, "utf8");
  const at = src.indexOf(`tier: "${tier}"`);
  if (at < 0) throw new Error("карточка тарифа " + tier + " не найдена");
  const from = src.indexOf("features: [", at);
  const to = src.indexOf("]", from);
  if (from < 0 || to < 0) throw new Error("список возможностей карточки " + tier + " не разобран");
  const block = src.slice(from, to);
  const nums: Record<string, number> = {};
  const grab = (re: RegExp, key: string, mult = 1) => {
    const m = block.match(re);
    if (m) nums[key] = Number(m[1]) * mult;
  };
  grab(/"(\d+) videos/, "video");
  grab(/"(\d+) images/, "image");
  grab(/"(\d+)k TTS/, "tts", 1000);
  grab(/"(\d+) music/, "music");
  grab(/"(\d+) deploys/, "deploy");
  if (/Unlimited deploys/.test(block)) nums.deploy = -1;
  return nums;
}

describe("карточки тарифов на /studio сверены с пределами", () => {
  test("прибор работает: числа из карточек разобраны", () => {
    const free = studioCardNumbers("Free");
    const pro = studioCardNumbers("Pro");
    // Контроль: если разбор сломается, тесты ниже пройдут на пустоте.
    expect(Object.keys(free).length, "из карточки Free не разобрано ни одного числа").toBeGreaterThanOrEqual(5);
    expect(Object.keys(pro).length, "из карточки Pro не разобрано ни одного числа").toBeGreaterThanOrEqual(5);
  });

  for (const tier of ["Free", "Pro"] as const) {
    test(`${tier}: каждое число карточки совпадает с пределом`, () => {
      const limits = backendTierLimits()[tier.toLowerCase()];
      const card = studioCardNumbers(tier);
      for (const [key, value] of Object.entries(card)) {
        expect(value, `${tier}: карточка обещает ${key}=${value}, предел ${limits[key]}`).toBe(limits[key]);
      }
    });
  }

  test("платный тариф не выглядит хуже бесплатного ни по одному числу", () => {
    // Отдельная проверка, потому что она ловит ДРУГОЕ: даже если обе карточки
    // разойдутся с пределами согласованно, «за деньги меньше, чем даром» —
    // самостоятельный дефект продажи.
    const free = studioCardNumbers("Free");
    const pro = studioCardNumbers("Pro");
    for (const [key, freeValue] of Object.entries(free)) {
      const proValue = pro[key];
      if (proValue === undefined) continue;
      const proBetter = proValue === -1 || (freeValue !== -1 && proValue >= freeValue);
      expect(proBetter, `${key}: Free даёт ${freeValue}, Pro — ${proValue}`).toBe(true);
    }
  });
});
