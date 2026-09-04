import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEVHUB_GUEST_HEADER,
  getDevhubGuestId,
  isDevhubApiUrl,
  withGuestHeader,
  installDevhubGuestHeader,
  rotateDevhubGuestId,
} from "../devhubGuest";

const GUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("идентификатор гостя", () => {
  test("заводится и переживает второй вызов — иначе черновики терялись бы при каждом заходе", () => {
    const first = getDevhubGuestId();
    expect(first).toMatch(GUEST_ID);
    expect(getDevhubGuestId()).toBe(first);
  });

  test("испорченное сохранённое значение заменяется годным", () => {
    window.localStorage.setItem("devhub_guest_id", "нет");
    const id = getDevhubGuestId();
    expect(id).toMatch(GUEST_ID);
    expect(id).not.toBe("нет");
  });

  test("недоступное хранилище не роняет страницу, а возвращает null", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockImplementation(() => {
      throw new Error("приватный режим");
    });
    expect(getDevhubGuestId()).toBeNull();
  });
});

describe("какие адреса помечаются", () => {
  test("ручки DevHub — да, в обеих формах адреса", () => {
    expect(isDevhubApiUrl("https://api.aevion.app/api/devhub/projects")).toBe(true);
    expect(isDevhubApiUrl("https://aevion.app/api-backend/api/devhub/projects/1/files")).toBe(true);
    expect(isDevhubApiUrl(new URL("https://api.aevion.app/api/devhub/projects"))).toBe(true);
    expect(isDevhubApiUrl({ url: "https://api.aevion.app/api/devhub/snippets" })).toBe(true);
  });

  test("посторонние запросы не трогаются — отрицательный контроль", () => {
    for (const u of [
      "https://api.aevion.app/api/auth/login",
      "https://api.aevion.app/api/pricing/trust",
      "https://aevion.app/_next/static/chunk.js",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(isDevhubApiUrl(u), `адрес ${JSON.stringify(u)} помечен зря`).toBe(false);
    }
  });
});

describe("склейка заголовков", () => {
  test("свой заголовок добавляется, чужие остаются — все три формы записи", () => {
    const shapes: RequestInit[] = [
      { headers: { "Content-Type": "application/json" } },
      { headers: [["Content-Type", "application/json"]] },
      { headers: new Headers({ "Content-Type": "application/json" }) },
    ];
    for (const init of shapes) {
      const h = new Headers(withGuestHeader(init, "abcdefgh").headers as HeadersInit);
      expect(h.get("Content-Type"), "потерялся заголовок вызывающего").toBe("application/json");
      expect(h.get(DEVHUB_GUEST_HEADER)).toBe("abcdefgh");
    }
  });

  test("остальные поля запроса не теряются", () => {
    const out = withGuestHeader({ method: "POST", body: "тело", cache: "no-store" }, "abcdefgh");
    expect(out.method).toBe("POST");
    expect(out.body).toBe("тело");
    expect(out.cache).toBe("no-store");
  });
});

describe("перехватчик на месте", () => {
  let restore: () => void = () => {};
  let seen: Array<{ url: string; header: string | null }> = [];

  beforeEach(() => {
    seen = [];
    window.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        url: String(input),
        header: new Headers(init?.headers as HeadersInit | undefined).get(DEVHUB_GUEST_HEADER),
      });
      return new Response("{}", { status: 200 });
    }) as typeof window.fetch;
    restore = installDevhubGuestHeader();
  });
  afterEach(() => restore());

  test("запрос к DevHub уходит с идентификатором", async () => {
    await window.fetch("https://api.aevion.app/api/devhub/projects");
    expect(seen[0].header, "заголовок не доехал — бэкенд снова увидит общий ящик").toMatch(GUEST_ID);
  });

  test("посторонний запрос уходит как был", async () => {
    await window.fetch("https://api.aevion.app/api/auth/login", { method: "POST" });
    expect(seen[0].header).toBeNull();
  });

  test("два запроса подряд несут ОДИН и тот же идентификатор", async () => {
    await window.fetch("https://api.aevion.app/api/devhub/projects");
    await window.fetch("https://api.aevion.app/api/devhub/snippets");
    expect(seen[0].header).toBe(seen[1].header);
  });

  test("после смены личности заголовок несёт НОВУЮ", async () => {
    // Личность меняется после того, как гостевая работа переехала в аккаунт.
    // Перехватчик брал её ОДИН раз при установке, поэтому до перезагрузки
    // страницы уходила бы прежняя — а выход из аккаунта страницу не
    // перезагружает. Тогда новая гостевая работа легла бы на уже разобранную
    // личность и снова пропала бы при следующем входе.
    await window.fetch("https://api.aevion.app/api/devhub/projects");
    const было = seen[0].header;
    const новая = rotateDevhubGuestId();
    expect(новая, "смена личности не удалась — проверять нечего").toMatch(GUEST_ID);

    await window.fetch("https://api.aevion.app/api/devhub/projects");
    expect(seen[1].header, "заголовок несёт прежнюю личность, а она уже принадлежит аккаунту")
      .toBe(новая);
    expect(seen[1].header, "личность вообще не изменилась — проба ничего не проверила")
      .not.toBe(было);
  });

  test("откат возвращает исходный fetch", async () => {
    restore();
    await window.fetch("https://api.aevion.app/api/devhub/projects");
    expect(seen[0].header).toBeNull();
    restore = () => {};
  });
});
