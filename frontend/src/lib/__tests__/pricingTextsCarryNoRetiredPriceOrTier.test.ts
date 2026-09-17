import { describe, test, expect } from "vitest";
import { translations } from "../i18n-all";

/**
 * СТАТИЧНЫЙ ТЕКСТ ВИТРИНЫ НЕ ИМЕЕТ ПРАВА НЕСТИ НАШУ ЦЕНУ И СНЯТОЕ ИМЯ ТАРИФА.
 *
 * Живой повод, 16–17.09.2026. На проде в кейсе для стартапов стояло
 * «Стоимость стека: $19/мес», когда младший платный срок стоил уже $400 —
 * страница отвечала 200, все сторожа были зелёными, и увидеть это можно было
 * только глазами. В тот же вечер в таблице сравнения нашлась вторая такая
 * строка («Сравнимая цена (Pro) $19/мес»), а рядом — несуществующий тариф
 * «AEVION Business», которого нет в модели free/lite/medium/pro/full/max/
 * enterprise с 15.09.
 *
 * Почему одной правки текста мало: цена в статичном тексте не пересчитывается
 * НИКОГДА. Шаблон «от {price}/мес» стареет вместе с данными, а «$19/мес»
 * остаётся правдой ровно до следующей смены цен. Поэтому проверяется не
 * «правильное ли число» (такой сторож протух бы вместе с прайсом), а сам факт
 * НАШЕЙ цены в тексте: её там быть не должно — ни верной, ни неверной.
 *
 * Чего сторож НЕ запрещает и почему:
 *   • цены конкурентов ($25 DocuSign, $20 OpenAI, $59 Patently) — это не наши
 *     числа, от смены нашего прайса они не портятся;
 *   • сумму экономии клиента ($480/мес) — то же самое;
 *   • наши обязательства, не связанные с подпиской: $50 минимум выплаты
 *     партнёру, $5 000 награда за уязвимость, квартальная цель $5k;
 *   • `pricing.changelog.*` — ЗАКОННАЯ ИСТОРИЯ. Журнал изменений печатает дату
 *     у каждой записи (frontend/src/app/pricing/changelog/page.tsx: строка с
 *     {e.date}, группировка по месяцу), поэтому «Free trial для Pro и Business»
 *     читается как «что выпустили тогда» и на свою дату ВЕРНА. Правка этих
 *     записей была бы порчей истории. Если дату со страницы однажды уберут —
 *     запись станет живым обещанием, и это исключение придётся снять.
 */

/** Ключи, где денежная сумма законна. Список намеренно ЯВНЫЙ: новая сумма в
 *  любом другом ключе витрины — повод разобраться, а не молча разрешить. */
const MONEY_ALLOWED = new Set([
  "pricing.home.compare.priceDocusign", // цена конкурента
  "pricing.home.compare.priceOpenai", // цена конкурента
  "pricing.home.compare.pricePatently", // цена конкурента
  "pricing.forIndustry.startups.caseResult", // ~$120/мес у конкурентов
  "pricing.forIndustry.lawFirms.caseResult", // $480/мес экономии клиента
  "pricing.forIndustry.lawFirms.metric1Value", // $480/мес экономии клиента
  "pricing.affiliateDashboard.howItWorks.step5", // $50 минимум выплаты
  "pricing.security.bugBounty.body", // $5 000 награда
  "pricing.partners.compareRow.commitment.reseller", // $5k квартальная цель
]);

/** Имена, снятые с продажи. Они не вернутся, поэтому список не протухает. */
const RETIRED_NAMES = ["Business", "Universe", "All-Access", "All Access", "Studio Pro"];

/**
 * 🟡 ВРЕМЕННОЕ исключение, снять вместе с решением основателя (задано 16.09.2026).
 *
 * Оба ключа говорят «отчёт доступен для Business и Enterprise». Тарифа Business
 * нет, но чем его заменить — это вопрос ОБЯЗАТЕЛЬСТВА, а не опечатка: «только
 * Enterprise» сузит и отберёт у кого-то обещанный SOC2-отчёт, «любой платный
 * срок» обяжет нас перед всеми. Молча менять нельзя, поэтому текст оставлен как
 * есть, а сторож про эти два ключа молчит — иначе он был бы красным с рождения,
 * а к вечно красному сторожу привыкают и перестают его читать.
 */
