"use client";

import { usePathname } from "next/navigation";
import { englishHref } from "@/lib/englishPages";

/** Путь английской половины сайта: /en или /en/… (но не /energy). */
export function isEnglishPath(путь: string | null | undefined): boolean {
  const п = String(путь ?? "");
  return п === "/en" || п.startsWith("/en/");
}

/**
 * Адрес для внутренней ссылки общей шапки и подвала.
 * 30.10.2026: на /en/devhub «Pricing» вёл на русский /pricing (curl прода f2db0ee93).
 * На /en/* ссылка остаётся английской: у цели своя /en-страница — /en/…, нет —
 * ?lang=en. На прочих путях адрес не меняется.
 */
export function navHrefFor(путь: string | null | undefined, href: string): string {
  if (!isEnglishPath(путь)) return href;
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  if (isEnglishPath(href) || /[?&]lang=/.test(href)) return href;
  // у «/» своей /en-страницы нет (app/en/page.tsx отсутствует) — получится /?lang=en
  return englishHref(href);
}

export function useNavHref(): (href: string) => string {
  const путь = usePathname();
  return (href) => navHrefFor(путь, href);
}
