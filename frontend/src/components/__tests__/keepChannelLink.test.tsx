import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { KeepChannelLink } from "../KeepChannelLink";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { I18nProvider } from "@/lib/i18n";

/**
 * Метка канала переживает переход по ссылке из общих шапки и подвала.
 *
 * Замер 31.08.2026 в браузере на /en/go?c=yt: из 29 внутренних ссылок метку
 * несла ОДНА. Остальные 28 — общие шапка и подвал. Человек приходит с ролика,
 * жмёт ссылку в подвале, и любая покупка после этого приходит ниоткуда.
 *
 * Проверяется АДРЕС, по которому уходит браузер, а не наличие обёртки в коде.
 */

function at(search: string) {
  Object.defineProperty(window, "location", {
    value: { search, href: "", pathname: "/go" },
    writable: true,
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  at("");
});

describe("ссылка доносит метку канала", () => {
  test("метка из адреса переезжает на следующую страницу", () => {
    at("?c=yt");
    render(<KeepChannelLink href="/pricing">Цены</KeepChannelLink>);

    fireEvent.click(screen.getByText("Цены"));

    expect(window.location.href).toBe("/pricing?c=yt");
  });

  test("без метки ссылка остаётся обычной — хвоста не появляется", () => {
    render(<KeepChannelLink href="/pricing">Цены</KeepChannelLink>);

    fireEvent.click(screen.getByText("Цены"));

    expect(window.location.href).toBe("");
  });

  test("выдуманная метка дальше не едет", () => {
    at("?c=zzzz");
    render(<KeepChannelLink href="/pricing">Цены</KeepChannelLink>);

    fireEvent.click(screen.getByText("Цены"));

    expect(window.location.href).toBe("");
  });

  test("клик с Ctrl не перехватывается — это новая вкладка", () => {
    at("?c=yt");
    render(<KeepChannelLink href="/pricing">Цены</KeepChannelLink>);

    fireEvent.click(screen.getByText("Цены"), { ctrlKey: true });

    expect(window.location.href).toBe("");
  });

  test("подвал целиком пользуется этой ссылкой", () => {
    // Контроль охвата: одна ссылка мимо помощника — и дыра снова открыта.
    at("?c=yt");
    const { container } = render(<SiteFooter />);
    const внутр = [...container.querySelectorAll("a")].filter((a) =>
      (a.getAttribute("href") || "").startsWith("/"),
    );
    expect(внутр.length).toBeGreaterThanOrEqual(10);

    const мимо: string[] = [];
    for (const a of внутр) {
      window.location.href = "";
      fireEvent.click(a);
      if (window.location.href === "") мимо.push((a.textContent || "").trim().slice(0, 22));
    }
    expect(мимо, "ссылка подвала не доносит метку: оберните в KeepChannelLink").toEqual([]);
  });

  test("шапка целиком пользуется этой ссылкой", () => {
    // Тот же контроль охвата для шапки. Она стоит на КАЖДОЙ странице с общей
    // разметкой, поэтому её ссылки — самый частый переход на платформе: человек
    // с ролика жмёт «Pricing» в меню, а не ссылку в тексте.
    //
    // Внешняя ссылка на openapi.json из выборки исключена намеренно: она уходит
    // на другой домен в новую вкладку, метка каналов там не наша.
    // Шапка публикует свою высоту через ResizeObserver (чтобы прилипающие полосы
    // разделов вставали под неё, а не под неё же сверху). В jsdom его нет —
    // подставляем пустышку: измеряем мы ссылки, а не вёрстку.
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    at("?c=yt");
    const { container } = render(<I18nProvider><SiteHeader /></I18nProvider>);
    const внутр = [...container.querySelectorAll("a")].filter((a) =>
      (a.getAttribute("href") || "").startsWith("/"),
    );
    expect(внутр.length).toBeGreaterThanOrEqual(10);

    const мимо: string[] = [];
    for (const a of внутр) {
      window.location.href = "";
      fireEvent.click(a);
      if (window.location.href === "") мимо.push((a.getAttribute("href") || "").slice(0, 22));
    }
    expect(мимо, "ссылка шапки не доносит метку: оберните в KeepChannelLink").toEqual([]);
  });
});