const PENDING_FOUNDER_DECISION = new Set([
  "pricing.security.doc.pentest.description",
  "pricing.security.doc.soc2.description",
]);

/** «$19», «$ 19», «$1 050» — сумма. «$» сам по себе (например, в «$ USD») — нет. */
function hasMoney(value: string): boolean {
  for (let i = value.indexOf("$"); i >= 0; i = value.indexOf("$", i + 1)) {
    const tail = value.slice(i + 1, i + 4).replace(/ /g, "");
    if (/[0-9]/.test(tail)) return true;
  }
  return false;
}

function retiredNameIn(value: string): string | null {
  for (const name of RETIRED_NAMES) if (value.includes(name)) return name;
  return null;
}

type Row = { lang: string; key: string; value: string };

/** Все ключи витрины по всем языкам, кроме журнала изменений. */
function storefrontRows(): Row[] {
  const rows: Row[] = [];
  for (const [lang, dict] of Object.entries(translations)) {
    for (const [key, value] of Object.entries(dict as Record<string, string>)) {
      if (!key.startsWith("pricing.")) continue;
      if (key.startsWith("pricing.changelog.")) continue;
      if (typeof value !== "string") continue;
      rows.push({ lang, key, value });
    }
  }
  return rows;
}

describe("тексты витрины не несут нашу цену и снятые имена тарифов", () => {
  test("КОНТРОЛЬ прибора: ключи витрины нашлись, и признаки срабатывают на заведомых случаях", () => {
    const rows = storefrontRows();
    // Ключи pricing.* есть ровно в трёх полных словарях (замер 17.09: по 728).
    // Ноль здесь означал бы, что сторож ничего не проверяет.
    expect(rows.length).toBeGreaterThan(2000);
    expect(new Set(rows.map((r) => r.lang)).size).toBeGreaterThanOrEqual(3);

    // Признаки обязаны находить то, что в них заложено...
    expect(hasMoney("Стоимость стека: $19/мес")).toBe(true);
    expect(hasMoney("$1 050 за 3 месяца")).toBe(true);
    expect(retiredNameIn("единый AEVION Business")).toBe("Business");
    // ...и молчать там, где суммы нет.
    expect(hasMoney("$ USD")).toBe(false);
    expect(hasMoney("Цены указаны в USD")).toBe(false);
    expect(retiredNameIn("единая подписка AEVION")).toBeNull();
  });

  test("ни один ключ витрины не называет снятый тариф", () => {
    const hits = storefrontRows()
      .filter((r) => !PENDING_FOUNDER_DECISION.has(r.key))
      .map((r) => ({ ...r, name: retiredNameIn(r.value) }))
      .filter((r) => r.name);

    expect(
      hits.map((h) => `${h.lang} ${h.key} :: «${h.name}»`),
      "снятого тарифа нет в модели — текст обещает то, чего купить нельзя",
    ).toEqual([]);
  });

  test("денежная сумма встречается только там, где она законна", () => {
    const hits = storefrontRows()
      .filter((r) => hasMoney(r.value) && !MONEY_ALLOWED.has(r.key))
      .map((r) => `${r.lang} ${r.key} :: ${r.value.slice(0, 90)}`);

    expect(
      hits,
      "наша цена в статичном тексте протухает молча при каждой смене прайса — " +
        "берите её из данных либо уберите число из текста",
    ).toEqual([]);
  });

  test("список исключений не мёртвый: у каждого разрешённого ключа сумма ЕСТЬ", () => {
    // Исключение, переставшее быть нужным, прячет будущую регрессию: ключ снова
    // получит сумму, а сторож промолчит. Поэтому список сверяется со словарём.
    const withMoney = new Set(storefrontRows().filter((r) => hasMoney(r.value)).map((r) => r.key));
    const dead = [...MONEY_ALLOWED].filter((key) => !withMoney.has(key));

    expect(dead, "эти ключи больше не содержат сумм — уберите их из MONEY_ALLOWED").toEqual([]);
  });
});
