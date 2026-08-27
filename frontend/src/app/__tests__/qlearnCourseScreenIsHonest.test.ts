import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * Экран курса не выдаёт сбой за пустоту и не меняется до ответа сервера.
 *
 * Экран заведён 23.08.2026: до него открыть урок с сайта было НЕЛЬЗЯ вовсе —
 * сайт звал 8 ручек модуля из 25, а кнопка «продолжить» прокручивала страницу
 * к карточке курса. Модуль продаётся за $15/мес.
 *
 * Два класса, которые здесь легко вернуть одной правкой:
 *   · сбой загрузки превращается в пустой список — «в курсе нет уроков»
 *     выглядит законно, и человек уходит с оплаченного курса;
 *   · прогресс рисуется до ответа сервера — провал сохранения выглядит как
 *     сохранение.
 *
 * Проверка идёт по ПОРЯДКУ строк внутри функции, а не по наличию где-нибудь в
 * файле: `res.ok` встречается в нём много раз, и «есть в файле» ничего не
 * доказывает.
 */

const SRC = stripComments(
  readFileSync(join(__dirname, "..", "qlearn", "components", "CourseDetail.tsx"), "utf8"),
);
const PAGE = stripComments(readFileSync(join(__dirname, "..", "qlearn", "page.tsx"), "utf8"));
const VERIFY = stripComments(
  readFileSync(join(__dirname, "..", "qlearn", "verify", "page.tsx"), "utf8"),
);
const QUIZ = stripComments(
  readFileSync(join(__dirname, "..", "qlearn", "components", "LessonQuiz.tsx"), "utf8"),
);

/** Строки функции: от её объявления до следующего объявления того же уровня. */
function fnLines(src: string, decl: string): string[] {
  const all = src.split(String.fromCharCode(10));
  const start = all.findIndex((l) => l.includes(decl));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start; i < all.length; i++) {
    if (i > start && all[i].startsWith("  const ") && all[i].includes(" = ")) break;
    if (i > start && all[i].startsWith("function ")) break;
    out.push(all[i]);
  }
  return out;
}

