import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ToastProvider";

/**
 * 🔴 /auth ПРИ lang=en — БЕЗ ЕДИНОГО РУССКОГО УЗЛА.
 *
 * Замер 30.10.2026 на проде (390 и 1280): https://aevion.app/auth?lang=en для
 * английского посетителя шёл по-русски — h1 «Вход в AEVION», подзаголовок
 * «Один аккаунт на все модули…», подпись «Почта», блок «Что открывает аккаунт
 * AEVION» (14 узлов с кириллицей), и рядом английская кнопка «Create account».
 * Часть страницы шла через словарь, часть — литералами; доводчик AutoTranslate
 * переводит только то, что есть в словаре. Это ПЕРВЫЙ экран регистрации для
 * английского канала: каждый русский узел здесь — потерянный человек.
 *
 * Сторож рендерит страницу под провайдером, как её видит браузер при ?lang=en,
 * и ищет кириллицу в видимом тексте И в атрибутах (placeholder, aria-label,
 * title) — доводчик атрибуты не трогает. Контроль прибора: при lang=ru те же
 * узлы русские, то есть детектор кириллицы видит то, что должен.
 */

vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/PipelineSteps", () => ({ PipelineSteps: () => null }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// eslint-disable-next-line import/first
import AuthPage from "../page";

const КИРИЛЛИЦА = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;

function withSearch(search: string) {
  Object.defineProperty(window, "location", {
    value: new URL("https://aevion.app/auth" + search) as unknown as Location,
    writable: true,
  });
}

/** Страница на старте тянет список способов входа — отдаём пустой, как бэк без OAuth. */
function stubFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ providers: [] }),
  } as unknown as Response);
}

/**
 * Текстовые узлы и атрибуты, где кириллица была бы видна человеку или читалке.
 * Узел за узлом, а не склеенный textContent: тогда в падении видно, КАКАЯ строка русская.
 */
function видимоеИАтрибуты(): string[] {
  const куски: string[] = [];
  // Корень — <main> страницы, не body: всплывающие сообщения рисует общий
  // ToastProvider (components/), а не /auth; у его кнопки «×» aria-label
  // «Закрыть: …» по-русски на любом языке — это отдельная дыра общего компонента,
  // замечена 30.10.2026 этим сторожем, чинится в своём месте.
  const корень = document.querySelector("main") ?? document.body;
  const walker = document.createTreeWalker(корень, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const родитель = n.parentElement?.tagName;
    if (родитель === "SCRIPT" || родитель === "STYLE") continue;
    const s = (n.textContent ?? "").trim();
    if (s) куски.push(s);
  }
  for (const el of Array.from(корень.querySelectorAll<HTMLElement>("[placeholder],[aria-label],[title]"))) {
    for (const a of ["placeholder", "aria-label", "title"]) {
      const v = el.getAttribute(a);
      if (v) куски.push(`${a}=${v}`);
    }
  }
  return куски;
}

function русскиеУзлы(): string[] {
  return видимоеИАтрибуты().filter((s) => КИРИЛЛИЦА.test(s));
}

/** Страница отрисована: три поля формы регистрации на месте (контроль прибора, не пустота). */
async function дождатьсяФормы() {
  await waitFor(() => expect(document.body.querySelectorAll("input").length).toBe(3));
}

function отрисовать() {
  return render(
    <I18nProvider>
      <ToastProvider>
        <AuthPage />
      </ToastProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* пусто */ }
});

describe("/auth при lang=en говорит по-английски", () => {
  it("🔴 регистрация: заголовок, поля, кнопка и блок «что открывает аккаунт» — без кириллицы", async () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("?lang=en");
    отрисовать();
    await дождатьсяФормы();
    // Контроль прибора: страница действительно отрисована целиком, а не пустая.
    expect(screen.getAllByRole("button").length).toBeGreaterThan(2);
    expect(document.body.textContent ?? "").toContain("AEVION");
    expect(русскиеУзлы(), "русские узлы на английской странице регистрации").toEqual([]);
    expect(document.body.textContent ?? "").toContain("Create account");
  });

  it("🔴 вход: вкладка, «забыли пароль», подсказки проверки почты и пароля — без кириллицы", async () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("?lang=en");
    отрисовать();
    await дождатьсяФормы();
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    const [email, password] = Array.from(document.body.querySelectorAll("input"));
    fireEvent.change(email, { target: { value: "ab" } });
    fireEvent.change(password, { target: { value: "abc" } });
    // Подсказки проверки появились (контроль: детектор смотрит не на пустоту).
    await waitFor(() => expect(document.getElementById("email-hint")?.textContent ?? "").not.toBe(""));
    expect(document.body.textContent ?? "").toContain("Forgot your password?");
    expect(русскиеУзлы(), "русские узлы на английской странице входа").toEqual([]);
  });

  it("🔴 ошибка входа с бэка показывается по-английски, не русской заглушкой", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).includes("/oauth/providers")) {
        return { ok: true, status: 200, json: async () => ({ providers: [] }) } as unknown as Response;
      }
      return { ok: false, status: 401, json: async () => ({}) } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    withSearch("?lang=en");
    отрисовать();
    await дождатьсяФормы();
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    const [email, password] = Array.from(document.body.querySelectorAll("input"));
    fireEvent.change(email, { target: { value: "person@example.com" } });
    fireEvent.change(password, { target: { value: "secret12" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/auth/login"))).toBe(true));
    await waitFor(() => expect(document.body.textContent ?? "").toContain("Couldn't sign in"));
    expect(русскиеУзлы(), "русские узлы после ошибки входа").toEqual([]);
  });

  it("контроль прибора: при lang=ru те же узлы русские", async () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("?lang=ru");
    отрисовать();
    // Русский словарь приезжает отдельным куском (loadDict) — под нагрузкой
    // параллельных файлов дольше секунды по умолчанию; ждём до пяти.
    await waitFor(() => expect(document.body.textContent ?? "").toContain("Вход в AEVION"), { timeout: 5000 });
    expect(document.body.textContent ?? "").toContain("Что открывает аккаунт AEVION");
    // Заголовок, подзаголовок, вкладки, подписи полей, кнопка, 13 узлов блока — больше 20.
    expect(русскиеУзлы().length).toBeGreaterThan(20);
  });
});
