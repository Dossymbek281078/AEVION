import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Карточка предпросмотра — первое, что видит человек, когда ссылку кидают в
 * мессенджер или в соцсеть. Замер на ЖИВОМ сайте 13.09.2026 по восьми модулям
 * волны запуска:
 *
 *   пять модулей  -> image/png с aevion.app            (как надо)
 *   /qright, /bureau -> image/svg+xml с СЫРОГО домена  aevion-production-*.up.railway.app
 *   /devhub       -> og:image НЕТ вовсе
 *
 * Оба отклонения тихие. SVG как og:image не рисует ни одна крупная площадка
 * (X, Facebook, WhatsApp, Slack, Discord, LinkedIn): скрапер молча показывает
 * голую ссылку — то есть «картинка есть» и «картинку видно» это разные
 * утверждения. Сырой домен провайдера вдобавок не наш: сменится — превью
 * уедет в никуда.
 *
 * Сторож проверяет ИСТОЧНИК карточки в коде, а не отрисовку: ходить в сеть из
 * набора нельзя, а прод отстаёт от ветки на дни. Живой ответ проверяется
 * отдельно, после выкатки.
 */

const APP = join(__dirname, "..");

/** Общий помощник карточек: 14 модулей объявляют формат через него, а не литералом. */
const POMOSCHNIK = readFileSync(join(APP, "..", "lib", "planningOg.tsx"), "utf8")
  .replace("planningOgContentType = ", "contentType = ");

/** Восемь модулей волны 20 сентября. CyberChess идёт 30-го и здесь не считается. */
const VOLNA = [
  "qright",
  "bureau",
  "devhub",
  "qsign",
  "multichat-engine",
  "startup-exchange",
  "qventure",
  "qskyway",
] as const;

function kartochka(mod: string): string | null {
  const p = join(APP, mod, "opengraph-image.tsx");
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

/**
 * Метаданные модуля живут либо в layout.tsx, либо в page.tsx (у qskyway — второе).
 * Спрашивать надо ТО место, где они объявлены, иначе сторож проверит пустоту.
 */
function metadannye(mod: string): string {
  for (const f of ["layout.tsx", "page.tsx"]) {
    const p = join(APP, mod, f);
    if (existsSync(p)) {
      const t = readFileSync(p, "utf8");
      if (t.includes("export const metadata")) return t;
    }
  }
  return "";
}

function maket(mod: string): string {
  const p = join(APP, mod, "layout.tsx");
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

/**
 * Макет с РАСКРЫТЫМИ переменными.
 *
 * Без этого сторож слеп ровно к той форме, которая у нас и была: в массиве
 * стояло `images: [{ url: OG_IMAGE …`, а `.svg` жил строкой выше, в
 * `const OG_IMAGE = ...`. Прежний общий сторож `ogImageIsRaster.guard.test.ts`
 * искал `.svg` ВНУТРИ массива и потому был зелёным, пока /qright и /bureau
 * месяцами отдавали SVG с чужого домена. Мой первый вариант повторил ту же
 * слепоту — поймал только литерал; поймала это мутация, воспроизводящая
 * настоящую форму, а не удобную.
 *
 * Раскрываем ОДИН уровень: каждое `const ИМЯ = <значение>` подставляем в текст
 * вместо имени. Глубже не идём намеренно — второй уровень у нас не встречался,
 * а правило, которое угадывает больше, чем видит, само становится источником
 * ложного спокойствия.
 */
function razvernutyjMaket(mod: string): string {
  const t = maket(mod);
  let out = t;
  const re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const [, imya, znachenie] = m;
    out = out.split(imya).join(znachenie);
  }
  return out;
}

describe("у каждого модуля волны своя PNG-карточка на нашем домене", () => {
  it("прибор работает: модули на месте, файлы читаются", () => {
    expect(VOLNA.length).toBe(8);
    const est = VOLNA.filter((m) => existsSync(join(APP, m)));
    expect(est.length, "каталоги модулей: " + est.join(", ")).toBe(8);
  });

  for (const mod of VOLNA) {
    it("модуль " + mod + ": карточка есть и она PNG", () => {
      const t = kartochka(mod);
      expect(t, "нет " + mod + "/opengraph-image.tsx — ссылка уйдёт без картинки").not.toBeNull();
      // Форм объявления две, и обе законны: литерал прямо в карточке либо
      // общий помощник planningOg (им пользуются 14 модулей). Проверяем СМЫСЛ:
      // в конце концов объявлен PNG 1200x630, а не просто «есть какая-то строка».
      const cherezPomoschnika = (t as string).includes("planningOgContentType");
      const objavlenie = cherezPomoschnika ? POMOSCHNIK : (t as string);
      expect(objavlenie, "карточка " + mod + " не объявлена как PNG").toContain(
        'contentType = "image/png"',
      );
      const razmer = cherezPomoschnika
        ? POMOSCHNIK.includes("planningOgSize = { width: 1200, height: 630 }")
        : (t as string).includes("size = { width: 1200, height: 630 }");
      expect(razmer, "карточка " + mod + " не 1200x630").toBe(true);
    });

    it("модуль " + mod + ": макет не перебивает карточку чужой ссылкой", () => {
      const m = razvernutyjMaket(mod);
      expect(m, "макет " + mod + " указывает og:image на .svg").not.toMatch(/images:[\s\S]{0,300}\.svg/);
      expect(m, "макет " + mod + " указывает og:image на сырой домен провайдера")
        .not.toMatch(/images:[\s\S]{0,300}(railway\.app|vercel\.app)/);
    });
  }
});

describe("подпись карточки на X — своя, а не корневая", () => {
  // Картинка и подпись — РАЗНЫЕ поля, и чинятся порознь. 13.09.2026 у /devhub и
  // /startup-exchange картинка уже стала своей, а блока twitter не было вовсе:
  // они наследовали корневой и подписывались «AEVION — Trust OS» вместо имени
  // модуля. Нашло соседнее окно зондом по живым страницам — сторож формы этого
  // не видел, потому что смотрел только на картинку.
  const KORNEVOJ = "AEVION — Trust OS";

  it("прибор работает: корневой макет действительно объявляет общую подпись", () => {
    const root = readFileSync(join(APP, "layout.tsx"), "utf8");
    expect(root, "корневой twitter исчез — проверьте, что сторож всё ещё про то").toContain(KORNEVOJ);
  });

  for (const mod of VOLNA) {
    it("модуль " + mod + ": свой блок twitter", () => {
      const m = metadannye(mod);
      expect(m.length, "у " + mod + " не найдены метаданные").toBeGreaterThan(100);
      expect(m, "у " + mod + " нет своего twitter — на X подпишется корневым именем")
        .toContain("twitter:");
      // Поиск ПОЗИЦИОННЫЙ, а не регуляркой. Первая редакция собирала regexp из
      // строки — `"[\s\S]"` в двойных кавычках JS превращается в `[sS]`, шаблон
      // перестаёт совпадать с чем-либо, и сторож зеленеет на сломанном коде.
      // Поймала мутация «подпись заменена корневой»: код 1, не поймана.
      const nachalo = m.indexOf("twitter:");
      const okno = nachalo >= 0 ? m.slice(nachalo, nachalo + 300) : "";
      expect(okno, "у " + mod + " в своей карточке стоит корневое имя платформы")
        .not.toContain(KORNEVOJ);
    });
  }
});
