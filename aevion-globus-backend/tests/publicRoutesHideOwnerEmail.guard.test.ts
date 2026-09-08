import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * Публичные ручки не отдают почту людей — ни списком, ни поштучно, ни файлом.
 *
 * 🔴 ЗАЧЕМ. Сплошной обход 484 публичных GET-адресов прода 08.09.2026 нашёл
 * ПЯТЬ поверхностей, отдающих чужие адреса анонимному запросу. Четыре из них
 * принадлежали посторонним людям, а не нам. Три двери вели к одним и тем же
 * данным реестра прав: список объектов, объект по идентификатору и выгрузка
 * CSV. Починка самой заметной выглядела как закрытие класса — а идентификаторы
 * объектов публичны, и адрес по-прежнему доставался по одному за запрос.
 *
 * Корень везде один: SELECT * и «поле есть, потому что его никто не убрал».
 * Со звёздочкой публичным становится каждый НОВЫЙ столбец таблицы — следующее
 * личное поле уедет наружу само, без единой правки этих строк.
 *
 * ГРАНИЦА. Сторож смотрит SQL и форму ответа, а не сами ответы: на пустой базе
 * утечка невидима и появляется с первой записью живого человека. Сплошную
 * пробу ответов он не заменяет — она отдельная работа и живёт снаружи.
 */
const KOREN = join(__dirname, "..", "src", "routes");
/*
 * Комментарии вырезаем. Объяснение починки САМО называет и «ownerEmail», и
 * «SELECT *» — без вырезания сторож краснел бы именно на тексте, который
 * объясняет, почему их там больше нет.
 */
const QRIGHT = stripComments(readFileSync(join(KOREN, "qright.ts"), "utf8"));
const REVENUE = stripComments(readFileSync(join(KOREN, "revenue.ts"), "utf8"));

/** Тело обработчика: от объявления маршрута до следующего объявления. */
function telo(src: string, prefiks: string, deklaraciya: string): string {
  const lines = src.split(String.fromCharCode(10));
  const start = lines.findIndex((l) => l.startsWith(deklaraciya));
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith(prefiks)) { end = i; break; }
  }
  return lines.slice(start, end).join(String.fromCharCode(10));
}

/**
 * У /objects две ветки: ?mine=1 за проверкой токена (владелец видит СВОЁ,
 * там почта законна и как ключ, и в выдаче) и публичная. Проверять надо
 * только вторую — иначе сторож потребует убрать почту оттуда, где она нужна.
 */
function publichnayaVetkaObjects(): string {
  const t = telo(QRIGHT, "qrightRouter.", 'qrightRouter.get("/objects", ');
  const at = t.indexOf('scope: "mine"');
  return at < 0 ? t : t.slice(at);
}

const PUBLICHNYE: Array<[string, () => string]> = [
  ["/objects (публичная ветка)", publichnayaVetkaObjects],
  ["/objects/:id", () => telo(QRIGHT, "qrightRouter.", 'qrightRouter.get("/objects/:id", ')],
  ["/objects.csv", () => telo(QRIGHT, "qrightRouter.", 'qrightRouter.get("/objects.csv", ')],
  ["/objects/search", () => telo(QRIGHT, "qrightRouter.", 'qrightRouter.get("/objects/search", ')],
  ["/lemonsqueezy/recent", () => telo(REVENUE, "revenueRouter.", 'revenueRouter.get("/lemonsqueezy/recent", ')],
];

describe("публичные ручки не отдают почту людей", () => {
  it("прибор исправен: тела найдены, и там, где почта законна, он её видит", () => {
    // Без этого «почты нигде нет» означало бы и «всё хорошо», и «я не умею
    // читать файл». Контроль положительный: у админской ручки и у ветки
    // владельца почта есть по замыслу, и разбор обязан её там находить.
    for (const [imya, poluchit] of PUBLICHNYE) {
      expect(poluchit().length, `не найдено тело ${imya}`).toBeGreaterThan(150);
    }
    expect(
      telo(QRIGHT, "qrightRouter.", 'qrightRouter.get("/admin/objects", ').includes("ownerEmail"),
      "разбор не видит почту даже там, где она есть — значит он слеп",
    ).toBe(true);
    expect(
      telo(QRIGHT, "qrightRouter.", 'qrightRouter.get("/objects", ').includes('"ownerEmail" = $2'),
      "ветка владельца перестала искать по почте — вход владельца сломан",
    ).toBe(true);
  });

  it("ни одна не называет ownerEmail", () => {
    for (const [imya, poluchit] of PUBLICHNYE) {
      expect(poluchit().includes("ownerEmail"), `${imya} отдаёт почту владельца`).toBe(false);
    }
  });

  it("ни одна не кладёт email в ответ", () => {
    for (const [imya, poluchit] of PUBLICHNYE) {
      expect(/^\s*email:/m.test(poluchit()), `${imya} кладёт адрес в ответ`).toBe(false);
    }
  });

  it("ни одна не делает SELECT *", () => {
    for (const [imya, poluchit] of PUBLICHNYE) {
      expect(poluchit().includes("SELECT *"), `${imya} отдаёт все столбцы таблицы`).toBe(false);
    }
  });
});
