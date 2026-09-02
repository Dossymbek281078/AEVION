import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Список пишущих ручек DevHub без проверки прав не РАСТЁТ.
 *
 * Замер 02.09.2026 на боевом сервере пробой с пустым телом (400 = пускает без
 * входа, при этом ничего не отправляется; контроль — выдуманный путь даёт 404):
 * открыты одиннадцать ручек, и только у трёх отправляющих есть предел 5/мин.
 * У восьми, включая вызов платной модели ИИ и создание платёжных ссылок, нет
 * ничего.
 *
 * Это НЕ новая находка: тот же класс записан 28.08.2026 и назвал три ручки.
 * За пять дней поведение не изменилось, а настоящий размер оказался втрое
 * больше — записанная находка называла то, что автор проверил, а не класс.
 *
 * ПОЧЕМУ СТОРОЖ ИМЕННО ТАКОЙ. Закрыть ручки — это либо предел, либо привязка
 * к гостевой личности и расходу, то есть работа в файле, который сейчас правит
 * соседняя ветка, и отчасти решение основателя (DevHub намеренно работает без
 * входа). Сторож ни того, ни другого не требует: он не даёт списку вырасти и
 * заставляет заметить ДВЕНАДЦАТУЮ такую ручку в тот же день, когда её напишут.
 *
 * Сверка НА РАВЕНСТВО, а не «не больше»: закрыли ручку — уберите строку,
 * иначе список замрёт и перестанет отражать правду. Список обязан УМЕНЬШАТЬСЯ.
 *
 * 🔗 РЯДОМ ЕСТЬ СОСЕДНИЙ СТОРОЖ, и путать их нельзя.
 * `costlyEndpointsProtected.guard.test.ts` (с 28.07) спрашивает: есть ли у ручки,
 * зовущей ПЛАТНОГО провайдера, ограничитель или квота. Этот спрашивает другое:
 * сверяет ли пишущая ручка, КТО пришёл. Вопросы не совпадают — у `/media/email`
 * ограничитель есть (значит для соседа она защищена), а входа нет (значит для
 * этого — открыта); у `/media/payment-link` нет ни того, ни другого.
 *
 * Я написал этот сторож, НЕ поискав соседний, и час считал его находкой. Если
 * будете расширять любой из двух — правьте тот, чей ВОПРОС расширяете, и не
 * переносите списки между ними: они про разное и обязаны расходиться.
 *
 * ⚠️ Граница честная: сторож читает ИСХОДНИК и судит по признакам проверки
 * прав рядом с объявлением ручки. Он не доказывает, что остальные ручки
 * защищены, — он замечает появление новых незащищённых.
 */

const ISHODNIK = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "src", "routes", "devhub.ts",
);

/** Признаки того, что обработчик сверяет, кто пришёл. */
const PRIZNAKI = ["canEdit", "userId !==", ".userId ===", "requireAuth", "verifyBearer"];

/**
 * Известные на 02.09.2026. Одиннадцать подтверждены пробой прода; четыре
 * (`/media/sfx`, `/media/upload-audio`, `/media/email-template-send`,
 * `/media/voice-clone/preview`) найдены разбором и пробой не проверялись —
 * их поведение не утверждается, они здесь только чтобы список был полным.
 */
const IZVESTNYE = [
  "/ask",
  "/media/email",
  "/media/email-template-create",
  "/media/email-template-send",
  "/media/gumroad-checkout",
  "/media/payment-link",
  "/media/sfx",
  "/media/sms",
  "/media/stt",
  "/media/translate",
  "/media/upload-audio",
  "/media/upload-image",
  "/media/voice-clone",
  "/media/voice-clone/preview",
  "/media/whatsapp",
];

function bezProverkiPrav(src: string): string[] {
  const lines = src.split(String.fromCharCode(10));
  const out: string[] = [];
  for (let n = 0; n < lines.length; n++) {
    const m = /devhubRouter\.(post|put|patch|delete)\(\s*"([^"]+)"/.exec(lines[n]);
    if (!m) continue;
    const okno = lines.slice(n, n + 45).join(String.fromCharCode(10));
    if (PRIZNAKI.some((p) => okno.includes(p))) continue;
    out.push(m[2]);
  }
  return out;
}

describe("пишущие ручки DevHub без проверки прав не растут", () => {
  it("прибор исправен: ручки вообще находятся", () => {
    const src = readFileSync(ISHODNIK, "utf8");
    const vse = /devhubRouter\.(post|put|patch|delete)\(/g;
    expect((src.match(vse) || []).length, "пишущих ручек не найдено — разбор сломан").toBeGreaterThan(40);
    // Контроль в обе стороны: разбор ОБЯЗАН пропускать защищённое и ловить
    // незащищённое. Без этой пары ноль неотличим от «не умею искать».
    expect(bezProverkiPrav('devhubRouter.post("/x", async () => { canEdit(p, u); })')).toEqual([]);
    expect(bezProverkiPrav('devhubRouter.post("/y", async () => { res.json({}); })')).toEqual(["/y"]);
  });

  it("список ровно тот же — ни одной новой", () => {
    const est = bezProverkiPrav(readFileSync(ISHODNIK, "utf8")).sort();
    expect(
      est,
      "новая пишущая ручка DevHub не сверяет, кто пришёл: платные вызовы и отправка доступны без входа",
    ).toEqual([...IZVESTNYE].sort());
  });
});
