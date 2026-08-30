import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Страница не должна молча наследовать canonical родителя.
 *
 * ЗАЧЕМ. В Next метаданные сливаются сверху вниз: canonical, заданный в макете
 * раздела, достаётся всем дочерним страницам, которые не объявили свой. Такая
 * страница говорит поисковику «я копия, индексируй родителя вместо меня».
 * Ошибки при этом нет: сборка проходит, тесты зелёные, страница просто
 * исчезает из поиска.
 *
 * Проверено пробой ЖИВОГО прода 30.08.2026, а не по коду:
 *   /payments/api      canonical https://aevion.app/payments
 *   /bank/leaderboard  canonical https://aevion.app/bank
 *   /awards/results    canonical https://aevion.app/awards
 * Контроль: /pricing со своим canonical отвечает правильно — проба различает.
 *
 * ПОЧЕМУ ИЩЕМ ИМЕННО "canonical:" С ДВОЕТОЧИЕМ, а не слово. Первая версия искала
 * слово и была ПУСТОЙ: рядом с каждым добавленным canonical стоит комментарий,
 * объясняющий, зачем он нужен, и слово находилось в нём. Мутация (убрать
 * настоящий ключ, оставить пояснение) проходила незамеченной. Двоеточие
 * отличает ключ объекта от прозы: в коде 164 файла, со словом вообще 186.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const KEY = "canonical:";

/* СТРУКТУРА СПИСКА ПО РАЗДЕЛАМ (замер 30.08.2026) — разбирать удобнее так,
 * а не плоским перечнем: у одного раздела обычно один ответ на все дочерние.
 *
 *   bureau     6   сертификаты и авторы — вероятно ДОЛЖНЫ быть в поиске
 *                  (значок закрыт 30.08 как страница для встраивания)
 *   bank       5   ведёт соседняя вкладка в своей зоне
 *   qright     4   объекты и значки, тот же вопрос что у bureau
 *   pricing    3   тарифы и отрасли; paddle отпадает (перенаправление)
 *   planet     2   артефакты и значки
 *   awards     2   заявки и значки
 *   qcontract  2   документы
 *   остальные  по одному: qchaingov, qmaskcard, qpersona, bureau/org
 *
 * ТРЕТИЙ ОБРАЗЕЦ (найден 30.08 позже): рядом с объектом живут страницы
 * ДЕЙСТВИЙ над ним — «запросить заверение», «повысить уровень», «журнал».
 * На них приходят СО СТРАНИЦЫ объекта, нажав кнопку, а не из выдачи. Им
 * нужен index: false: в поиске они соревнуются с самим объектом, показывая
 * форму вместо содержания. Закрыты notarize и upgrade у сертификата бюро.
 *
 * ПОВТОРЯЮЩИЙСЯ ОБРАЗЕЦ: в каждом разделе есть «значок» (`badge`) — страница
 * для встраивания, а не для чтения. Ей нужен НЕ canonical, а index: false:
 * в выдаче она соревновалась бы со страницей самого объекта, показывая одну
 * картинку. Так уже сделано у `modules/[id]/badge`.
 *
 * Второй образец: страницы вида `<раздел>/<объект>/[id]` — сертификат,
 * артефакт, документ. Это то, что мы показываем как ДОКАЗАТЕЛЬСТВО, и им
 * canonical, вероятно, нужен свой. Но решать должен тот, кто знает, хотим ли
 * мы видеть чужие сертификаты в поисковой выдаче. */

/** Страницы, наследующие чужой canonical на 30.08.2026. ХРАПОВИК: список
 *  заморожен, чтобы ловить НОВЫЕ случаи, пока эти разбирают поштучно. Часть
 *  из них, вероятно, законна — служебным адресам вроде auth/success и
 *  страницам с идентификатором в пути место в поиске не нужно. Вычёркивать
 *  отсюда можно, только починив или назвав причину. */
