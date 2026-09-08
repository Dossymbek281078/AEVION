import { chromium } from "playwright";
const BASE = process.env.QS_BASE || "http://127.0.0.1:3062";
const say = (ok, s) => { console.log(`${ok ? "OK " : "НЕТ"} ${s}`); if (!ok) process.exitCode = 1; };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 180)));
await p.goto(BASE + "/qspace", { waitUntil: "networkidle" });
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(2500);

const shot = async () => (await p.locator("canvas").screenshot()).toString("base64");
const boxes = p.locator('section[aria-label="Слои модели"] input[type="checkbox"]');

// 1. ГЛАВНОЕ: третий слой на ПЕРВОМ заходе больше не пуст
const was = await shot();
await boxes.nth(2).click(); await p.waitForTimeout(1000);
say(was !== (await shot()), "слой «Декор и мебель» меняет картинку при первом заходе");
await boxes.nth(2).click(); await p.waitForTimeout(800);

// контроль: без переключения картинка совпадает сама с собой
const a1 = await shot(); await p.waitForTimeout(800);
say(a1 === (await shot()), "контроль: сравнение снимков честное");

// 2. подпись слоя называет число предметов
const label = (await boxes.nth(2).evaluate((e) => e.closest("label").innerText)).trim();
say(/—\s*\d+/.test(label), `подпись слоя называет число предметов: «${label}»`);

// 3. панель кондиционирования на месте и считает
const txt = await p.locator("main").innerText();
say(/Кондиционирование/.test(txt), "раздел кондиционирования есть на странице");
say(/(«семёрка»|«девятка»|«двенашка»|«восемнадцать»|«двадцать четыре»)/.test(txt),
    "подобран конкретный типоразмер, а не пустая таблица");
say(/Всего холода/.test(txt) && /кВт/.test(txt), "суммарная мощность показана в кВт");

// 4. страница не встречает гостя своими же замечаниями
say(!/стоит перед дверью|заходит в стену|налезает/.test(txt),
    "демо не показывает собственных замечаний о расстановке");

// 5. чертёж по-прежнему скачивается
const dl = p.waitForEvent("download", { timeout: 20000 });
await p.getByRole("button", { name: /Чертёж сверху/ }).click();
say(/\.svg$/.test((await dl).suggestedFilename()), "чертёж скачивается");

say(errs.length === 0, `исключений на странице: ${errs.length}${errs[0] ? " :: " + errs[0] : ""}`);
await b.close();
