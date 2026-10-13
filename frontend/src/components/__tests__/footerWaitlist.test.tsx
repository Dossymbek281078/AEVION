import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { footerWaitlistSource, hasOtherEmailField, FooterWaitlist } from "../FooterWaitlist";
import { I18nProvider } from "@/lib/i18n";

/**
 * Блок приёма адреса в подвале ставится ради страниц БЕЗ своего поля
 * (замер 20.09.2026: 12 из 15 страниц очереди постов). Два требования, и оба
 * проверяются в обе стороны: на голой странице он появляется, на странице со
 * своим полем — нет. Второе важнее: две формы об одном хуже одной.
 */
let путь = "/qsign";
vi.mock("next/navigation", () => ({ usePathname: () => путь }));

describe("источник подписки называет страницу", () => {
  it("путь попадает в source, главная называется home", () => {
    expect(footerWaitlistSource("/qsign")).toBe("footer-qsign");
    expect(footerWaitlistSource("/")).toBe("footer-home");
    expect(footerWaitlistSource(null)).toBe("footer-home");
  });

  it("длинный путь режется до 60 знаков — схема сервера длиннее не примет", () => {
    const длинный = "/" + "a".repeat(200);
    expect(footerWaitlistSource(длинный).length).toBe(60);
    // КОНТРОЛЬ: короткий путь НЕ режется, иначе проверка выше проходила бы всегда.
    expect(footerWaitlistSource("/qsign").length).toBeLessThan(60);
    // Разделитель обязан быть дефисом: по нему реестр писем находит модуль.
    expect(footerWaitlistSource("/build/success-stories")).toBe("footer-build-success-stories");
  });
});

describe("чужое поле почты распознаётся", () => {
  it("видит чужое поле и не считает своим", () => {
    const корень = document.createElement("div");
    корень.innerHTML = '<div id="moy"><input type="email" /></div><input type="email" id="chuzhoe" />';
    const моё = корень.querySelector("#moy")!;
    expect(hasOtherEmailField(корень, моё), "чужое поле не замечено").toBe(true);
  });

  it("КОНТРОЛЬ: когда чужих полей нет — false, даже если своё есть", () => {
    const корень = document.createElement("div");
    корень.innerHTML = '<div id="moy"><input type="email" /></div>';
    expect(hasOtherEmailField(корень, корень.querySelector("#moy")!)).toBe(false);
  });
});

describe("блок появляется там, где приёма адреса ещё нет", () => {
  beforeEach(() => { путь = "/qsign"; document.body.innerHTML = ""; });

  it("на странице без своего поля блок появляется", async () => {
    vi.useFakeTimers();
    render(<FooterWaitlist />);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByTestId("footer-waitlist")).not.toBeNull());
  });

  it("на странице со СВОИМ полем блок не рисуется", async () => {
    const чужое = document.createElement("input");
    чужое.type = "email";
    document.body.appendChild(чужое);
    vi.useFakeTimers();
    render(<FooterWaitlist />);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByTestId("footer-waitlist")).toBeNull());
    expect(screen.queryByTestId("footer-waitlist-idle")).not.toBeNull();
  });
});

describe("🔴 подвал на /en/… говорит по-английски сам — включая placeholder, который слой перевода не трогает", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  async function поле(адрес: string) {
    путь = адрес;
    vi.useFakeTimers();
    render(<FooterWaitlist />);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByTestId("footer-waitlist")).not.toBeNull());
    const input = document.querySelector('input[type="email"]') as HTMLInputElement;
    const button = document.querySelector("button") as HTMLButtonElement;
    return { placeholder: input.placeholder, button: button.textContent ?? "" };
  }

  it("/en/devhub (туда ведут пять каталогов): placeholder и кнопка английские", async () => {
    const р = await поле("/en/devhub");
    expect(р.placeholder).toBe("you@example.com");
    expect(р.button).toBe("Notify me");
    expect(/[а-яА-ЯёЁ]/.test(р.placeholder + р.button)).toBe(false);
  });

  it("КОНТРОЛЬ: /devhub без префикса — прежний русский", async () => {
    const р = await поле("/devhub");
    expect(р.placeholder).toBe("вы@почта.рф");
    expect(р.button).toBe("Сообщить мне");
  });

  it("явный lang старше адреса", async () => {
    путь = "/en/devhub";
    vi.useFakeTimers();
    render(<FooterWaitlist lang="ru" />);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByTestId("footer-waitlist")).not.toBeNull());
    expect((document.querySelector('input[type="email"]') as HTMLInputElement).placeholder).toBe("вы@почта.рф");
  });
});

describe("🔴 115б: без префикса /en язык подвала — тот же, что у страницы (i18n), а не русский по умолчанию", () => {
  beforeEach(() => { document.body.innerHTML = ""; try { localStorage.clear(); } catch {} });

  async function полеВПровайдере(адрес: string, сохранённыйЯзык: string) {
    путь = адрес;
    localStorage.setItem("aevion_lang_v1", сохранённыйЯзык);
    vi.useFakeTimers();
    render(<I18nProvider><FooterWaitlist /></I18nProvider>);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByTestId("footer-waitlist")).not.toBeNull());
    const input = document.querySelector('input[type="email"]') as HTMLInputElement;
    return { placeholder: input.placeholder, button: (document.querySelector("button") as HTMLButtonElement).textContent ?? "" };
  }

  it("/devhub (куда ведут каталоги) у англоязычного гостя: you@example.com и Notify me", async () => {
    const р = await полеВПровайдере("/devhub", "en");
    expect(р.placeholder).toBe("you@example.com");
    expect(р.button).toBe("Notify me");
  });

  it("КОНТРОЛЬ: тот же /devhub у русскоязычного — русский", async () => {
    const р = await полеВПровайдере("/devhub", "ru");
    expect(р.placeholder).toBe("вы@почта.рф");
    expect(р.button).toBe("Сообщить мне");
  });
});
