import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Кнопка подачи премий ведёт туда, где заявку ПРИНИМАЮТ.
 *
 * ПОВОД (замер прода 06.10.2026). На /awards/music и /awards/film стояла полная
 * форма подачи — пять полей и кнопка «Submit work» — а под её заголовком шла
 * строка «Demo mode — backend submission endpoint coming in next sprint.
 * Entries are saved to your browser only». Ниже на той же странице обещались
 * выплаты «1st = 500 AEC, 2nd = 250, 3rd = 100, settled to your AEVION Bank
 * wallet». Человек заполнял форму, жал кнопку, и работа оставалась у него в
 * браузере: «Local entries: 0», «Submitted works 0 total».
 *
 * При этом РАБОЧАЯ дверь существовала, и на неё вёл сам хаб /awards — адрес
 * /planet с productKey премии; он отвечает 200 и оговорки «demo» не имеет.
 * То есть дверей было две, рядом, и попасть в тупиковую было вероятнее.
 *
 * ПОЧЕМУ СТОРОЖ СМОТРИТ НА ОБЕ СТОРОНЫ. Панель не получает адрес пропсом, она
 * держит его копией. Копия и оригинал расходятся молча: страница останется
 * рабочей, кнопка — кликабельной, и «подача не доходит» снова будет выглядеть
 * как «работы не присылают».
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PANEL = join(HERE, "..", "_components", "AwardsTrackPanel.tsx");
const HUB = join(HERE, "..", "page.tsx");
const I18N = join(HERE, "..", "..", "..", "lib", "i18n-lang");

const панель = () => readFileSync(PANEL, "utf8");
const хаб = () => readFileSync(HUB, "utf8");

