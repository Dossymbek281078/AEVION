"use client";

import { useI18nOptional } from "@/lib/i18n";

/**
 * «Перейти к содержимому» — первая остановка обхода Tab на странице.
 *
 * Замер 02.09.2026 на проде: на страницах с общей шапкой человек без мыши
 * жмёт Tab ВОСЕМНАДЦАТЬ раз, прежде чем доберётся до содержимого, и так на
 * КАЖДОЙ странице. Ссылка снимает это одним нажатием.
 *
 * Почему не href="#main-content", как в smeta-trainer: замер тех же страниц
 * показал, что якоря с таким id нет НИ НА ОДНОЙ, а элемент <main> есть у 7
 * из 10. Ссылка с href на несуществующий якорь выглядит рабочей и не делает
 * ничего — это ровно тот молчаливый отказ, против которого правило §16.
 * Поэтому цель ищется при нажатии, и если её нет — переходим к первому
 * заголовку, а он есть везде.
 */
const LABELS: Record<string, string> = {
  ru: "Перейти к содержимому",
  en: "Skip to content",
  kk: "Мазмұнға өту",
  // 27.10.2026: саудовская волна — в ar-режиме ссылка была по-русски (запасной путь был ru).
  ar: "الانتقال إلى المحتوى",
};

/*
 * 27.10.2026 (замер Продаж, locale ar-SA, 390 px): «left: -9999px» в RTL растягивал документ
 * до 10389 px — страница ездила вбок на главной, /pricing и /verify. В LTR отрицательный left
 * не создаёт прокрутки, в RTL — создаёт. Поэтому прячем приёмом «визуально скрыто» (1×1 px,
 * clip), который не зависит от направления письма; при фокусе с Tab ссылка показывается в углу
 * по inset-inline-start — то есть в начале строки и в ru/en, и в ar.
 */
const СКРЫТО: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  top: 0,
  insetInlineStart: 0,
};
const ПОКАЗАНО: React.CSSProperties = {
  position: "fixed",
  width: "auto",
  height: "auto",
  overflow: "visible",
  clip: "auto",
  clipPath: "none",
  whiteSpace: "normal",
  top: 12,
  insetInlineStart: 12,
};

export default function SkipToContent() {
  // Вне провайдера (тесты, отдельная отрисовка) — русский, как и раньше.
  const lang = useI18nOptional()?.lang ?? "ru";
  const перейти = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const цель =
      document.getElementById("main-content") ||
      document.querySelector("main") ||
      document.querySelector("h1");
    if (!цель) return;
    const el = цель as HTMLElement;
    // Заголовок и <main> обычно не принимают фокус: даём его временно, иначе
    // страница прокрутится, а клавиатура останется в шапке — то есть ссылка
    // будет выглядеть сработавшей, ничего не изменив.
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    // Прокрутка не везде есть (jsdom, старые движки). Фокус уже переведён —
    // если прокрутка недоступна, ссылка обязана СРАБОТАТЬ, а не упасть.
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  return (
    <a
      href="#main-content"
      data-skip-to-content
      onClick={перейти}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") перейти(e);
      }}
      style={{
        ...СКРЫТО,
        zIndex: 200,
        padding: "10px 16px",
        borderRadius: 8,
        background: "#0f172a",
        color: "#fff",
        fontSize: 14,
        fontWeight: 600,
        textDecoration: "none",
      }}
      onFocus={(e) => {
        // Появляется только при фокусе: зрячему мышью она не нужна.
        Object.assign(e.currentTarget.style, ПОКАЗАНО);
      }}
      onBlur={(e) => {
        Object.assign(e.currentTarget.style, СКРЫТО);
      }}
    >
      {LABELS[lang] ?? LABELS.en}
    </a>
  );
}