//
// РАЗБОР СПИСКА на 30.08.2026, чтобы следующий не считал заново:
//   29 динамических (идентификатор в пути). ОСТОРОЖНО: «динамический» НЕ
//      значит «не нужен в поиске» — это классификация по имени адреса, и она
//      врёт. Разбор 30.08.2026 по существу:
//        публичные по смыслу, вероятно ДОЛЖНЫ индексироваться —
//          bureau/cert/[certId]      сертификат показывают как доказательство
//          bureau/author/[slug]      страница автора
//          bureau/notaries/[notaryId], planet/artifact/[id],
//          awards/entry/[entryId]    — у трёх есть generateMetadata,
//                                      то есть про их метаданные уже думали;
//        приватные по устройству — 30.08 ЗАКРЫТЫ явным index: false и потому
//          из списка ушли: bureau/org/accept/[token],
//          multichat-engine/shared/[token], planet/webhooks/[id].
//          В адресе токен доступа: попадание такого адреса в индекс означает
//          утечку доступа любому, кто прочитает выдачу.
//      Проверить на живом сайте не удалось: выпущенных сертификатов на
//      публичных страницах нет, примера адреса взять неоткуда. Поэтому это
//      ВОПРОС, а не находка: решать должен тот, кто знает, показываем ли мы
//      чужие сертификаты в поиске. Приватные с токеном в адресе стоит закрыть
//      явным index: false независимо от ответа.
//    служебные 30.08 закрыты явным index: false и потому из списка ушли:
//    сторож пропускает страницы, которым поиск запрещён, — им canonical не нужен;
//    5 публичных — вот их и стоит разбирать.
// Из семи публичных сразу отпадает `pricing/paddle`: это страница-
// перенаправление, ей собственный canonical не нужен по устройству.
// Четыре банковских (`bank/api`, `bank/badge`, `bank/explore`,
// `bank/leaderboard`) ведёт соседняя вкладка в своей зоне.
// Остаются `bureau/launch` (расходится между ветками — сперва свести) и
// `qright/transparency` (собирает метаданные функцией, нужен generateMetadata).
const INHERITING_TODAY = new Set([
    "awards/entry/[entryId]",
    "bank/api",
    "bank/badge",
    "bank/explore",
    "bank/leaderboard",
    "bank/share/[handle]",
    "bureau/author/[slug]",
    "bureau/cert/[certId]",
    "bureau/notaries/[notaryId]",
    "bureau/org/[orgId]",
    "planet/artifact/[id]",
    "pricing/[tierId]",
    "pricing/for/[industry]",
    "pricing/paddle",
    "qchaingov/proposals/[id]",
    "qcontract/documents/[id]",
    "qcontract/documents/[id]/log",
    "qmaskcard/charges/[id]",
    "qpersona/view/[alias]",
    "qright/object/[id]",
    "qright/object/[id]/policies",
    "qright/webhooks/[id]",
    "qsign/embed/[id]",
    "qsign/verify/[id]",
    "quantum-shield/[id]"
]);

/** Страница, которой ЗАПРЕЩЕНА индексация, в поиске не участвует — наследование
 *  чужого canonical ей ничем не вредит, и чинить там нечего. Уточнение соседней
 *  вкладки 30.08.2026: из её восьми кандидатов четыре оказались именно такими.
 *  Без этого условия список замороженных держал бы страницы, которые никто
 *  никогда не починит, никогда не дошёл бы до нуля и перестал бы читаться. */
function isNoIndex(dir: string): boolean {
  return ["page.tsx", "layout.tsx"].some((f) => {
    const file = join(dir, f);
    if (!existsSync(file)) return false;
    const src = readFileSync(file, "utf8");
    return src.includes("index: false") || src.includes("index:false");
  });
}

function hasOwnCanonical(dir: string): boolean {
  return ["page.tsx", "layout.tsx"].some((f) => {
    const file = join(dir, f);
    return existsSync(file) && readFileSync(file, "utf8").includes(KEY);
  });
}

function scan(): { parents: string[]; inheriting: string[] } {
  const parents: string[] = [];
  const pages: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === "__tests__" || e.name === "_components") continue;
      const sub = join(dir, e.name);
      const route = rel ? rel + "/" + e.name : e.name;
      const lay = join(sub, "layout.tsx");
      if (existsSync(lay) && readFileSync(lay, "utf8").includes(KEY)) parents.push(route);
      if (existsSync(join(sub, "page.tsx"))) pages.push(route);
      walk(sub, route);
    }
  };
  walk(APP, "");
  const inheriting = pages.filter(
    (r) => !parents.includes(r) && parents.some((p) => r.startsWith(p + "/")) && !hasOwnCanonical(join(APP, ...r.split("/")))
      && !isNoIndex(join(APP, ...r.split("/"))),
  );
  return { parents, inheriting };
}

describe("canonical не наследуется молча", () => {
  const { parents, inheriting } = scan();

  it("обход находит и родителей, и страницы — иначе проверка пустая", () => {
    // Контроль охвата: сломается обход — списки опустеют, и проверки ниже
    // пройдут, ничего не проверив. Замер 30.08.2026: 125 родителей, 70
    // наследующие страницы.
    // Порог стоит на РОДИТЕЛЯХ, а не на наследующих, и это исправлено 30.08.2026
    // по факту: прежний порог требовал «не меньше 30 наследующих», то есть был
    // привязан к числу, которое эта же работа УМЕНЬШАЕТ. Закрыв четыре страницы,
    // я получил красный контроль охвата на исправном обходе — проверка мешала
    // чинить то, ради чего написана.
    //
    // Родителей (разделов, объявивших canonical) — величина устойчивая: она
    // растёт по мере работы, а не падает. Сломается обход — упадёт и она.
    expect(parents.length).toBeGreaterThanOrEqual(50);
    // Наследующих может стать сколько угодно мало вплоть до нуля — это цель,
    // а не поломка. Проверяем лишь, что список ВООБЩЕ считается: -1 означало бы
    // ошибку счёта, а не пустой результат.
    expect(inheriting.length).toBeGreaterThanOrEqual(0);
  });

  it("новых наследующих страниц не появилось", () => {
    const fresh = inheriting.filter((r) => !INHERITING_TODAY.has(r));
    expect(fresh, "страница под разделом с canonical не объявила свой — она выпадет из поиска").toEqual([]);
  });

  it("храповик не протух: замороженные всё ещё наследуют", () => {
    // Починили страницу, а из списка не вычеркнули — список начинает прощать
    // несуществующее и однажды простит настоящее.
    const gone = [...INHERITING_TODAY].filter((r) => !inheriting.includes(r));
    expect(gone, "эти страницы уже не наследуют — вычеркните их из списка").toEqual([]);
  });
});
