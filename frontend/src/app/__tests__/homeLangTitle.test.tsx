import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";

/**
 * 🔴 ГЛАВНАЯ: <title> И lang — НА ЯЗЫКЕ ГОСТЯ, КАК И h1.
 *
 * Замер Науки 1.11.2026 (прод dc4a968f8, curl): при Accept-Language ru/kk h1 шёл на
 * языке гостя, а <title> и lang="en" оставались английскими. Здесь: generateMetadata
 * отдаёт заголовок по языку запроса (ru/en/kk, прочие → en), а страница первым
 * узлом ставит скрипт, объявляющий lang на <html> до первого кадра.
 */

const lang = { value: "ru" as string };
vi.mock("@/lib/serverLang", () => ({ serverLang: async () => lang.value }));
vi.mock("../_home", () => ({ default: () => null }));

// eslint-disable-next-line import/first
import Page, { generateMetadata } from "../page";

async function metaFor(l: string) {
  lang.value = l;
  return generateMetadata();
}

function заголовок(m: Awaited<ReturnType<typeof generateMetadata>>): string {
  const t = m.title as { absolute?: string } | string | null | undefined;
  return typeof t === "string" ? t : (t?.absolute ?? "");
}

describe("главная: title и lang по языку гостя", () => {
  it("ru → русский заголовок, описание и og:title", async () => {
    const m = await metaFor("ru");
    expect(заголовок(m)).toMatch(/^AEVION — [а-яё]/i);
    expect(заголовок(m)).toMatch(/[а-яё]/i);
    expect(String(m.description)).toMatch(/[а-яё]/i);
    expect(String((m.openGraph as { title?: string })?.title)).toMatch(/[а-яё]/i);
    expect((m.alternates as { canonical?: string })?.canonical).toBe("/");
  });

  it("kk → казахский заголовок (есть буквы ә/і/ң/қ/ұ)", async () => {
    const m = await metaFor("kk");
    expect(заголовок(m)).toMatch(/[әіңқұүөғ]/i);
  });

  it("en → английский, без кириллицы; прочие языки (de) падают в en", async () => {
    const en = await metaFor("en");
    expect(заголовок(en)).toBe("AEVION — Trust infrastructure for digital assets & IP");
    expect(заголовок(en)).not.toMatch(/[а-яё]/i);
    const de = await metaFor("de");
    expect(заголовок(de)).toBe(заголовок(en));
  });

  it("первый узел страницы — скрипт с языком сервера, объявляющий lang до кадра", async () => {
    lang.value = "kk";
    const tree = (await Page()) as ReactElement<{ lang: string; children: ReactElement[] }>;
    expect(tree.props.lang).toBe("kk");
    // первый ребёнок — серверный компонент HtmlLangScript; раскрываем его в <script>
    const узел = tree.props.children[0] as ReactElement<{ lang: string }>;
    expect(typeof узел.type).toBe("function");
    const first = (узел.type as (p: { lang: string }) => ReactElement)(узел.props) as ReactElement<{ "data-home-lang": string; dangerouslySetInnerHTML: { __html: string } }>;
    expect(first.type).toBe("script");
    expect(first.props["data-home-lang"]).toBe("kk");
    const js = first.props.dangerouslySetInnerHTML.__html;
    expect(js).toContain('D.lang="kk"');
    // выбор человека (cookie/path) старше: скрипт не трогает уже проставленный источник
    expect(js).toContain("data-lang-src");
    expect(js).toContain('"server"');
    expect(() => new Function(js)).not.toThrow();
  });
});
