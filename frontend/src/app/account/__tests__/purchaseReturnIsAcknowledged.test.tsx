import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AccountPage from "../page";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ToastProvider";

/**
 * Вернувшийся из кассы видит подтверждение — и ровно такое, какое заслужено.
 *
 * Замер 29.08.2026: после оплаты человек не возвращался НИКУДА — в ссылках
 * кассы нет адреса возврата, страниц «спасибо» нет (/thanks, /thank-you,
 * /success дают 404). Настройка возврата делается в кабинете поставщика, но
 * без этой правки она была бы бесполезна: `/account` не читала параметры
 * адреса ВООБЩЕ и встретила бы покупателя так же, как любого другого.
 *
 * Договор: касса возвращает на `/account?purchased=<id модуля>`.
 *
 * ⚠️ ВТОРАЯ РЕДАКЦИЯ, в тот же вечер. Первая проверяла, что при метке в адресе
 * появляется «Спасибо за покупку» — и была зелёной на коде, который говорил это
 * ВСЯКОМУ, кто дописал `?purchased=` руками. Страница отвечала за кассу, ничего
 * не проверив: тот самый класс «утверждение об успехе без основания», который
 * мы вычищаем по всей платформе, только в моём собственном коде.
 *
 * Теперь текст зависит от того, нашлось ли право у нас, и проверяются ОБЕ
 * ветки. Это заодно и ответ на вопрос «почему тест покраснел»: он покраснел
 * справедливо — поведение изменилось, и в лучшую сторону.
 */

/**
 * Список купленного запрашивается ТОЛЬКО когда известна почта вошедшего
 * (page.tsx: `if (email) { fetch("/api/apps/access") }`), а сама страница
 * читает токен из localStorage. Без этих двух условий ветка «право
 * подтверждено» не выполняется вовсе — и первая редакция теста этого не
 * учитывала: она проверяла ветку, до которой не доходила.
 */
function stubFetch(apps: string[] = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ apps, user: { email: "buyer@test.aev", name: "Buyer" } }),
  } as unknown as Response);
}

function signedIn() {
  try { localStorage.setItem("aevion_auth_token_v1", "test-token"); } catch { /* окружение без хранилища */ }
}

function withSearch(search: string) {
  const url = "https://aevion.app/account" + search;
  Object.defineProperty(window, "location", {
    value: new URL(url) as unknown as Location,
    writable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* пусто */ }
});

describe("возврат из кассы подтверждается", () => {
  it("контроль прибора: без метки страница ведёт себя как раньше", async () => {
    vi.stubGlobal("fetch", stubFetch());
    withSearch("");
    render(<I18nProvider><ToastProvider><AccountPage /></ToastProvider></I18nProvider>);
    await waitFor(() => expect(document.body.textContent ?? "").toContain("Account"));
    const text = document.body.textContent ?? "";
    expect(text, "подтверждение показано без покупки").not.toContain("Спасибо за покупку");
    expect(text, "приветствие возврата показано без возврата").not.toContain("Возвращаемся из кассы");
  });

  it("право подтверждено — благодарим уверенно", async () => {
    signedIn();
    vi.stubGlobal("fetch", stubFetch(["cyberchess"]));
    withSearch("?purchased=cyberchess");
    render(<I18nProvider><ToastProvider><AccountPage /></ToastProvider></I18nProvider>);
    await waitFor(() => {
      expect(document.body.textContent ?? "", "покупателя встретили как обычного посетителя")
        .toContain("Спасибо за покупку");
    });
  });

  it("права ещё нет — говорим, что ждём, а не что оплата принята", async () => {
    // Ключевая проверка. Метку в адрес кладёт касса, но переписать её может
    // кто угодно, и вебхук в любом случае приходит с задержкой. Утверждать
    // «оплата принята», не увидев права, — обещание за чужой счёт.
    vi.stubGlobal("fetch", stubFetch([]));
    withSearch("?purchased=cyberchess");
    render(<I18nProvider><ToastProvider><AccountPage /></ToastProvider></I18nProvider>);
    await waitFor(() => {
      expect(document.body.textContent ?? "").toContain("Возвращаемся из кассы");
    });
    const text = document.body.textContent ?? "";
    expect(text, "страница подтвердила покупку, которой у неё нет")
      .not.toContain("Спасибо за покупку");
    expect(text, "утверждение об оплате без основания").not.toContain("Оплата принята");
  });

  it("регистр в метке не мешает узнать покупку", async () => {
    signedIn();
    vi.stubGlobal("fetch", stubFetch(["cyberchess"]));
    withSearch("?purchased=CyberChess");
    render(<I18nProvider><ToastProvider><AccountPage /></ToastProvider></I18nProvider>);
    await waitFor(() => {
      expect(document.body.textContent ?? "").toContain("Спасибо за покупку");
    });
  });
});
