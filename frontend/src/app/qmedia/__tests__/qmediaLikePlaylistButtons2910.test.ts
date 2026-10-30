import { describe, test, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 29.10.2026 (окно «Приложения»): кнопки «лайк» и «в плейлист» зовут настоящие ручки бэка
 * (routes/qmedia.ts: POST /:type/:id/like, GET /me/playlists, POST /me/playlists/:id/tracks).
 * Отказ — не молчит: результат ok:false с кодом (кнопка показывает текст) и строка в журнал (reportError).
 */
const reportError = vi.fn();
vi.mock("@/lib/reporter", () => ({ reportError: (...a: unknown[]) => reportError(...a) }));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => `https://api.test${p}` }));

// eslint-disable-next-line import/first
import { likeTrack, likeResource, addToPlaylist, myPlaylists, actErrorKey, LikeButton } from "../TrackActions";
// eslint-disable-next-line import/first
import { QMEDIA_DICT, VIDEO_CATS } from "../i18n";

const ответ = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => reportError.mockReset());

describe("QMedia: кнопки лайка и плейлиста зовут ручки бэка", () => {
  test("лайк: POST /api/qmedia/track/:id/like, ответ liked доходит до кнопки", async () => {
    const f = ответ(200, { liked: true });
    expect(await likeTrack(f as unknown as typeof fetch, "t-1")).toEqual({ ok: true, liked: true });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/api/qmedia/track/t-1/like");
    expect(init.method).toBe("POST");
    expect(reportError).not.toHaveBeenCalled();
  });

  test("в плейлист: POST /api/qmedia/me/playlists/:id/tracks с телом { trackId }", async () => {
    const f = ответ(200, { id: "p-1", trackIds: ["t-1"] });
    expect(await addToPlaylist(f as unknown as typeof fetch, "p-1", "t-1")).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/api/qmedia/me/playlists/p-1/tracks");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ trackId: "t-1" });
  });

  test("мои плейлисты: GET /api/qmedia/me/playlists, ответ { items }", async () => {
    const f = ответ(200, { items: [{ id: "p-1", name: "smoke" }] });
    expect(await myPlaylists(f as unknown as typeof fetch)).toEqual({ ok: true, items: [{ id: "p-1", name: "smoke" }] });
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://api.test/api/qmedia/me/playlists");
  });

  test("отказ не молчит: код наружу + строка в журнал; 401 → «войдите», прочее → «не удалось сохранить»", async () => {
    for (const [st, ключ] of [[401, "err.signInToLike"], [503, "err.saveFailed"]] as const) {
      reportError.mockReset();
      const r = await likeTrack(ответ(st, { error: "x" }) as unknown as typeof fetch, "t-1");
      expect(r).toEqual({ ok: false, status: st });
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(actErrorKey(st)).toBe(ключ);
    }
    reportError.mockReset();
    const сеть = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    expect(await addToPlaylist(сеть as unknown as typeof fetch, "p-1", "t-1")).toEqual({ ok: false, status: 0 });
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  test("подписи кнопок на ru/en/kk через словарь; кнопки стоят в списке треков", () => {
    for (const lang of ["ru", "en", "kk"]) for (const k of ["act.like", "act.liked", "act.toPlaylist", "act.choosePlaylist", "act.noPlaylists", "act.added", "err.signInToLike"] as const)
      expect(QMEDIA_DICT[lang]![k]!.trim(), `${lang}:${k}`).not.toBe("");
    const music = readFileSync(join(process.cwd(), "src/app/qmedia/music/page.tsx"), "utf8");
    expect(music).toContain("<TrackActions trackId={tr.id} />");
  });

  test("лайк видео: POST /api/qmedia/video/:id/like; кнопка стоит на карточке видео", async () => {
    const f = ответ(200, { liked: true });
    expect(await likeResource(f as unknown as typeof fetch, "video", "v-1")).toEqual({ ok: true, liked: true });
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://api.test/api/qmedia/video/v-1/like");
    const videos = readFileSync(join(process.cwd(), "src/app/qmedia/videos/page.tsx"), "utf8");
    expect(videos).toContain("<LikeButton type=\"video\" id={v.id} />");
  });

  test("кнопка видео при нажатии зовёт ручку ВИДЕО (рендер + клик), отказ 401 показывает текст", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ liked: true }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const { render, screen, fireEvent, waitFor, cleanup } = await import("@testing-library/react");
    const { createElement } = await import("react");
    render(createElement(LikeButton, { type: "video", id: "v-7" }));
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://api.test/api/qmedia/video/v-7/like");
    await waitFor(() => expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true"));
    cleanup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    render(createElement(LikeButton, { type: "video", id: "v-8" }));
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).not.toBe(""));
    cleanup();
    vi.unstubAllGlobals();
  });

  test("категории видео: форма и фильтр берут один список; у каждой подпись на ru/en/kk", () => {
    for (const ф of ["upload/page.tsx", "videos/page.tsx"]) {
      const s = readFileSync(join(process.cwd(), "src/app/qmedia", ф), "utf8");
      expect(s, ф).toContain("VIDEO_CATS");
      expect(s, ф).not.toMatch(/\[[^\]]*"(shortfilm|short-film|music-video|documentary)"/); // свой список категорий — только VIDEO_CATS
      expect(s, ф).not.toContain(`"shortfilm"`);
    }
    expect(readFileSync(join(process.cwd(), "src/app/qmedia/videos/page.tsx"), "utf8")).toContain(`const CATEGORIES = ["all", ...VIDEO_CATS];`);
    for (const lang of ["ru", "en", "kk"]) for (const c of VIDEO_CATS) expect(QMEDIA_DICT[lang]![`vcat.${c}` as never], `${lang}:${c}`).toBeTruthy();
  });
});
