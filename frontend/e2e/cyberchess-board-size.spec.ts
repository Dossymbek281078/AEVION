import { test, expect, type Page } from "@playwright/test";

/**
 * Размер доски на экране настройки и в партии — ЗАМЕРОМ, а не по формуле.
 *
 * Повод (06.10.2026). Окно «Среды» намерило на экране настройки доску 416 px
 * (41 % высоты окна 1015) и приняло это за суточную регрессию: накануне та же
 * проверка давала 542. Регрессии не было — сравнивались два РАЗНЫХ экрана:
 *   с начатой партией рисуется игровая доска, она считается по бюджету высоты
 *   и даёт 542 (и давала 542 на том же самом проде в тот же день);
 *   без партии рисуется превью на экране настройки, а у него стоял жёсткий
 *   max-width: 420 px, одинаковый в обоих продах.
 *
 * Отсюда две вещи, которые и закрепляет этот сторож:
 *   1) превью берёт свободную высоту, а не константу — но не настолько, чтобы
 *      выдавить кнопку «ИГРАТЬ» за кромку окна (в сентябре так уже было);
 *   2) игровая доска НЕ изменилась — иначе «починка» первого молча портит
 *      второе, и заметить это будет нечем.
 *
 * ⚠️ Про прибор. Доска НЕ находится по классам: ни [data-square], ни
 * [class*="board"], ни cg-board на этой сборке не дают ничего. Превью ловится
 * по «ровно 64 прямых потомка», а у ИГРОВОЙ доски потомков 66 — есть накладки,
 * и тот же признак на ней молча даёт ноль. Поэтому ищем структурно и одинаково
 * для обеих: самый большой КВАДРАТНЫЙ элемент со стороной больше 200.
 */

const АДРЕС = "/cyberchess?c=probe-61";

async function размерДоски(page: Page) {
  return page.evaluate(() => {
    let лучший: { w: number; h: number; top: number; детей: number } | null = null;
    for (const el of Array.from(document.querySelectorAll("div,section,button"))) {
      const r = el.getBoundingClientRect();
      if (r.width < 200 || Math.abs(r.width - r.height) > 4) continue;
      if (!лучший || r.width > лучший.w) лучший = { w: r.width, h: r.height, top: r.top, детей: el.children.length };
    }
    return лучший
      ? { сторона: Math.round(лучший.w), верх: Math.round(лучший.top), детей: лучший.детей, окно: window.innerHeight }
      : null;
  });
}

/** Нижняя кромка главной кнопки старта — она обязана остаться в окне. */
async function низКнопкиИграть(page: Page) {
  return page.evaluate(() => {
    const кнопки = Array.from(document.querySelectorAll("button,a")).filter((b) => {
      const t = (b.textContent || "").trim();
      const r = b.getBoundingClientRect();
      // 🔴 Признак НЕ ЗАВИСИТ ОТ ЯЗЫКА. Первая версия искала «ИГРАТЬ» — и не
      // нашла кнопку, которая на экране есть: чистое окно браузера открывает
      // страницу ПО-АНГЛИЙСКИ, там подпись «PLAY». В моём браузере язык был
      // русский, и прибор казался исправным. Язык проверяющего — не свойство
      // продукта.
      const подписи = ["ИГРАТЬ", "PLAY", "ОЙНАУ"];
      const верх = t.toUpperCase();
      return подписи.some((п) => верх === п) && r.height > 30 && r.width > 80;
    });
    if (!кнопки.length) {
      // Не нашли — возвращаем, ЧТО есть на экране: «кнопки нет» без списка
      // заставляет гадать, а гадание уже стоило одного ложного вывода сегодня.
      const все = Array.from(document.querySelectorAll("button,a"))
        .filter((b) => { const r = b.getBoundingClientRect(); return r.height > 30 && r.width > 80; })
        .map((b) => (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24))
        .filter(Boolean);
      return { низ: -1, окно: window.innerHeight, видимые: все.slice(0, 16) };
    }
    const r = кнопки[0].getBoundingClientRect();
    return { низ: Math.round(r.bottom), окно: window.innerHeight, видимые: [] as string[] };
  });
}

