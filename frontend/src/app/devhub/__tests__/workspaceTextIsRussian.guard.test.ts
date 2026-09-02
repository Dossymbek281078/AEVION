import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Текст МЕЖДУ ТЕГАМИ в рабочем окне — по-русски.
 *
 * 28.08.2026 утром я перевёл 72 сообщения и счёл язык закрытым. Это были
 * всплывающие УВЕДОМЛЕНИЯ; подписи, кнопки и состояния остались английскими, и
 * нашлись только вечером, свипом другого класса. Замер тогда: 62 строки, среди
 * них «Loading project…», «Project not found.» и кнопки Create/Cancel.
 *
 * Переведено 54. Оставшиеся восемь названы поимённо ниже — переводить их нельзя
 * или бессмысленно.
 */

const SRC = fs.readFileSync(path.resolve(__dirname, "..", "[id]", "page.tsx"), "utf8");

/** Осознанно НЕ переводится, с причиной у каждой строки. */
const KEEP: Record<string, string> = {
  "Cloudflare Pages": "название сервиса",
  "Studio Pro": "название продукта",
  "README.ru.md": "имя файла",
  "HTML body": "термин разметки: body — имя тега",
};

// Подпись живёт не только между тегами. Поле объявляется человеку подсказкой,
// названием для читалки и всплывающим текстом — и всё это сторож не читал.
// Замер 02.09.2026: четыре языковых сторожа модуля были ЗЕЛЁНЫМИ, пока 23
// английских атрибута жили на экране. Нашлось не ими, а обходом доступности.
const ATRIBUTY = ["placeholder", "aria-label", "title", "alt"];

// Латиница по природе: пути, адреса почты, домены, марка, имена переменных
// и идентификаторы. Их «перевод» сделал бы интерфейс ХУЖЕ, а не лучше.
// Правило поэтому строже, чем для подписей: «нет кириллицы» одно даёт
// ложное срабатывание на числах-образцах и адресах.
const LATINICA_PO_PRIRODE = [
  "src/component.tsx", "KEY", "recipient@example.com", "welcome-v1",
  "noreply@aevion.app", "AEVION", "saveAs (path)", "myapp.example.com",
];

function znacheniyaAtributov(): string[] {
  const out: string[] = [];
  for (const at of ATRIBUTY) {
    const nachalo = at + '="';
    let i = 0;
    for (;;) {
      i = SRC.indexOf(nachalo, i);
      if (i < 0) break;
      const j = SRC.indexOf('"', i + nachalo.length);
      if (j < 0) break;
      out.push(SRC.slice(i + nachalo.length, j).trim());
      i = j + 1;
    }
  }
  return out;
}

