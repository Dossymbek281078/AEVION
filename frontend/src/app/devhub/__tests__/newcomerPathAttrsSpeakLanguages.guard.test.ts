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

  test("IDE: поле ИИ-промпта берёт placeholder из словаря GEN_UI", () => {
    const ide = fs.readFileSync(path.join(APP, "[id]", "page.tsx"), "utf8");
    // Связка явная: словарь существует и им пользуется именно placeholder.
    expect(ide, "словарь GEN_UI исчез").toContain("const GEN_UI");
    expect(ide, "placeholder поля ИИ больше не словарный").toContain("placeholder={GL.ph}");
  });
});
