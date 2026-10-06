import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Page from "../../example/page";

/**
 * Короткий вход /example не стирает входящую метку канала.
 *
 * 🔴 НАЙДЕНО 06.10.2026. Первая редакция перенаправляла безусловно на
 * /devhub?c=example, то есть /example?c=yt-devhub-opishi теряла «yt». Ролик
 * user-10 уже стоит именно с такой ссылкой — все его переходы легли бы в канал
 * «example», и ответ на вопрос «дал ли ролик людей» пропал бы. Тот же класс, что
 * потеря ?c=post: 37 постов мерили воронку в никуда.
 *
 * Проверяется ПОВЕДЕНИЕ: страница зовётся и перехватывается перенаправление.
 * redirect() из next/navigation бросает ошибку с полем digest, в котором лежит
 * адрес, — его и разбираем. Сторож по исходнику здесь был бы слабее: он не
 * отличил бы «метку сохраняем» от «метку сохраняем, но не ту».
 */
async function кудаВедёт(c?: string): Promise<string> {
  try {
    await Page({ searchParams: Promise.resolve(c === undefined ? {} : { c }) });
  } catch (e: unknown) {
    const d = String((e as { digest?: unknown })?.digest ?? "");
    const части = d.split(";");
    const адрес = части.find((ч) => ч.startsWith("/"));
    if (адрес) return адрес;
    throw new Error("перенаправление не разобрано: " + d);
  }
  throw new Error("страница не перенаправила вовсе");
}

describe("вход /example и метка канала", () => {
  it("прибор исправен: без метки ведёт на /devhub c example", async () => {
    expect(await кудаВедёт()).toBe("/devhub?c=example");
  });

  it("годная входящая метка ДОЕЗЖАЕТ, а не подменяется на example", async () => {
    // Именно этот вид ссылки стоит в ролике.
    const адрес = await кудаВедёт("yt");
    expect(адрес, `входящая метка потеряна: ${адрес}`).toContain("c=yt");
    expect(адрес, "метка подменена на example").not.toContain("c=example");
  });

  it("ещё две метки — чтобы не оказалось, что работает одна", async () => {
    expect(await кудаВедёт("tg")).toContain("c=tg");
    expect(await кудаВедёт("li")).toContain("c=li");
  });

  it("НЕИЗВЕСТНАЯ метка не доезжает — иначе в учёт попадёт мусор", async () => {
    // Контроль в обратную сторону: keepChannel проверяет метку по каталогу
    // CHANNELS, и чужое значение не должно превращаться в канал.
    expect(await кудаВедёт("takoj-metki-net-12345")).toBe("/devhub?c=example");
  });

  it("обещание на входе не называет СРОК — срок не сбывается у всех", () => {
    /*
     * Замеры 05–06.10: путь зрителя 55, 55, 60, 77, 82 с, и один прогон из шести
     * без адреса за 120 с. «Примерно за минуту» не сбывалось ни в одном прогоне.
     */
    const файл = readFileSync(join(__dirname, "..", "i18n.ts"), "utf8");
    const подсказки = [...файл.matchAll(/"hero\.mode\.hint": "([^"]+)"/g)].map((m) => m[1]);
    expect(подсказки.length, "подсказок найдено не три — сторож смотрит не туда").toBe(3);
    // Прибор-контроль: детектор обязан находить срок в заведомо срочной фразе.
    const СРОК = /минут|minute|секунд|second|мину́т|бір минут/i;
    expect(СРОК.test("выходит примерно за минуту"), "детектор срока не работает").toBe(true);
    for (const t of подсказки) {
      expect(СРОК.test(t), `обещание на входе называет срок: «${t.slice(0, 70)}»`).toBe(false);
    }
  });
});
