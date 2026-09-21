import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { footerWaitlistSource, hasOtherEmailField, FooterWaitlist } from "../FooterWaitlist";

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
