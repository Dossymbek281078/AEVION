import { describe, expect, test, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WaitlistCapture } from "../WaitlistCapture";

// Единственная точка сбора адресов — 19.08.2026.
//
// ЗАЧЕМ. Этот компонент стоит на главной, на /go, на посадочных патентного бюро,
// шахмат, DevHub и мультичата — шесть страниц и все запуски осени идут через
// него. Тестов на него не было ни одного. Дефект здесь не «страница выглядит
// плохо», а «адреса не собрались», и заметить это можно только по пустой
// выгрузке через недели.
//
// Проверяется ровно то, от чего зависит результат: уходит ли запрос, что именно в
// нём, и понимает ли человек отказ. Текст сообщений намеренно разный на каждый
// класс отказа — «что-то пошло не так» не говорит, повторять попытку или
// исправлять адрес.

const ORIGINAL_FETCH = globalThis.fetch;

function stubFetch(status: number) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fn = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    return Promise.resolve({ ok: status >= 200 && status < 300, status } as Response);
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

beforeEach(() => {
  vi.stubGlobal("fetch", ORIGINAL_FETCH);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillAndSubmit(email: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox"), email);
  await user.click(screen.getByRole("button"));
}

describe("WaitlistCapture — что уходит на сервер", () => {
  test("адрес и метка источника доезжают в теле запроса", async () => {
    const calls = stubFetch(201);
    render(<WaitlistCapture source="multichat-instagram" />);
    await fillAndSubmit("kto@primer.ru");

    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0].url).toMatch(/\/api\/constitution\/waitlist\/subscribe$/);
    expect(calls[0].body).toEqual({ email: "kto@primer.ru", source: "multichat-instagram" });
  });

  test("источник обрезается до 60 символов — столько принимает ручка", async () => {
    // Сервер режет source по slice(0, 60). Если бы клиент отправлял больше,
    // метка приезжала бы обрубленной, и группировка в выгрузке ломалась бы
    // молча.
    const calls = stubFetch(201);
    render(<WaitlistCapture source={"x".repeat(200)} />);
    await fillAndSubmit("kto@primer.ru");

    await waitFor(() => expect(calls.length).toBe(1));
    expect((calls[0].body as { source: string }).source).toHaveLength(60);
  });

  test("после успеха поле очищается — иначе второй адрес не введёшь", async () => {
    stubFetch(201);
    render(<WaitlistCapture source="devhub" />);
    await fillAndSubmit("kto@primer.ru");

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
  });
});

describe("WaitlistCapture — неверный адрес не доходит до сервера", () => {
  // Здесь два РАЗНЫХ рубежа, и первая версия теста их путала.
  //
  // Поле объявлено как type="email", поэтому браузер отклоняет явно неверное
  // сам, ещё до нашего обработчика: сообщения компонента в этом случае не будет
  // вовсе, и ждать его — ошибка теста, а не дефект. Проверять надо то, что
  // важно: запрос не ушёл.
  //
  // Собственная проверка компонента ловит то, что браузер пропускает, — она
  // строже: требует домен верхнего уровня от двух символов и локальную часть до
  // 64. Вот на таких адресах и должно появляться человеческое объяснение.

  test.each(["без-собаки", "две@@собаки.ру", "нет@точки"])(
    "«%s» не уходит на сервер (отсекает браузер)",
    async (bad) => {
      const calls = stubFetch(201);
      render(<WaitlistCapture source="devhub" />);
      await fillAndSubmit(bad);
      expect(calls.length).toBe(0);
    },
  );

  test.each([
    ["a@b.c", "домен верхнего уровня в один символ"],
    // Латиница намеренно: кириллический адрес jsdom отклоняет сам (для него это
    // невалидный type="email"), и до нашей проверки дело не доходит — тогда
    // тест проверял бы браузер, а не компонент.
    [`${"a".repeat(65)}@mail.ru`, "локальная часть длиннее 64 символов"],
  ])("«%s» браузер пропускает, а компонент объясняет: %s", async (bad) => {
    const calls = stubFetch(201);
    render(<WaitlistCapture source="devhub" />);
    await fillAndSubmit(bad);

    expect(calls.length).toBe(0);
    expect(await screen.findByText(/опечатка/i)).toBeTruthy();
  });
});

