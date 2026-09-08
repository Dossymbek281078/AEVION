import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Класс «атрибут против доводчика» (06.09.2026, живой замер прода):
 * машинный доводчик AutoTranslate переводит EN-визитёру видимый ТЕКСТ,
 * но НЕ атрибуты (placeholder/aria-label/title/alt). Итог до починки:
 * английская страница с русским «вы@почта.рф» ровно в поле контакта и
 * русским placeholder поля ИИ в IDE.
 *
 * Сторож держит ПУТЬ НОВИЧКА свободным от зашитых кириллических атрибутов:
 * витрина, посадочная запуска, подключение покупки. IDE целиком сюда
 * НАМЕРЕННО не входит — его глубокие панели ждут решения о полном словаре;
 * путь новичка в IDE закрыт словарём GEN_UI, и это закрепляет отдельная
 * проверка ниже.
 */
const APP = path.join(__dirname, "..");
const NEWCOMER_FILES = ["page.tsx", "launch/page.tsx", "link/page.tsx", "examples.ts"];

// Атрибут с кириллицей в JSX: attr="…рус…" | attr={"…"} | attr={`…`}.
// Регулярка ЛИТЕРАЛОМ, не строкой — слэши в строках уже съедались (§11л).
const RU_ATTR = /(placeholder|aria-label|title|alt)=("[^"\n]*[а-яёА-ЯЁ][^"\n]*"|\{"[^"\n]*[а-яёА-ЯЁ][^"\n]*"\}|\{`[^`\n]*[а-яёА-ЯЁ][^`\n]*`\})/g;

// `title=` бывает и ПРОПОМ компонента (<Step title="…">) — тот текст рисуется
// как обычный и доводчик его кроет. Атрибутом браузера он становится только
// на строчном HTML-теге. Первый прогон сторожа выдал 4 ложные находки ровно
// на этом — различаем по регистру ближайшего открывающего тега.
function hardcodedRuAttrs(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(RU_ATTR)) {
    const before = src.slice(0, m.index);
    const tagMatch = before.match(/<([A-Za-z][A-Za-z0-9.]*)[^<]*$/);
    const tag = tagMatch?.[1] ?? "";
    const isComponent = /^[A-Z]/.test(tag);
    if (isComponent && (m[1] === "title" || m[1] === "alt")) continue;
    out.push(`<${tag}> ${m[0].slice(0, 80)}`);
  }
  return out;
}

describe("атрибуты пути новичка не зашиты по-русски", () => {
  test("прибор работает: находит подсаженный русский атрибут и молчит о словарном и о пропе", () => {
    expect(hardcodedRuAttrs('<input placeholder="Опишите идею…" />').length, "прибор ослеп — сломан шаблон").toBe(1);
    expect(hardcodedRuAttrs('<input placeholder={GL.ph} aria-label={t("hero.ideaAria")} />').length, "прибор клевещет на словарные атрибуты").toBe(0);
    expect(hardcodedRuAttrs('<Step title="Проект собирается" note="x" />').length, "прибор клевещет на проп компонента").toBe(0);
    expect(hardcodedRuAttrs('<input title="Подсказка по-русски" />').length, "title на HTML-теге — настоящий атрибут, обязан ловиться").toBe(1);
  });

  for (const rel of NEWCOMER_FILES) {
    test(`${rel}: ноль зашитых кириллических атрибутов`, () => {
      const src = fs.readFileSync(path.join(APP, rel), "utf8");
      expect(hardcodedRuAttrs(src), "зашитый русский атрибут — EN-визитёр увидит его как есть, доводчик атрибуты не переводит").toEqual([]);
    });
  }

  test("IDE: busy-ярлыки кнопок не зашиты строками (класс «текст быстрее доводчика»)", () => {
    // Ярлык занятости меняется по состоянию — машинный доводчик не успевает
    // ПО УСТРОЙСТВУ. 07.09 таких было 7, вперемешку ru/en; все уведены в
    // GEN_UI busy*. Сторож ловит регрессию: тернарный ярлык с многоточием,
    // зашитый строкой (любого языка), а не через GL.
    const ide = fs.readFileSync(path.join(APP, "[id]", "page.tsx"), "utf8");
    const re = /\{\w+ \? "[^"]{2,40}(…|\.\.\.)"/g;
    // Прибор в обе стороны:
    expect([...('{busy ? "Готовлю…"'.matchAll(re))].length, "прибор ослеп").toBe(1);
    expect([...('{busy ? GL.busyGen'.matchAll(re))].length, "прибор клевещет на словарь").toBe(0);
    const hits = [...ide.matchAll(re)].map((m) => m[0]);
    expect(hits, "зашитый busy-ярлык — EN-визитёр увидит его в момент действия").toEqual([]);
  });

  test("IDE: заметки о ходе генерации — из словаря, и обрыв отличается от дозагрузки", () => {
    const ide = fs.readFileSync(path.join(APP, "[id]", "page.tsx"), "utf8");
    // 08.09.2026: заметки в чате были зашиты по-английски, а главное — оба
    // исхода обрыва печатались одной фразой «недостающие файлы дозагружены».
    // При НЕУДАЧНОМ дозапросе человеку сообщался результат, которого не было,
    // поверх обрезанного набора файлов. Сообщение об успехе хуже молчания:
    // получив его, человек не идёт проверять.
    expect(ide, "исход обрыва снова не отличается от дозагрузки").toContain("if (data.truncated)");
    expect(ide).toContain("GL.noteTruncated");
    expect(ide).toContain("GL.noteContinued");
    // Запрещаем ПРИСВОЕНИЕ литерала, а не наличие текста: сами фразы живут в
    // английской ветке словаря, и там им место. Первая редакция сторожа искала
    // фразу где угодно и краснела на собственном переводе.
    for (const зашито of [
      'note = "Reply hit',
      'note = "No AI provider',
      'note = `Syntax check failed',
    ]) {
      expect(ide.includes(зашито), `заметка снова присваивается строкой: ${зашито}`).toBe(false);
    }
  });

  test("IDE: поле ИИ-промпта берёт placeholder из словаря GEN_UI", () => {
    const ide = fs.readFileSync(path.join(APP, "[id]", "page.tsx"), "utf8");
    // Связка явная: словарь существует и им пользуется именно placeholder.
    expect(ide, "словарь GEN_UI исчез").toContain("const GEN_UI");
    expect(ide, "placeholder поля ИИ больше не словарный").toContain("placeholder={GL.ph}");
  });
});
