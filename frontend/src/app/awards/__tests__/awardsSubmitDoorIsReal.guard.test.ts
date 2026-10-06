import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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
