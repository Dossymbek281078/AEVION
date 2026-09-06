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
        position: "absolute",
        left: "-9999px",
        top: 0,
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
        e.currentTarget.style.left = "12px";
        e.currentTarget.style.top = "12px";
        e.currentTarget.style.position = "fixed";
      }}
      onBlur={(e) => {
        e.currentTarget.style.left = "-9999px";
        e.currentTarget.style.position = "absolute";
      }}
    >
      {LABELS[lang] ?? LABELS.ru}
    </a>
  );
}
