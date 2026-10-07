import { test, expect, type Page } from "@playwright/test";

/**
 * На ОТРИСОВАННОЙ странице «Глубокий анализ» не продаётся как платная вещь.
 *
 * Повод 07.10.2026: замер показал, что эта платная часть не работает ни у кого,
 * включая оплативших — нейросети движка по адресу /nnue отдают 404, каталога
 * нет в сборке, переменная NEXT_PUBLIC_NNUE_BASE не задана. Обещание снято.
 *
 * Зачем проверка по КАДРУ, если есть свип по исходникам. Свип отвечает «в коде
 * такой строки нет», а человек читает не код: текст может прийти из словаря
 * другого модуля, из подсказки-атрибута или из серверной отрисовки. Здесь
 * спрашивается то, что видно.
 *
 * ⚠️ Язык. Чистое окно браузера открывает страницу ПО-АНГЛИЙСКИ — на этом уже
 * споткнулся соседний сторож. Поэтому обходим три языка явно, а не надеемся на
 * локаль проверяющего.
 */

const ЯЗЫКИ = ["ru", "en", "kk"] as const;

/** Признаки продажи — те же три языка, что и в свипе по исходникам. */
const БУКВЫ = "[A-Za-zА-Яа-яЁёӘҒҚҢӨҰҮҺІәғқңөұүһі]";
const ПРОДАЖА: RegExp[] = [
  new RegExp(
    `(Глубок${БУКВЫ}* анализ[^.]{0,60}(платн|подписк|оплат))` +
      `|((платн|подписк|оплат)${БУКВЫ}*[^.]{0,60}Глубок${БУКВЫ}* анализ)`,
    "i",
  ),
  /(Deep analysis[^.]{0,60}(paid|subscription|unlock))|((paid|unlocks?)[^.]{0,60}Deep analysis)/i,
  new RegExp(`(Терең талдау[^.]{0,60}(ақылы|жазылым|төле))|((ақылы|жазылым|төле)${БУКВЫ}*[^.]{0,60}Терең талдау)`, "i"),
];

/**
 * Весь видимый текст И подсказки-атрибуты. Подсказка у кнопки покупки — тоже
 * обещание: человек наводит мышь и читает его.
 */
async function vidimyjTekst(page: Page): Promise<string> {
  return page.evaluate(() => {
    const куски: string[] = [document.body.innerText || ""];
    for (const el of Array.from(document.querySelectorAll("[title],[aria-label],[placeholder]"))) {
      for (const a of ["title", "aria-label", "placeholder"]) {
        const v = el.getAttribute(a);
        if (v) куски.push(v);
      }
    }
    return куски.join(String.fromCharCode(10));
  });
}

async function otkryt(page: Page, адрес: string, язык: string) {
  await page.goto(адрес);
  await page.evaluate((l) => {
    try {
      localStorage.setItem("aevion_lang_v1", l);
      localStorage.setItem("aevion_locale", l);
      document.cookie = `aevion_lang_v1=${l}; path=/`;
    } catch {
      /* приватное окно — тогда проверка просто не состоится, и это видно */
    }
  }, язык);
  await page.goto(адрес);
  await page.waitForLoadState("networkidle");
}

for (const язык of ЯЗЫКИ) {
  test(`страница шахмат не продаёт глубокий анализ (${язык})`, async ({ page }) => {
    await otkryt(page, "/cyberchess?c=probe-61", язык);
    const текст = await vidimyjTekst(page);
    // Охват: пустая страница прошла бы любую проверку на отсутствие.
    expect(текст.length, `видимого текста ${текст.length} знаков — страница не отрисовалась`).toBeGreaterThan(400);

    const найдено = ПРОДАЖА.map((p) => текст.match(p)).filter(Boolean);
    expect(
      найдено.map((m) => m![0]),
      `на экране (${язык}) глубокий анализ подан как платный`
    ).toEqual([]);
  });
}

test("страница цен не продаёт глубокий анализ", async ({ page }) => {
  await otkryt(page, "/pricing?app=cyberchess&c=probe-61#apps", "ru");
  const текст = await vidimyjTekst(page);
  expect(текст.length, `видимого текста ${текст.length} знаков`).toBeGreaterThan(400);
  const найдено = ПРОДАЖА.map((p) => текст.match(p)).filter(Boolean);
  expect(найдено.map((m) => m![0]), "на странице цен глубокий анализ подан как платный").toEqual([]);
});