/** Адрес двери из кода: productKey + preset, без порядка параметров и кодировки. */
function двери(текст: string): Array<{ productKey: string; preset: string }> {
  const out: Array<{ productKey: string; preset: string }> = [];
  for (const m of текст.matchAll(/\/planet\?[^"'`\s]+/g)) {
    const s = m[0];
    const pk = /productKey=([a-zA-Z0-9_]+)/.exec(s)?.[1];
    const pr = /preset=([a-zA-Z0-9_]+)/.exec(s)?.[1];
    if (pk && pr) out.push({ productKey: pk, preset: pr });
  }
  return out;
}

describe("дверь подачи премий настоящая", () => {
  it("панель ведёт на /planet, а не на свою форму", () => {
    const д = двери(панель());
    expect(д.length, "в панели нет ссылок на /planet — кнопка снова ведёт в никуда").toBeGreaterThanOrEqual(2);
    expect(д.map((x) => x.productKey).sort()).toEqual([
      "aevion_award_film_v1",
      "aevion_award_music_v1",
    ]);
  });

  it("демо-формы в панели нет", () => {
    const t = панель();
    expect(t, "файл прочитан не тот — проверка ничего не значит").toContain("AwardsTrackPanel");
    expect(t, "вернулась форма с обработчиком отправки").not.toMatch(/<form[\s\S]{0,200}onSubmit=/);
    expect(t, "вернулась локальная запись заявки").not.toContain("addSubmission(");
  });

  it("адреса панели совпадают с теми, что стоят на хабе", () => {
    const пХаб = двери(хаб());
    const пПанель = двери(панель());
    expect(пХаб.length, "на хабе не осталось ссылок на /planet — сверять не с чем").toBeGreaterThanOrEqual(2);
    for (const д of пПанель) {
      expect(
        пХаб.some((h) => h.productKey === д.productKey && h.preset === д.preset),
        `панель ведёт на ${д.productKey}/${д.preset}, а хаб — нет: двери разошлись`,
      ).toBe(true);
    }
  });

  it("НИ ОДНА поверхность премий не обещает выплат — свип со знаменателем", () => {
    /*
     * 🔴 ПОВОД. 07.10.2026 первая версия этой проверки перечисляла ключи РУКАМИ
     * и оказалась слепа к половине поверхностей. После выкатки на проде остались
     * обещания выплат в: заголовке страницы `/awards` (`layout.tsx` → `<title>`),
     * описаниях для соцсетей, КАРТИНКАХ превью (`opengraph-image.tsx`, текст
     * рисуется внутрь картинки), метаданных обоих треков и в структурированных
     * данных FAQ — а их показывает поисковая выдача. Всего 27 строк-обещаний в
     * пяти файлах, и ни одну из них перечисление ключей не ловило.
     *
     * Поэтому здесь СВИП: берём все файлы раздела премий, ищем совпадение
     * «AEC рядом со словом про выплату» и печатаем ЗНАМЕНАТЕЛЬ. Исключения
     * названы поимённо — молчаливый пропуск по шаблону имени уже давал у нас
     * зелёный отчёт при нулевом охвате.
     */
    const КОРЕНЬ = join(HERE, "..");
    const РАЗРЕШЕНО = new Set([
      // Константа и её пояснение: оставлены намеренно, чтобы вернуть блок одним
      // движением, когда начисление свяжут с премиями. Отрисовку стережёт
      // проверка выше.
      "_lib/submissions.ts",
      // Собственные проверки этого файла содержат образцы «500 AEC» по делу.
      "__tests__/awardsSubmitDoorIsReal.guard.test.ts",
    ]);
    const ВЫПЛАТА = /(payout|prize|receive|settle|Top-3|выплат|приз)/i;
    // Признаки ОТРИЦАНИЯ выплаты: такие строки говорят правду и остаются.
    // Обойти сторож, приписав «no» к обещанию, мешает мутация в конце файла:
    // возврат настоящего обещания обязан красить.
    const ОТРИЦАНИЕ = /(no prize|no payout|not part of wave|is not wired|not paid out|нет выплат|не выплачив|выплат пока нет)/i;

    const файлы: string[] = [];
    const обойти = (дир: string, префикс: string) => {
      for (const имя of readdirSync(дир)) {
        const полный = join(дир, имя);
        const отн = префикс ? `${префикс}/${имя}` : имя;
        if (statSync(полный).isDirectory()) обойти(полный, отн);
        else if (/\.(ts|tsx)$/.test(имя)) файлы.push(отн);
      }
    };
    обойти(КОРЕНЬ, "");

    const находки: string[] = [];
    let проверено = 0;
    for (const отн of файлы) {
      if (РАЗРЕШЕНО.has(отн)) continue;
      проверено++;
      const исходник = readFileSync(join(КОРЕНЬ, отн), "utf8");
      /*
       * Комментарии снимаем ЦЕЛИКОМ, а не по началу строки. Первая версия
       * проверяла `trim().startsWith("//")` и дала три ложных срабатывания на
       * ПРОДОЛЖЕНИИ многострочного комментария — там, где объяснено, почему
       * блок выплат снят. Разбор обязан жить рядом с кодом, иначе блок вернут
       * по незнанию; значит слепнуть должен сторож, а не исчезать объяснение.
       * Номера строк сохраняем: замена идёт на пробелы той же длины.
       */
      // Комментарии снимаем посимвольно, без регулярок: версия на регулярках
      // дала три ложных срабатывания на ПРОДОЛЖЕНИИ многострочного комментария —
      // там, где объяснено, почему блок выплат снят. Объяснение обязано жить
      // рядом с кодом, значит слепнуть должен сторож, а не исчезать разбор.
      // Переводы строк сохраняем, чтобы номера строк в находках были настоящими.
      let безКомментариев = "";
      let вБлоке = false;
      let вСтроке = false;
      for (let k = 0; k < исходник.length; k++) {
        const c = исходник[k];
        const d = исходник[k + 1];
        const пара = c + (d || "");
        if (!вБлоке && !вСтроке && пара === "/" + "*") { вБлоке = true; безКомментариев += "  "; k++; continue; }
        if (вБлоке && пара === "*" + "/") { вБлоке = false; безКомментариев += "  "; k++; continue; }
        if (!вБлоке && !вСтроке && пара === "/" + "/") { вСтроке = true; безКомментариев += "  "; k++; continue; }
        if (вСтроке && c === String.fromCharCode(10)) { вСтроке = false; безКомментариев += c; continue; }
        безКомментариев += (вБлоке || вСтроке) && c !== String.fromCharCode(10) ? " " : c;
      }
      безКомментариев.split(String.fromCharCode(10)).forEach((строка, i) => {
        if (!строка.includes("AEC")) return;
        if (!ВЫПЛАТА.test(строка)) return;
        // 🔴 Строка, которая ОТРИЦАЕТ выплату, — это и есть починка, и краснеть
        // на ней нельзя. Первая версия свипа покраснела на моей же честной
        // оговорке «Wave 1 has no prize pool: validators are not paid out of
        // one»: в ней есть и «prize», и «paid». Сторож, красный на починке,
        // учит обходить себя — у нас это уже случалось с проверками по
        // дословным строкам.
        if (ОТРИЦАНИЕ.test(строка)) return;
        находки.push(`${отн}:${i + 1}: ${строка.trim().slice(0, 80)}`);
      });
    }

    // Контроль охвата: если свип вдруг ничего не обошёл, проверка обязана
    // покраснеть, а не отчитаться зелёным нулём.
    expect(проверено, "свип не обошёл ни одного файла — проверка ничего не значит").toBeGreaterThanOrEqual(8);
    expect(находки, `обещание выплат вернулось (проверено файлов: ${проверено})`).toEqual([]);
  });

  it("инвесторская модель называет выплаты премий ПЛАНОМ, а не фактом", () => {
    /*
     * Решение оркестратора 07.10.2026: инвестору план назвать можно, факт без
     * механизма — нельзя. В pitchModel.ts четыре строки заявляли выплаты
     * победителям премий как действующие: «AEC payout integrated with Bank» в
     * списке ДОКАЗАТЕЛЬСТВ, заголовок сценария «payout in AEC», история
     * «winners get prize money in AEC directly to studio's Bank account» и фаза
     * роста «conversion to Bank is automatic (royalty payout settles to AEC)».
     *
     * Начисления победителю премии в коде нет: internalMintForDevice зовут из
     * ровно одного места — routes/bureau.ts, награда за сертификат бюро.
     *
     * Проверяем НЕ отсутствие слова AEC (оно там законно — это внутренняя
     * валюта), а то, что рядом с выплатой премий стоит слово «Planned».
     */
    const файл = join(HERE, "..", "..", "..", "data", "pitchModel.ts");
    const текст = readFileSync(файл, "utf8");
    expect(текст, "прочитан не тот файл — проверка ничего не значит").toContain("AEVION Awards");

    const строки = текст.split(String.fromCharCode(10));
    const нарушения: string[] = [];
    let сПланом = 0;
    строки.forEach((строка, i) => {
      const естьВыплата = /(AEC payout|payout in AEC|prize money in AEC|payout settles to AEC)/i.test(строка);
      if (!естьВыплата) return;
      if (/Planned|planned/.test(строка)) { сПланом++; return; }
      нарушения.push(`pitchModel.ts:${i + 1}: ${строка.trim().slice(0, 90)}`);
    });
    // Контроль охвата: если ни одной строки о выплатах не осталось вовсе, значит
    // кто-то вырезал их целиком — проверка перестала что-либо значить, и об этом
    // надо узнать, а не получить зелёный ноль.
    expect(сПланом, "строк о выплатах премий не осталось — проверка ослепла").toBeGreaterThanOrEqual(2);
    expect(нарушения, "выплаты премий снова заявлены как действующие").toEqual([]);
  });

  it("страницы премий НЕ рисуют обещание выплат AEC", () => {
    // Решение оркестратора 06.10.2026, вариант 2: блок выплат снять со всех
    // страниц премий, пока начисление не связано с премиями.
    //
    // Замер, на котором решение основано: AEC_PAYOUTS — константы ФРОНТА в
    // _lib/submissions.ts; ни одна строка бэкенда не начисляет AEC победителю.
    // Механизм начисления есть (internalMintForDevice, routes/aev.ts), но зовут
    // его из ровно ОДНОГО места — routes/bureau.ts:1160, награда за сертификат
    // бюро. Победителя к тому же нечем определить: голосовавших за всё время 0.
    //
    // 🔴 Проверяем ОТРИСОВКУ, а не наличие ключей. Сами строки и константа
    // намеренно оставлены в словарях — чтобы вернуть блок одним движением,
    // когда механизм появится. Сторож, искавший бы «нет строки 500 AEC в
    // словаре», краснел бы на сохранённой заготовке и зеленел бы, если блок
    // вернуть под другим ключом: он проверял бы не то.
    const панельТекст = панель();
    const хабТекст = хаб();
    expect(панельТекст, "файл панели прочитан не тот").toContain("AwardsTrackPanel");
    expect(панельТекст, "блок выплат снова рисуется в панели").not.toMatch(/t\(\s*["'`]awardsTrack\.payout\./);
    expect(панельТекст, "константа выплат снова попала в отрисовку").not.toMatch(/\{\s*AEC_PAYOUTS\./);
    expect(хабТекст, "шаг «выплата AEC» снова в конвейере хаба").not.toContain("awardsHub.pipeline.s4");

    // Подзаголовки и статы треков не обещают выплату.
    let проверено = 0;
    for (const я of ["en", "ru", "kk"] as const) {
      const d = readFileSync(join(I18N, `${я}.ts`), "utf8");
      for (const ключ of [
        '"awards.music.subtitle"',
        '"awards.film.subtitle"',
        '"awardsHub.subtitle"',
        '"awardsHub.h1.line2"',
        '"awards.music.stat.payout.value"',
        '"awards.film.stat.payout.value"',
      ]) {
        const i = d.indexOf(ключ);
        expect(i, `${ключ} пропал в ${я}.ts — проверка ослепла`).toBeGreaterThan(-1);
        const строка = d.slice(i, d.indexOf(String.fromCharCode(10), i));
        expect(строка, `${я}: ${ключ} снова обещает выплату AEC`).not.toMatch(/AEC/);
        проверено++;
      }
    }
    expect(проверено, "ни одна строка не проверена").toBe(18);
  });

  it("ни на одном языке не обещаем демо-режим в форме премий", () => {
    const языки = ["en", "ru", "kk"] as const;
    let проверено = 0;
    for (const я of языки) {
      const t = readFileSync(join(I18N, `${я}.ts`), "utf8");
      const i = t.indexOf('"awardsTrack.form.intro"');
      expect(i, `ключ awardsTrack.form.intro пропал в ${я}.ts — проверка ослепла`).toBeGreaterThan(-1);
      const строка = t.slice(i, t.indexOf("\n", i)).toLowerCase();
      expect(строка, `${я}: форма премий снова говорит про демо`).not.toMatch(
        /demo mode|демо-режим|browser only|только в вашем браузере|тек браузерде/,
      );
      проверено++;
    }
    expect(проверено, "ни один язык не проверен").toBe(языки.length);
  });

  it("шаг конвейера не обещает, что сертификат даёт голосование", () => {
    // Проверено по коду 06.10.2026: сертификат выдаётся при
    //   overallStatus === "passed", а overallStatus = decideOverallStatus(validatorResults)
    // смотрит ТОЛЬКО на автоматические проверки (в MVP валидатор
    // "full_ci_verification_static": целостность, безопасность, структура пакета).
    // Голоса (таблица PlanetVote) в выдаче не участвуют ни в одном из двух путей
    // выдачи — planetCompliance.ts:1249 и :1817. Текст «сертификат выдаётся при
    // прохождении кворума» описывал не нашу систему.
    let проверено = 0;
    for (const я of ["en", "ru", "kk"] as const) {
      const t = readFileSync(join(I18N, `${я}.ts`), "utf8");
      for (const ключ of ['"awardsHub.pipeline.s3.body"', '"awardsHub.pipeline.s3.title"']) {
        const i = t.indexOf(ключ);
        expect(i, `${ключ} пропал в ${я}.ts — проверка ослепла`).toBeGreaterThan(-1);
        const строка = t.slice(i, t.indexOf(String.fromCharCode(10), i)).toLowerCase();
        expect(строка, `${я}: шаг конвейера снова связывает сертификат с кворумом/голосованием`).not.toMatch(
          /кворум|quorum|голосу|дауыс бер|vote/,
        );
        проверено++;
      }
    }
    expect(проверено, "ни одна строка не проверена").toBe(6);
  });

  it("подпись к числу сертифицированных не обещает кворум", () => {
    // certifiedArtifactVersions считается так:
    //   COUNT(*) FROM "PlanetArtifactVersion" WHERE "certificateId" IS NOT NULL
    // (aevion-globus-backend/src/routes/planetCompliance.ts). Голосование в счёт
    // не входит никак, а distinctVotersAllTime на 06.10.2026 равен нулю: за всё
    // время не голосовал никто. Подпись «прошли кворум» обещала то, чего не было.
    let проверено = 0;
    for (const я of ["en", "ru", "kk"] as const) {
      const t = readFileSync(join(I18N, `${я}.ts`), "utf8");
      const i = t.indexOf('"awardsHub.stat.certified.hint"');
      expect(i, `подпись пропала в ${я}.ts`).toBeGreaterThan(-1);
      const строка = t.slice(i, t.indexOf("\n", i)).toLowerCase();
      expect(строка, `${я}: подпись снова обещает кворум`).not.toMatch(/quorum|кворум/);
      проверено++;
    }
    expect(проверено).toBe(3);
  });
});