function englishBetweenTags(): string[] {
  const CYR = /[а-яА-ЯёЁ]/;
  const LF = String.fromCharCode(10);
  const out: string[] = [];
  for (const raw of SRC.split(LF)) {
    const line = raw.trim();
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) continue;
    // Позиционный разбор: `>Текст<`. Регулярку из строки здесь не собираем —
    // на этой машине она теряет слэши и молча находит ноль.
    let from = 0;
    for (;;) {
      const a = raw.indexOf(">", from);
      if (a < 0) break;
      const b = raw.indexOf("<", a + 1);
      if (b < 0) break;
      const t = raw.slice(a + 1, b).trim();
      from = b;
      if (t.length < 6 || t.length > 46) continue;
      if (!/^[A-Z]/.test(t)) continue;
      // Цифры добавлены 29.08.2026. Без них шаблон не видел НИ ОДНОЙ
      // подписи с числом: «Download MP3» жила в интерфейсе, а сторож
      // был зелёным — не потому, что разрешил её, а потому что не мог
      // разглядеть. В списке разрешений её поэтому и нет.
      if (!/^[A-Za-z][A-Za-z0-9 ,.'\-]+$/.test(t)) continue;
      if (CYR.test(t)) continue;
      out.push(t);
    }
  }
  return out;
}

/**
 * Второй проход: фраза, РАЗОРВАННАЯ выражениями JSX.
 *
 * Проверка выше ищет целое `>текст<` на одной строке. Карточка публикации
 * была написана иначе:
 *
 *   Ready to go live? One click deploys this to Cloudflare{works
 *     ? <> with your own <span>*.aevion.build</span> URL</>
 *     : <> — you get a public <span>*.pages.dev</span> address</>}
 *
 * Целого `>текст<` тут нет ни на одной строке — и месяцами самая заметная
 * карточка модуля была английской при зелёном стороже.
 *
 * Здесь ищем иначе: подряд идущие английские слова в позиции ТЕКСТА, то есть
 * вне фигурных скобок и вне кавычек. Три слова подряд — уже фраза.
 */
function englishRunsInJsxText(): string[] {
  // Ищем ТОЛЬКО внутри фрагментов <> ... </>. Именно так пишут фразу,
  // разорванную условием, и именно там она невидима для проверки выше.
  //
  // Первая версия вырезала фигурные скобки и смотрела всё подряд — и
  // ловила КОД: скобки в JSX многострочные, на строке-продолжении разбор
  // считает код текстом. Двенадцать ложных находок из двенадцати.
  const out: string[] = [];
  const LF = String.fromCharCode(10);
  for (const raw of SRC.split(LF)) {
    const line = raw.trim();
    if (line.startsWith("//") || line.startsWith("*")) continue;
    let from = 0;
    for (;;) {
      const open = raw.indexOf("<>", from);
      if (open < 0) break;
      const close = raw.indexOf("</>", open);
      const seg = close < 0 ? raw.slice(open + 2) : raw.slice(open + 2, close);
      from = close < 0 ? raw.length : close + 3;
      // Внутри фрагмента берём только текст вне тегов.
      const text = seg.replace(/<[^>]*>/g, " ");
      if (/[а-яА-ЯёЁ]/.test(text)) continue;
      const words = text.split(/[^A-Za-z]+/).filter((w) => w.length > 2);
      if (words.length >= 3) out.push(text.trim().slice(0, 60));
    }
  }
  return out;
}

describe("рабочее окно говорит по-русски", () => {
  test("прибор исправен: разбор находит хоть что-то", () => {
    // Если бы разбор возвращал пусто, проверка ниже была бы зелёной ни на чём.
    expect(englishBetweenTags().length + Object.keys(KEEP).length).toBeGreaterThan(5);
  });

  test("английских подписей не осталось, кроме названных", () => {
    const unexpected = englishBetweenTags().filter((t) => !(t in KEEP));
    expect(unexpected, "английская подпись в русском окне").toEqual([]);
  });

  test("у каждого исключения есть причина", () => {
    // Список без причин через месяц становится местом, куда дописывают, чтобы
    // сторож замолчал.
    for (const [k, why] of Object.entries(KEEP)) {
      expect(why.length, `исключение «${k}» без причины`).toBeGreaterThan(8);
    }
  });

  test("нет английских фраз, разорванных выражениями JSX", () => {
    const runs = englishRunsInJsxText();
    // Разрешено с причинами — как и в списке выше.
    const OK = [
      "aevion.app",
    ];
    const bad = runs.filter((r) => !OK.some((k) => r.includes(k)));
    expect(bad, "английская фраза в интерфейсе, собранная из кусков").toEqual([]);
  });

  test("подсказки и имена для читалки — на русском", () => {
    const vse = znacheniyaAtributov();
    // Контроль охвата: без него пустая выборка сделала бы проверку зелёной
    // на любом состоянии модуля — тот же ложный ноль, что и у соседних.
    expect(vse.length, "атрибутов не найдено — извлекатель сломан").toBeGreaterThan(20);
    const bad = vse.filter((v) => {
      if (!v || LATINICA_PO_PRIRODE.includes(v)) return false;
      if (v.startsWith("напр.: ")) return false; // пример промта для ИИ: обрамление русское
      return /[A-Za-z]/.test(v) && !/[А-ЯЁа-яё]/.test(v);
    });
    expect(bad, "английская подсказка на русском экране: она исчезает при вводе, и поле остаётся без имени").toEqual([]);
  });
});