describe("WaitlistCapture — отказ объяснён так, чтобы человек знал, что делать", () => {
  test("429: сказано подождать, а не «ошибка»", async () => {
    stubFetch(429);
    render(<WaitlistCapture source="devhub" />);
    await fillAndSubmit("kto@primer.ru");
    expect(await screen.findByText(/подождите минуту/i)).toBeTruthy();
  });

  test("400: сказано проверить написание", async () => {
    stubFetch(400);
    render(<WaitlistCapture source="devhub" />);
    await fillAndSubmit("kto@primer.ru");
    expect(await screen.findByText(/проверьте написание/i)).toBeTruthy();
  });

  test("500: названо нашей стороной, а не виной человека", async () => {
    // Иначе человек будет править верный адрес и уйдёт, решив, что дело в нём.
    stubFetch(500);
    render(<WaitlistCapture source="devhub" />);
    await fillAndSubmit("kto@primer.ru");
    expect(await screen.findByText(/на нашей стороне/i)).toBeTruthy();
  });

  test("сеть отвалилась: тоже понятный текст, а не тишина", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("ECONNRESET"))));
    render(<WaitlistCapture source="devhub" />);
    await fillAndSubmit("kto@primer.ru");
    // Проверять надо САМ ТЕКСТ, а не наличие кнопки: первая версия этого теста
    // спрашивала только про кнопку и поле, и мутация «оставить сообщение пустым»
    // её НЕ покраснела — то есть тест с названием «а не тишина» тишину разрешал.
    const said = await screen.findByText(/связь|сервер/i);
    expect(said.textContent?.trim().length).toBeGreaterThan(15);
    // Адрес остаётся в поле: иначе человеку набирать заново то, что он уже вводил.
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("kto@primer.ru"));
  });
});

describe("читаемость на телефоне", () => {
  test("условие подписки не мельче 13px", () => {
    // Замер в браузере при ширине 390 (iPhone) 19.08.2026: горизонтального выхода
    // за экран нет, поле адреса 50px и кнопка 47px — выше порога касания 44px. Но
    // САМЫМ мелким содержательным текстом на странице оказалось именно условие
    // подписки (12.5px) — то есть строка, объясняющая, на что человек подписывается.
    // Мельче только надзаголовки в 11px, но те читают взглядом, а не построчно.
    render(<WaitlistCapture source="test" promise="Письмо приходит на запуск модуля." />);
    const el = screen.getByText(/Письмо приходит на запуск модуля/);
    const size = parseFloat((el as HTMLElement).style.fontSize || "0");
    expect(size, "условие подписки стало мельче 13px").toBeGreaterThanOrEqual(13);
  });
});

describe("подписка сообщает канал привлечения", () => {
  /*
   * До 31.08.2026 в запросе было только поле source — «с какой страницы».
   * Про покупки мы знали канал, про подписчиков нет, хотя список для запуска и
   * есть главный актив воронки: по нему решают, куда вкладывать силы.
   *
   * Канал идёт ОТДЕЛЬНЫМ полем: дописывать его в source нельзя — тот разбирает
   * рассылка (метки через запятую), и лишнее значение развело бы письма не туда.
   */
  test("метка из адреса уходит вместе с адресом почты", async () => {
    window.history.replaceState({}, "", "/go?c=tg");
    const calls = stubFetch(201);
    render(<WaitlistCapture source="go" />);
    await fillAndSubmit("kto@primer.ru");

    await waitFor(() => expect(calls.length).toBe(1));
    const body = calls[0].body as Record<string, unknown>;
    expect(body.channel, "канал не доехал до учёта").toBeTruthy();
    expect(body.source, "источник подменён каналом").toBe("go");
  });

  test("без метки поля нет — пустое значение хуже отсутствия", async () => {
    window.history.replaceState({}, "", "/go");
    const calls = stubFetch(201);
    render(<WaitlistCapture source="go" />);
    await fillAndSubmit("kto2@primer.ru");

    await waitFor(() => expect(calls.length).toBe(1));
    expect(Object.keys(calls[0].body as object)).not.toContain("channel");
  });

  test("выдуманная метка в учёт не едет", async () => {
    window.history.replaceState({}, "", "/go?c=zzzz");
    const calls = stubFetch(201);
    render(<WaitlistCapture source="go" />);
    await fillAndSubmit("kto3@primer.ru");

    await waitFor(() => expect(calls.length).toBe(1));
    expect(Object.keys(calls[0].body as object)).not.toContain("channel");
  });
});