describe("экран курса честен к сбоям", () => {
  test("контроль: файлы прочитаны и это те самые файлы", () => {
    expect(SRC.length).toBeGreaterThan(2000);
    expect(SRC).toContain("api/qlearn/courses/");
    expect(PAGE).toContain("CourseDetail");
  });

  test("страница действительно открывает экран курса", () => {
    // Кнопка «продолжить» раньше только прокручивала список.
    expect(PAGE, "экран курса не подключён к странице").toContain("openCourseId");
    expect(PAGE, "«продолжить» снова никуда не ведёт").toContain("setOpenCourseId(courseId)");
  });

  test.each([
    ["загрузка курса", "const load = useCallback"],
    ["чтение урока", "const readLesson = async"],
    ["отметка прогресса", "const markProgress = async"],
    ["добавление урока", "const addLesson = async"],
    ["генерация урока", "const generateLesson = async"],
  ])("%s смотрит на res.ok ДО того, как менять экран", (_name, decl) => {
    const lines = fnLines(SRC, decl);
    expect(lines.length, `не нашёл функцию ${decl}`).toBeGreaterThan(4);
    const okAt = lines.findIndex((l) => l.includes("if (!ok)"));
    const setAt = lines.findIndex(
      (l) =>
        l.includes("setCourse(") ||
        l.includes("setOpenLesson(") ||
        l.includes("setProgress(") ||
        l.includes("await load()") ||
        l.includes("setLessonTitle(\"\")"),
    );
    expect(okAt, "нет проверки ответа вовсе").toBeGreaterThanOrEqual(0);
    expect(setAt, "функция ничего не меняет на экране — тест смотрит не туда").toBeGreaterThanOrEqual(0);
    expect(okAt, "экран меняется раньше, чем прочитан ответ сервера").toBeLessThan(setAt);
  });

  test("сбой загрузки показывается текстом, а не пустым списком", () => {
    // Смотрим ВНУТРИ функции загрузки, а не «есть ли в файле»: setLoadError
    // встречается в ней ещё дважды (сброс в начале и сетевой сбой), поэтому
    // первая версия этой проверки оставалась зелёной, когда ветка !ok
    // подменялась на setLessons([]) — мутация проходила молча.
    const lines = fnLines(SRC, "const load = useCallback");
    const okAt = lines.findIndex((l) => l.includes("if (!ok)"));
    expect(okAt, "нет ветки отказа").toBeGreaterThanOrEqual(0);
    const branch = lines.slice(okAt, okAt + 6).join(String.fromCharCode(10));
    expect(branch, "отказ не превращается в текст для человека").toContain("setLoadError(");
    expect(branch, "отказ загрузки выдан за пустой курс").not.toContain("setLessons(");
    expect(SRC, "ошибка не выводится на экран").toContain("{loadError}");
    // Пустой список уроков — законный ответ (автор не добавил уроки), но он
    // показывается ТОЛЬКО когда загрузка прошла успешно.
    expect(SRC).toContain("Автор ещё не добавил уроки");
  });

  test("текст отказа берётся из ответа сервера, а не выдумывается", () => {
    // Бэкенд объясняет 503 полем warning; терять это объяснение нельзя.
    expect(SRC, "объяснение сервера не читается").toContain("data.warning");
  });

  test("автору видно, что курс без уроков пройти нельзя", () => {
    // Сайт умел создать курс, но НЕ умел добавить в него урок: каталог мог
    // быть только пустым, и мой же экран показывал бы «уроков нет» всегда.
    expect(SRC, "формы добавления урока нет").toContain("api/qlearn/me/courses/");
    expect(SRC, "нет запуска генерации урока").toContain("ai-generate-lesson");
    expect(SRC, "инструменты автора показываются всем").toContain("isAuthor &&");
  });

  test("признак «сохранено только в памяти» доходит до автора", () => {
    // Бэкенд ставит storage:"memory", когда базы нет вовсе. Молча съесть это
    // значит пообещать сохранение, которого не будет после перезапуска.
    const lines = fnLines(SRC, "const addLesson = async");
    const joined = lines.join(String.fromCharCode(10));
    expect(joined, "признак хранилища не читается").toContain("data.storage");
    expect(joined, "объяснение не показывается автору").toContain("setAuthorNotice(");
  });

  test("тест к уроку: разбор показывается только после ответа сервера", () => {
    // Три ручки теста жили без единого вызывающего. Появившись на экране, они
    // приносят тот же класс: показать разбор до ответа значит выдать провал
    // проверки за проверку.
    const lines = QUIZ.split(String.fromCharCode(10));
    const start = lines.findIndex((l) => l.includes("const answer = async"));
    expect(start, "не нашёл обработчик ответа").toBeGreaterThanOrEqual(0);
    const body = lines.slice(start, start + 40);
    const okAt = body.findIndex((l) => l.includes("if (!ok)"));
    const setAt = body.findIndex((l) => l.includes("setVerdicts("));
    expect(okAt, "ответ сервера не проверяется").toBeGreaterThanOrEqual(0);
    expect(setAt, "разбор нигде не показывается — тест смотрит не туда").toBeGreaterThanOrEqual(0);
    expect(okAt, "разбор показан раньше, чем прочитан ответ").toBeLessThan(setAt);
  });

  test("правильный ответ не приходит учащемуся и не выдумывается на экране", () => {
    // Сервер вырезает correctIndex всем, кроме автора. Экран не имеет права
    // подставлять своё значение: тогда подсказка вернулась бы с другой стороны.
    expect(QUIZ, "correctIndex объявлен обязательным — значит его ждут всегда")
      .toContain("correctIndex?: number");
    expect(QUIZ, "экран рисует правильный вариант не из вердикта сервера")
      .not.toContain("item.correctIndex");
  });

  test("сбой загрузки теста не выдаётся за «вопросов нет»", () => {
    const lines = QUIZ.split(String.fromCharCode(10));
    const start = lines.findIndex((l) => l.includes("const load = useCallback"));
    const body = lines.slice(start, start + 30);
    const okAt = body.findIndex((l) => l.includes("if (!ok)"));
    const branch = body.slice(okAt, okAt + 6).join(String.fromCharCode(10));
    expect(branch, "отказ не превращается в текст").toContain("setLoadError(");
    expect(branch, "отказ выдан за пустой тест").not.toContain("setQuestions(");
    expect(QUIZ).toContain("К уроку пока нет вопросов");
  });

  test("проверка сертификата не называет сбой подделкой", () => {
    // «Недействителен» и «проверить не удалось» — разные ответы. Назвать сбой
    // хранилища подделкой значит оболгать человека с настоящим сертификатом,
    // и заметить это будет некому: он просто не получит работу.
    const lines = VERIFY.split(String.fromCharCode(10));
    const start = lines.findIndex((l) => l.includes("const check = async"));
    expect(start, "не нашёл обработчик проверки").toBeGreaterThanOrEqual(0);
    const body = lines.slice(start, start + 45);
    const okAt = body.findIndex((l) => l.includes("if (!res.ok)"));
    const setAt = body.findIndex((l) => l.includes("setVerdict({"));
    expect(okAt, "ответ сервера не проверяется").toBeGreaterThanOrEqual(0);
    expect(setAt, "вердикт нигде не выставляется").toBeGreaterThanOrEqual(0);
    expect(okAt, "вердикт выставлен раньше, чем прочитан ответ").toBeLessThan(setAt);
    const branch = body.slice(okAt, okAt + 8).join(String.fromCharCode(10));
    expect(branch, "сбой выдан за отрицательный вердикт").not.toContain("setVerdict({");
  });

  test("проверка не показывает постороннему внутренний идентификатор владельца", () => {
    // Ручка отдаёт userId. Проверяющему он не нужен ни для чего, а утечка
    // внутренних идентификаторов бесплатной не бывает.
    expect(VERIFY, "внутренний идентификатор владельца попал на экран").not.toContain("userId");
  });

  test("номер сертификата уходит в адрес закодированным", () => {
    // Номер приходит из чужих рук: в нём может оказаться что угодно.
    expect(VERIFY).toContain("encodeURIComponent(");
  });
});
