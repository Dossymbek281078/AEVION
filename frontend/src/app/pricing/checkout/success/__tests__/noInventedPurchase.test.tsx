import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

/**
 * Экран после оплаты не выдумывает, ЧТО человек купил.
 *
 * Замер 31.08.2026 в браузере: на голом адресе страница писала «Pro
 * активирован!» и предлагала «Открыть QRight →». Проверено по коду всех
 * четырёх касс — параметр appId не кладёт НИ ОДНА, то есть ссылку на QRight
 * видел каждый покупатель, включая заплативших за QSign или QLearn. Тариф
 * теряется реже: у PayBox в адрес возврата уходит ref, и покупатель Lite из
 * Казахстана читал «Pro активирован».
 *
 * 🔴 04.09.2026: ЭТОТ СТОРОЖ ПРОВЕРЯЛ НЕ ТО, ЧТО ОБЕЩАЛ ИМЕНЕМ.
 *
 * Утверждения искали подстроку `titleActivated`, а совпадала она с ключом
 * АБЗАЦА — `subtitleActivated`, потому что «sub» + «title» содержит «title».
 * Заголовок при этом не проверялся ни разу: он и тогда был закрыт условием
 * `confirmed === true`, а в прогоне подтверждения нет, и там всегда стоял
 * `titlePending`. Сторож был зелёным по случайности.
 *
 * Вскрылось, когда абзац получил собственную осторожную ветку и случайное
 * совпадение исчезло. Поэтому здесь теперь: ключи сравниваются С ПРЕФИКСОМ
 * (`checkoutSuccess.titleActivated` в `checkoutSuccess.subtitleActivated` не
 * входит), а подтверждение сервера задаётся явно — иначе проверять заголовок
 * невозможно в принципе.
 */

let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/checkout/success",
}));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock("@/lib/track", () => ({ track: vi.fn() }));

// eslint-disable-next-line import/first
import Success from "../page";

/** Сервер отвечает про права: `plan` — то, что он реально видит за человеком. */
function серверОтвечает(plan: string | null) {
  vi.stubGlobal("fetch", () =>
    Promise.resolve({ ok: plan !== null, json: async () => ({ plan }) } as unknown as Response),
  );
}

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function экран(query: string) {
  params = new URLSearchParams(query);
  const { container } = render(<Success />);
  // Ключ С ПРЕФИКСОМ, а не голый `titlePending`: `subtitlePending` содержит
  // его подстрокой, и ожидание срабатывало бы на абзаце. На этой же ловушке
  // мутация поймала меня через три теста после того, как я про неё написал.
  // Ждём ответа сервера: до него страница осознанно осторожна, и проверять
  // заголовок в этот момент значило бы мерить промежуточное состояние.
  await waitFor(() => expect(container.textContent).not.toContain("checkoutSuccess.titlePending"), { timeout: 2000 });
  return {
    текст: container.textContent || "",
    ссылки: [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") || ""),
  };
}

describe("после оплаты не выдумываем покупку", () => {
  test("контроль: подтверждение сервера доходит до экрана", async () => {
    // Без этого все проверки ниже могли бы держаться на том, что страница
    // просто не дождалась ответа и осталась в осторожном состоянии.
    серверОтвечает("lite");
    const { текст } = await экран("tier=lite");
    expect(текст, "экран не вышел из состояния ожидания").toContain("checkoutSuccess.titleActivated");
  });

  test("без тарифа — не называем тариф", async () => {
    серверОтвечает("lite");
    const { текст } = await экран("");
    expect(текст, "тариф не назван обезличенно").toContain("checkoutSuccess.titleActivatedNoTier");
    expect(текст, "назван тариф, которого мы не знаем").not.toContain("checkoutSuccess.subtitleActivated\"");
  });

  test("тариф известен и подтверждён — называем его", async () => {
    серверОтвечает("lite");
    const { текст } = await экран("tier=lite");
    expect(текст).toContain("checkoutSuccess.titleActivated");
    expect(текст, "тариф известен, а страница говорит обезличенно").not.toContain("titleActivatedNoTier");
  });

  test("сервер не подтвердил — тариф не называем вовсе", async () => {
    // Находка 04.09: `?tier=Zolotoy` попадал на экран как подтверждённый.
    // Теперь до подтверждения экран говорит только «оплата принята».
    серверОтвечает(null);
    params = new URLSearchParams("tier=Zolotoy");
    const { container } = render(<Success />);
    await waitFor(() => expect(container.textContent).toContain("checkoutSuccess.titlePending"), { timeout: 2000 });
    expect(container.textContent, "название из адреса показано как подтверждённое").not.toContain("Zolotoy");
  });

  test("без продукта — ведём в каталог, а не в случайный модуль", async () => {
    серверОтвечает("lite");
    const { текст, ссылки } = await экран("tier=lite");
    expect(текст, "назван продукт, которого мы не знаем").toContain("openAppNoName");
    expect(ссылки, "ссылка ведёт в конкретный модуль вместо каталога").toContain("/apps");
    expect(ссылки).not.toContain("/qright");
  });

  test("продукт известен — называем его", async () => {
    серверОтвечает("lite");
    const { текст, ссылки } = await экран("tier=lite&appId=qlearn");
    expect(текст).toContain("openApp");
    expect(текст).not.toContain("openAppNoName");
    expect(ссылки).toContain("/qlearn");
  });
});
