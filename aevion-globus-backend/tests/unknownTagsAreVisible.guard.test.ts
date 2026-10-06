import { describe, it, expect } from "vitest";
import { разрезВоронки, безопаснаяМетка, чужаяМетка, этоПробаОкна, разобратьСессии } from "../src/routes/events";

/**
 * Чужие метки обязаны быть видны поимённо — и безопасно.
 *
 * Замер 05.10.2026: канал «unknown» дал 37 заходов за 14 дней, 19 из них на
 * /cyberchess. Все наши опубликованные метки каталог знает, значит это метки
 * внешних площадок. Пока они сложены в одно слово, мы знаем, что люди пришли,
 * и не знаем откуда: ни поблагодарить площадку, ни повторить успех.
 *
 * Вторая сторона важнее первой: ответ публичный, без токена. Поэтому значение
 * метки обеззараживается, а всё, что похоже на адрес или на человека, сюда не
 * попадает вовсе.
 */
const визит = (channel: string, path: string, sid: string) => ({
  type: "page_view" as const,
  path,
  sid,
  meta: { channel },
});

describe("разрез по чужим меткам", () => {
  it("неизвестная метка попадает в разрез поимённо", () => {
    const р = разрезВоронки([
      визит("unknown", "/cyberchess?c=toolify", "s1"),
      визит("unknown", "/pricing?c=toolify", "s1"),
    ]);
    expect(р.byUnknownTag["toolify"], "чужая метка не видна — разрез пуст").toEqual({
      visits: 1,
      pricing: 1,
    });
  });

  it("КОНТРОЛЬ: известный канал в разрез НЕ попадает", () => {
    const р = разрезВоронки([визит("youtube", "/cyberchess?c=yt-abc", "s2")]);
    expect(Object.keys(р.byUnknownTag), "распознанный канал уехал в чужие метки").toEqual([]);
    expect(р.byChannel["youtube"]?.visits, "и при этом сам канал не посчитан").toBe(1);
  });

  it("КОНТРОЛЬ: визиты считаются по сессиям, а не по страницам", () => {
    const р = разрезВоронки([
      визит("unknown", "/a?c=site", "s3"),
      визит("unknown", "/b?c=site", "s3"),
      визит("unknown", "/c?c=site", "s4"),
    ]);
    expect(р.byUnknownTag["site"].visits, "одна вкладка посчитана несколько раз").toBe(2);
  });

  it("🔴 мусор в метке экранируется, а не уезжает в публичный ответ", () => {
    const р = разрезВоронки([
      визит("unknown", `/x?c=${encodeURIComponent('<script>alert(1)</script>')}`, "s5"),
    ]);
    const ключи = Object.keys(р.byUnknownTag);
    expect(ключи.length).toBe(1);
    expect(ключи[0], "в публичный ответ уехали угловые скобки").not.toContain("<");
    expect(ключи[0], "уехали кавычки или скобки").not.toMatch(/[()'"]/);
  });

  it("кириллица и длина: заменяется и обрезается", () => {
    expect(безопаснаяМетка("Каталог")).toBe("???????");
    expect(безопаснаяМетка("a".repeat(60)).length, "метка длиннее 40 знаков").toBe(40);
    expect(безопаснаяМетка("Tool.ify_2-x"), "законные знаки не должны теряться").toBe("tool.ify_2-x");
  });

  it("ref-метка площадки читается наравне с c", () => {
    expect(чужаяМетка("unknown", "/en/devhub?ref=producthunt")).toBe("producthunt");
    expect(чужаяМетка("unknown", "/en/devhub"), "метки нет — и записи быть не должно").toBeNull();
    expect(чужаяМетка("product-hunt", "/en/devhub?ref=producthunt"), "распознанный канал").toBeNull();
  });

  it("🔴 наш заход с ?probe= не идёт в живые числа, но метку сохраняет", () => {
    /*
     * Замер 05.10.2026: окно данных зашло с `?c=mail-ai3&probe=40`, чтобы
     * проверить разрез по постам, и воронка посчитала его живым человеком —
     * признак «наше» читал только метку канала вида `probe-*`. Проверочный
     * заход обязан сохранять настоящую метку, иначе проверять нечего.
     */
    const пробы = new Set(["sp"]);
    const р = разрезВоронки(
      [
        {
          type: "page_view" as const,
          path: "/cyberchess?c=mail-ai3&probe=40",
          sid: "sp",
          meta: { channel: "mail-outreach", post: "ai3" },
        },
      ],
      new Set(),
      пробы,
    );
    const строка = р.byPost["mail-outreach/ai3"];
    expect(строка, "метка потеряна — проверять стало нечего").toBeTruthy();
    expect(строка.visits, "заход не посчитан вовсе").toBe(1);
    expect(строка.visitsProbe, "проверочный заход не помечен пробой").toBe(1);
    expect(строка.visits - строка.visitsProbe, "проверочный заход попал в живые").toBe(0);
  });

  it("КОНТРОЛЬ: такой же заход БЕЗ probe= остаётся живым", () => {
    const р = разрезВоронки([
      {
        type: "page_view" as const,
        path: "/cyberchess?c=mail-ai3",
        sid: "sl",
        meta: { channel: "mail-outreach", post: "ai3" },
      },
    ]);
    const строка = р.byPost["mail-outreach/ai3"];
    expect(строка.visits - строка.visitsProbe, "живой заход записан пробой").toBe(1);
  });

  it("единица byPost — сессии, как у канала (а не просмотры)", () => {
    const р = разрезВоронки([
      {
        type: "page_view" as const,
        path: "/cyberchess?c=ig-post3",
        sid: "s9",
        meta: { channel: "instagram", post: "post3" },
      },
      {
        type: "page_view" as const,
        path: "/pricing",
        sid: "s9",
        meta: { channel: "instagram", post: "post3" },
      },
    ]);
    expect(р.byPost["instagram/post3"].visits, "посчитаны просмотры, а не сессии").toBe(1);
    expect(р.byChannel["instagram"].visits, "канал обязан считать так же").toBe(1);
  });

  it("🔴 признак пробы окна отделён от признака «наше»", () => {
    // Первая версия этого набора проверяла только потребление готового
    // множества сессий, и мутация «убрать примету probe=» выжила.
    // Проверяем сам признак, а не его последствие.
    expect(этоПробаОкна("/cyberchess?c=mail-ai3&probe=40"), "примета probe= не видна").toBe(true);
    expect(этоПробаОкна("/cyberchess?c=mail-ai3"), "живой заход объявлен пробой").toBe(false);
    expect(этоПробаОкна("/cyberchess"), "заход без меток объявлен пробой").toBe(false);
    // Старая примета «наше» — ПРО ДРУГОЕ (попытки оплаты) и сюда не относится.
    expect(этоПробаОкна("/pricing?c=probe-price"), "признак пробы захватил чужой вопрос").toBe(false);
  });

  it("🔴 сбор сессий из журнала разделяет пробы и наши оплаты", () => {
    // Проверяем САМ сбор, а не разрез, которому множество передают готовым:
    // именно на этом месте мутация «убрать примету» выживала дважды.
    const журнал = [
      JSON.stringify({ type: "page_view", sid: "p1", path: "/cyberchess?c=mail-ai3&probe=40" }),
      JSON.stringify({ type: "page_view", sid: "o1", path: "/pricing?c=probe-price" }),
      JSON.stringify({ type: "page_view", sid: "l1", path: "/cyberchess?c=mail-ai3" }),
      "мусорная строка, не json",
    ].join(String.fromCharCode(10));
    const { нашиСессии, пробыОкон } = разобратьСессии(журнал);
    expect([...пробыОкон], "проверочный заход не попал в пробы").toEqual(["p1"]);
    expect([...нашиСессии], "наша попытка оплаты не распознана").toEqual(["o1"]);
    expect(пробыОкон.has("l1"), "живой заход записан пробой").toBe(false);
    expect(нашиСессии.has("l1"), "живой заход записан нашим").toBe(false);
  });

  it("КОНТРОЛЬ: отдаются не больше 20 меток", () => {
    const события = Array.from({ length: 30 }, (_, i) => визит("unknown", `/x?c=m${i}`, `s${i}`));
    const р = разрезВоронки(события);
    expect(Object.keys(р.byUnknownTag).length).toBe(20);
  });
});