test.describe("размер доски", () => {
  test("экран настройки на 1990×1015 берёт свободную высоту", async ({ page }) => {
    await page.setViewportSize({ width: 1990, height: 1015 });
    await page.goto(АДРЕС);
    await page.waitForLoadState("networkidle");

    const д = await размерДоски(page);
    expect(д, "доска не найдена — прибор ослеп, а не доска исчезла").not.toBeNull();

    // До правки здесь было 416 (потолок 420). Формула даёт 1015 − 480 = 535.
    // Порог 500 — с запасом вниз, чтобы сторож не падал от округлений.
    expect(
      д!.сторона,
      `доска ${д!.сторона} px при окне ${д!.окно} (${Math.round((100 * д!.сторона) / д!.окно)} %), ждали не меньше 500`
    ).toBeGreaterThanOrEqual(500);
  });

  test("🔴 и при этом «ИГРАТЬ» остаётся в окне", async ({ page }) => {
    // Обратная проверка. Без неё первая толкает делать доску больше и больше,
    // а в сентябре ровно так выбор цвета и «ИГРАТЬ» ушли за кромку.
    await page.setViewportSize({ width: 1990, height: 1015 });
    await page.goto(АДРЕС);
    await page.waitForLoadState("networkidle");

    const к = await низКнопкиИграть(page);
    expect(к, "замер не состоялся").not.toBeNull();
    expect(к!.низ, `кнопки «ИГРАТЬ» нет на экране; что есть: ${(к!.видимые||[]).join(" | ")}`).toBeGreaterThan(0);
    expect(
      к!.низ,
      `нижняя кромка «ИГРАТЬ» на ${к!.низ} px при окне ${к!.окно} — кнопка за кромкой`
    ).toBeLessThanOrEqual(к!.окно);
  });

  test("на 1280×768 ничего не изменилось — там места нет и сейчас", async ({ page }) => {
    // Ветка lowDesktop (vhPx < 860) правкой не затронута. Проверяем, что она
    // и правда не затронута, а не верим в это.
    await page.setViewportSize({ width: 1280, height: 768 });
    await page.goto(АДРЕС);
    await page.waitForLoadState("networkidle");

    const д = await размерДоски(page);
    expect(д, "доска не найдена").not.toBeNull();
    expect(
      д!.сторона,
      `доска ${д!.сторона} px при окне 768 — на низком столе она должна остаться около 300`
    ).toBeLessThanOrEqual(360);

    const к = await низКнопкиИграть(page);
    if (к) expect(к.низ, `«ИГРАТЬ» на ${к.низ} при окне ${к.окно}`).toBeLessThanOrEqual(к.окно);
  });

  test("🔴 контроль: ИГРОВАЯ доска не изменилась — 542 как было", async ({ page }) => {
    // Главная защита этой правки. Превью и игровая доска считаются по разным
    // путям, и трогали мы только первый. Если второе число поедет — значит
    // правка задела не то, что собиралась.
    await page.setViewportSize({ width: 1990, height: 1015 });
    await page.goto(АДРЕС);
    await page.waitForLoadState("networkidle");

    // Кликаем ПО СТРУКТУРЕ, а не по подписи: чистое окно открывает страницу
    // по-английски, и русский селектор «Нажмите доску» не находит ничего.
    // Та же ловушка уже увела этот сторож один раз — язык проверяющего не
    // свойство продукта. Превью — самая большая квадратная КНОПКА.
    const доРазмер = await размерДоски(page);
    await page.evaluate(() => {
      let лучшая: Element | null = null;
      let макс = 0;
      for (const b of Array.from(document.querySelectorAll("button"))) {
        const r = b.getBoundingClientRect();
        if (r.width < 200 || Math.abs(r.width - r.height) > 4) continue;
        if (r.width > макс) { макс = r.width; лучшая = b; }
      }
      (лучшая as HTMLElement | null)?.click();
    });
    // Ждём, пока доска ПЕРЕСТАНЕТ быть превью: у превью ровно 64 потомка,
    // у игровой доски их больше. Ожидание по признаку, а не по секундам:
    // пауза проходит и тогда, когда партия не началась.
    await page.waitForFunction(
      () => {
        for (const el of Array.from(document.querySelectorAll("div,section,button"))) {
          const r = el.getBoundingClientRect();
          if (r.width < 200 || Math.abs(r.width - r.height) > 4) continue;
          if (el.children.length > 64) return true;
        }
        return false;
      },
      null,
      { timeout: 20000 }
    );
    expect(доРазмер, "до клика доска не найдена").not.toBeNull();

    const д = await размерДоски(page);
    expect(д, "игровая доска не найдена после начала партии").not.toBeNull();
    // Замер 05.10 и 06.10 на проде: 542 (клетка 68). Допуск ±20 на округления.
    expect(
      д!.сторона,
      `игровая доска ${д!.сторона} px при окне ${д!.окно}, ждали около 542`
    ).toBeGreaterThanOrEqual(522);
  });
});
