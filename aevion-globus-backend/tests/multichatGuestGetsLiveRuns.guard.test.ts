// Гость получает ЖИВОЙ консилиум — два раза, потом вход.
//
// ЗАМЕР 28.09.2026 живым браузером: у гостя кнопка «Спросить консилиум»
// выключена, работает только пример с записанными заранее ответами. Человек,
// пришедший по ролику, видел чужой опыт и уходил, не попробовав своего
// вопроса, — при цене $40 в месяц. Польза должна идти раньше цены.
//
// Проверяется ТА ЖЕ функция, которую зовёт index.ts, а не копия правила.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  решениеПоГостю,
  засчитатьГостю,
  остатокГостя,
  гостевойПуть,
  сброситьСчётГостей,
  гостевойЛимит,
} from "../src/lib/multichatGuestPass";

function запрос(opts: { method?: string; path: string; ip?: string; вошёл?: boolean }) {
  return {
    method: opts.method ?? "POST",
    path: opts.path,
    ip: opts.ip ?? "203.0.113.7",
    headers: {},
    body: {},
    get: () => undefined,
    ...(opts.вошёл ? { auth: { sub: "user_42" } } : {}),
  } as never;
}

const СОХРАНЁН = process.env.MULTICHAT_GUEST_FREE_PER_DAY;
beforeEach(() => { сброситьСчётГостей(); delete process.env.MULTICHAT_GUEST_FREE_PER_DAY; });
afterEach(() => {
  if (СОХРАНЁН === undefined) delete process.env.MULTICHAT_GUEST_FREE_PER_DAY;
  else process.env.MULTICHAT_GUEST_FREE_PER_DAY = СОХРАНЁН;
});

describe("бесплатный консилиум для гостя", () => {
  it("прибор видит предмет: норма по умолчанию — два запроса", () => {
    expect(гостевойЛимит()).toBe(2);
    expect(остатокГостя(запрос({ path: "/conversations" })).осталось).toBe(2);
  });

  it("открыты ровно два вызова: завести разговор и веер по нему", () => {
    expect(гостевойПуть("POST", "/conversations")).toBe(true);
    expect(гостевойПуть("POST", "/conversations/abc/dispatch")).toBe(true);
    expect(гостевойПуть("POST", "/conversations/abc/share"), "поделиться — не гостевое").toBe(false);
    expect(гостевойПуть("GET", "/conversations"), "чтение чужих разговоров — не гостевое").toBe(false);
    expect(гостевойПуть("POST", "/search")).toBe(false);
  });

  it("гостя пускают, пока норма есть, и перестают, когда кончилась", () => {
    const req = запрос({ path: "/conversations/c1/dispatch" });
    expect(решениеПоГостю(req).пускать).toBe(true);
    засчитатьГостю(req);
    expect(решениеПоГостю(req).пускать).toBe(true);
    засчитатьГостю(req);
    expect(решениеПоГостю(req).пускать, "третий запрос прошёл бесплатно").toBe(false);
    expect(остатокГостя(req).осталось).toBe(0);
  });

  // ПОПРАВКА после мутации: сторож проверял список путей ОТДЕЛЬНОЙ функцией,
  // и удаление той же проверки из решения проходило незамеченным. Теперь
  // негостевые вызовы спрашиваются через РЕШЕНИЕ — то есть через боевой путь.
  it("решение само отсекает негостевые вызовы, а не надеется на список", () => {
    expect(решениеПоГостю(запрос({ path: "/conversations/c1/share" })).пускать,
      "поделиться разговором прошло бесплатно").toBe(false);
    expect(решениеПоГостю(запрос({ method: "GET", path: "/conversations" })).пускать,
      "чтение чужих разговоров прошло бесплатно").toBe(false);
    expect(решениеПоГостю(запрос({ path: "/search" })).пускать).toBe(false);
  });

  it("норма тратится на веере, а не на создании пустого разговора", () => {
    expect(решениеПоГостю(запрос({ path: "/conversations" })).тратить).toBe(false);
    expect(решениеПоГостю(запрос({ path: "/conversations/c1/dispatch" })).тратить).toBe(true);
  });

  it("вошедшего эта дверь не касается — он идёт обычным путём", () => {
    const req = запрос({ path: "/conversations/c1/dispatch", вошёл: true });
    expect(решениеПоГостю(req).пускать).toBe(false);
  });

  it("счёт ведётся по адресу: сосед не тратит чужую норму", () => {
    const первый = запрос({ path: "/conversations/c1/dispatch", ip: "198.51.100.1" });
    const второй = запрос({ path: "/conversations/c1/dispatch", ip: "198.51.100.2" });
    засчитатьГостю(первый);
    засчитатьГостю(первый);
    expect(решениеПоГостю(первый).пускать).toBe(false);
    expect(решениеПоГостю(второй).пускать, "чужой адрес получил чужой отказ").toBe(true);
  });
});
