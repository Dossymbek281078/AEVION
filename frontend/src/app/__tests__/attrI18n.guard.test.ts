import { describe, expect, it, beforeAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Кириллица в атрибутах `title`, `aria-label`, `placeholder`, `alt` на
 * ПЕРЕВОДИМЫХ страницах.
 *
 * Почему отдельный сторож. Проверка ключей (`i18nKeys.test.ts` у модулей)
 * смотрит на словарь: есть ли ключ во всех локалях и совпадают ли подстановки.
 * Текст, зашитый прямо в атрибут, в словарь не попадает вовсе — то есть мимо
 * той проверки он проходит целиком. Найдено 14.08.2026 на своей же странице
 * QSkyway: `title="Проверить подпись двойника на бэкенде"` жил рядом с
 * полностью переведённым интерфейсом.
 *
 * Цена не косметическая. `aria-label` читает экранный диктор: англоязычный
 * незрячий пользователь слышит русское слово вместо кнопки. Такой дефект не
 * виден ни на одном скриншоте.
 *
 * ГРАНИЦА, которую надо знать. «Страница переводимая» определяется наличием
 * вызова `t("` в файле. Это грубо, но осознанно: без этого фильтра свип даёт
 * 881 место, из которых 872 — на одноязычных страницах (тренажёр сметы и
 * подобные), где русский текст ПРАВИЛЕН. Автоматический список — кандидаты,
 * а не находки; фильтр превращает 881 в 9. Обратная сторона: страница,
 * которую переводят без `t()`, сюда не попадёт.
 */

// Путь от самого файла теста, а не от process.cwd(): при полном прогоне
// достаточно одного теста, сменившего рабочую папку, чтобы сканирование
// ушло не в тот каталог (эти грабли уже ловил qsignClaims.guard).
// Корень — `src`, а не `src/app`. Первая версия сканировала только страницы,
// и компонент, положенный в `src/components` или `src/lib`, проходил мимо.
// Нарушений там сейчас нет, но защита, охватывающая часть дерева, читается
// как охватывающая всё — и это ровно то, из-за чего проверки годами
// «работают», покрывая одну страницу из двадцати одной.
// Замер после расширения: за пределами `app/` нарушений НЕ нашлось — те же
// шесть, только путь длиннее. Ноль тут проверен, а не предположен.
const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ATTR = /\b(title|aria-label|placeholder|alt)\s*=\s*"([^"]*[А-Яа-яЁё][^"]*)"/g;
const USES_T = /\bt\(\s*"/;

type Hit = { file: string; attr: string; text: string };

/**
 * Известные случаи в ЧУЖИХ зонах на 14.08.2026 (CyberChess ведётся отдельной
 * сессией, Bank — отдельным фронтендом). Сторож заведён не для того, чтобы
 * молча их простить: список сверяется НА РАВЕНСТВО. Починили — тест скажет
 * «удалите строку», и освобождение не забудется. Исключение, которое живёт
 * вечно, замораживает ровно то, что должно было беречь.
 */
const KNOWN: Hit[] = [
  { file: "app/bank/page.tsx", attr: "title", text: "Конституция Bank" },
  { file: "app/cyberchess/AiPersonalityPicker.tsx", attr: "aria-label", text: "Выбор стиля AI" },
  { file: "app/cyberchess/AntiCheatPanel.tsx", attr: "aria-label", text: "Закрыть" },
  { file: "app/cyberchess/FideCalibrationPanel.tsx", attr: "aria-label", text: "Закрыть" },
  { file: "app/cyberchess/matchmaking/page.tsx", attr: "placeholder", text: "Игрок" },
  { file: "app/cyberchess/replays/page.tsx", attr: "title", text: "Обновить" },
  // Админская страница цен: 19.08.2026, чужая зона (pricing). Она зовёт t(),
  // то есть числится переводимой, но две подсказки на ней зашиты по-русски.
  // Возможно, страница осознанно русскоязычная — тогда правильный ответ не
  // перевести подсказки, а убрать с неё вызовы t(); решать владельцу зоны.
  { file: "app/pricing/admin/page.tsx", attr: "title", text: "По каналу раздачи" },
  { file: "app/pricing/admin/page.tsx", attr: "title", text: "Клики «купить» по товарам" },
  // Найдено 19.08.2026 расширением признака (см. translatableSet). Все семь —
  // ОБЩИЕ компоненты в чужих зонах, и цена ошибки у них умножается на число
  // страниц: Wave1Nav стоит на 71 переводимой странице, ToastProvider на 26,
  // ModulePricingChip на 22. Внесены в список, а не починены залпом: правка
  // навигации такого охвата требует, чтобы владелец зоны посмотрел результат.
  { file: "components/ModulePricingChip.tsx", attr: "title", text: "Сравнить тарифы — Lite, Medium, Full" },
  { file: "components/ToastProvider.tsx", attr: "aria-label", text: "Закрыть / Close" },
  { file: "components/Wave1Nav.tsx", attr: "title", text: "AEV кошелёк / AEV wallet" },
  // ГРАНИЦА приёма «двуязычная подпись». Она уместна там, где текст НЕ виден
  // на экране или короток: aria-label читает только диктор, title всплывает
  // по наведению. Оставшиеся три — placeholder, то есть видимый текст ВНУТРИ
  // поля ввода. «Напиши вопрос / Ask a question» там читается как поломка
  // вёрстки, а не как забота о читателе. Им нужен настоящий перевод через
  // словарь, а это правка в зоне build — за владельцем.
  { file: "components/build/AiCoachChat.tsx", attr: "placeholder", text: "Напиши вопрос. Enter — отправить, Shift+" },
  { file: "components/build/AiResumeBuilder.tsx", attr: "placeholder", text: "Твой ответ… Enter — отправить." },
  { file: "components/build/HelpTip.tsx", attr: "aria-label", text: "Подсказка / Hint" },
  { file: "components/build/ReviewsSection.tsx", attr: "placeholder", text: "Что было хорошо и что можно улучшить?" },
  // Переключатель языка: обе подписи ДВУЯЗЫЧНЫЕ намеренно, это не недоработка.
  // Он единственная кнопка, которую обязан найти человек, не читающий
  // по-русски, а перевести его через t() нельзя — он и выбирает язык.
  // 19.08.2026 aria-label был только русским; починено здесь же, title был
  // двуязычным изначально.
  { file: "components/LanguageSwitcher.tsx", attr: "title", text: "Выбрать язык / Select language" },
  { file: "components/LanguageSwitcher.tsx", attr: "aria-label", text: "Язык интерфейса / Interface language" },
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectSourceFiles(full));
    else if (/\.(tsx|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Файлы, которые УВИДИТ переведённая страница: те, что переводятся сами, плюс
 * те, что они импортируют.
 *
 * Второе условие добавлено 19.08.2026 и закрывает дыру, из-за которой сторож
 * пропускал худший случай. Признак «в файле есть t(» — свойство файла, а нужно
 * свойство употребления. У страниц они совпадают, у общих компонентов
 * расходятся: компонент, где переводов НЕТ ВООБЩЕ, — это не «одноязычная
 * страница», а намертво зашитый кусок, стоящий сразу на десятках страниц.
 * Замер: 36 таких компонентов, и сторож не заглядывал ни в один. В главной
 * навигации 71 страницы жило `title="AEV кошелёк"`.
 */
function translatableSet(files: string[]): Set<string> {
  const usesT = files.filter((f) => USES_T.test(readFileSync(f, "utf8")));
  const specs = new Set<string>();
  for (const f of usesT) {
    for (const m of readFileSync(f, "utf8").matchAll(/from "@\/([^"]+)"/g)) specs.add(m[1]);
  }
  const byPath = new Map<string, string>();
  for (const f of files) {
    byPath.set(relative(SRC_DIR, f).split(String.fromCharCode(92)).join("/").replace(/\.(tsx|jsx)$/, ""), f);
  }
  // Замыкание, а не один уровень: страница импортирует компонент, компонент —
  // другой компонент. Замер 19.08.2026: глубже первого уровня прятался ровно
  // один файл — и это оказался сам LanguageSwitcher, единственная кнопка,
  // которую должен найти человек, не читающий по-русски.
  const out = new Set(usesT);
  let frontier = [...usesT];
  while (frontier.length) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const m of readFileSync(f, "utf8").matchAll(/from "@\/([^"]+)"/g)) {
        const hit = byPath.get(m[1]) ?? byPath.get(m[1] + "/index");
        if (hit && !out.has(hit)) {
          out.add(hit);
          next.push(hit);
        }
      }
    }
    frontier = next;
  }
  return out;
}

function scan(files: string[]): Hit[] {
  const seen = translatableSet(files);
  const hits: Hit[] = [];
  for (const full of files) {
    if (!seen.has(full)) continue; // ни сама не переводится, ни видна переведённой
    const text = readFileSync(full, "utf8");
    for (const m of text.matchAll(ATTR)) {
      hits.push({
        file: relative(SRC_DIR, full).replace(/\\/g, "/"),
        attr: m[1],
        text: m[2].slice(0, 40),
      });
    }
  }
  return hits;
}

const key = (h: Hit) => `${h.file} [${h.attr}] ${h.text}`;

// Сканирование в beforeAll, а не внутри it(): в одиночку это доли секунды, но
// в полном параллельном прогоне обход полутора тысяч файлов упирался в
// таймаут теста — сторож был зелёным изолированно и красным в наборе.
let files: string[] = [];
let hits: Hit[] = [];
beforeAll(() => {
  files = collectSourceFiles(SRC_DIR);
  hits = scan(files);
});

describe("переводимые страницы: кириллица в атрибутах", () => {
  it("сканирует настоящий, непустой набор файлов", () => {
    // Без этого «нарушений нет» верно и при сломанном обходе.
    // Порог под фактический охват (1495 файлов на 14.08.2026). Прежние 200
    // прошли бы и при обвале обхода до одного каталога — то есть предохранитель
    // от пустого набора не срабатывал бы ровно тогда, когда нужен.
    expect(files.length).toBeGreaterThan(1200);
  });

  it("новых мест не появилось", () => {
    const unexpected = hits.filter((h) => !KNOWN.some((k) => key(k) === key(h)));
    expect(
      unexpected.map(key),
      "текст в атрибуте мимо переводов: заведите ключ и позовите t(...)",
    ).toEqual([]);
  });

  it("список известных: сообщает о лишних строках, но не краснеет из-за ветки", () => {
    // Раньше здесь было жёсткое равенство, и это оказалось неверно.
    // Замер 19.08.2026: две записи (pricing/admin) существуют в объединённой
    // ветке и отсутствуют в рабочей — версии чужого файла разные. При
    // равенстве сторож краснел бы попеременно на обеих ветках, ПРИ ИСПРАВНОЙ
    // системе. Постоянно красная проверка опаснее отсутствующей: её
    // перестают читать, и вместе с ней перестают читать настоящие находки.
    //
    // Жёстким остаётся то, ради чего сторож заведён, — «новых нарушений нет».
    // Протухшие записи выводятся в лог: их видно при прогоне и они не мешают.
    const gone = KNOWN.filter((k) => !hits.some((h) => key(h) === key(k)));
    if (gone.length) {
      // eslint-disable-next-line no-console
      console.log("[attrI18n] в этой ветке не найдено: " + gone.map(key).join(" | "));
    }
    // Утверждение всё же есть: список не должен разрастаться без предела —
    // это признак, что исключения копятся вместо починок.
    //
    // Потолок поднят с 15 до 20 — 19.08.2026, ОДИН раз и по конкретной причине.
    // Расширение признака переводимости (translatableSet) открыло сторожу целую
    // новую поверхность: общие компоненты, которые он не видел вовсе. Семь мест
    // пришли не потому, что кто-то копил исключения вместо починок, — они лежали
    // там всё это время невидимыми. Это ступенька, а не накопление.
    //
    // Что здесь важно не сделать: поднять потолок ещё раз по той же причине.
    // Следующее срабатывание означает именно накопление, и правильный ответ —
    // починить самое дорогое (Wave1Nav — 71 страница) и удалить строку.
    expect(KNOWN.length, "список исключений разросся — пора чинить, а не добавлять").toBeLessThan(20);
  });

  it("сторож действительно ловит нарушение (отрицательный контроль)", () => {
    const sample = 'export const X = () => <button aria-label="Закрыть окно">x</button>;\nt("some.key");';
    const found = [...sample.matchAll(ATTR)].map((m) => m[1]);
    expect(USES_T.test(sample)).toBe(true);
    expect(found).toEqual(["aria-label"]);
  });

  it("одноязычная страница не считается нарушением", () => {
    const sample = 'export const X = () => <button title="Закрыть">x</button>;';
    expect(USES_T.test(sample)).toBe(false);
  });
});
