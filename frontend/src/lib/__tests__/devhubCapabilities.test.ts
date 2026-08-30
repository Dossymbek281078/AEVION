import { describe, it, expect } from "vitest";
import { indexCapabilities, isCapabilityBlocked, capabilityHint } from "../devhubCapabilities";

const LIVE_SHAPE = [
  { id: "railway", name: "Railway Deploy", status: "live", token: "RAILWAY_API_TOKEN" },
  { id: "vercel", name: "Vercel Deploy", status: "needs_token", token: "VERCEL_API_TOKEN" },
  { id: "pages", name: "Cloudflare Pages Deploy", status: "live", tokens: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] },
  { id: "video", name: "Video Generation", status: "needs_token", token: "REPLICATE_API_TOKEN" },
];

describe("devhubCapabilities", () => {
  it("indexes the live /studio/capabilities payload by id", () => {
    const idx = indexCapabilities(LIVE_SHAPE);
    expect(idx.vercel.status).toBe("needs_token");
    expect(Object.keys(idx)).toHaveLength(4);
    expect(indexCapabilities(null)).toEqual({});
    // Junk entries never become keys.
    expect(indexCapabilities([{ id: undefined } as never, { id: "ok" }])).toEqual({ ok: { id: "ok" } });
  });

  it("blocks only what the server explicitly reports as not live", () => {
    const idx = indexCapabilities(LIVE_SHAPE);
    expect(isCapabilityBlocked(idx, "vercel")).toBe(true);
    expect(isCapabilityBlocked(idx, "railway")).toBe(false);
    expect(isCapabilityBlocked(idx, "pages")).toBe(false);
  });

  it("fails open when capabilities are unknown or not loaded yet", () => {
    // A wrongly disabled button hides a working feature — worse than a 503.
    expect(isCapabilityBlocked(null, "vercel")).toBe(false);
    expect(isCapabilityBlocked({}, "vercel")).toBe(false);
    expect(isCapabilityBlocked(indexCapabilities([{ id: "vercel" }]), "vercel")).toBe(false);
  });

  // Раньше здесь проверялось обратное — что подсказка НАЗЫВАЕТ переменные
  // окружения, и строка была закреплена дословно. Проверка охраняла дефект:
  // эту строку видел покупатель, нажавший недоступную кнопку в платном
  // модуле (на проде vercel = needs_token). Тест переписан вместе с
  // поведением, потому что сам по себе он был доказательством «работает как
  // задумано» для того, что задумано неверно.
  it("не показывает покупателю имена серверных переменных", () => {
    const idx = indexCapabilities(LIVE_SHAPE);
    const hint = capabilityHint(idx, "vercel", "Выкатка на Vercel");
    expect(hint).not.toContain("VERCEL_API_TOKEN");
    expect(hint).not.toContain("env");
    expect(hint).toContain("канал пока не подключён");
    expect(capabilityHint(idx, "video", "Генерация видео")).not.toContain("REPLICATE_API_TOKEN");
  });

  it("называет рабочую замену там, где она есть", () => {
    // Сообщение «нельзя» без «а можно вот так» честное, но бесполезное.
    const idx = indexCapabilities(LIVE_SHAPE);
    expect(capabilityHint(idx, "vercel", "Выкатка на Vercel")).toContain("Cloudflare Pages");
    // Там, где замены нет, ничего не выдумываем.
    const noAlt = indexCapabilities([{ id: "image", status: "needs_token", token: "OPENAI_API_KEY" }]);
    expect(capabilityHint(noAlt, "image", "Картинки")).toBe(
      "Картинки: канал пока не подключён на нашей стороне."
    );
  });

  it("доступная возможность остаётся просто подписью", () => {
    const idx = indexCapabilities(LIVE_SHAPE);
    // Live capability keeps its plain label; unknown ones do too (fail open).
    expect(capabilityHint(idx, "railway", "Выкатка на Railway")).toBe("Выкатка на Railway");
    expect(capabilityHint(null, "vercel", "Выкатка на Vercel")).toBe("Выкатка на Vercel");
  });

  it("uses the capability ids the backend actually emits", () => {
    // A typo here fails open (silently does nothing), so the ids the IDE asks
    // for are pinned against the list in devhub.ts /studio/capabilities.
    const BACKEND_IDS = [
      "code", "github", "railway", "vercel", "pages", "domain",
      // "3d" заведён 28.08.2026: страница обещает 3D среди возможностей «в одном
      // проекте», а в списке его не было, и интерфейс спрашивал про него под
      // идентификатором "video" — то есть панель о 3D молчала.
      "video", "3d", "image", "screenshot_code", "audio_tts", "audio_music",
      "email", "sms", "whatsapp",
    ];
    const USED_BY_IDE = ["railway", "vercel", "pages", "video", "3d", "image", "audio_tts", "audio_music"];
    for (const id of USED_BY_IDE) expect(BACKEND_IDS).toContain(id);
  });

  it("несколько переменных — наружу не уходит ни одна", () => {
    const idx = indexCapabilities([
      { id: "domain", status: "needs_token", tokens: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ZONE_ID"] },
    ]);
    const hint = capabilityHint(idx, "domain", "Свой домен");
    for (const t of ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ZONE_ID"]) {
      expect(hint, `наружу ушло имя ${t}`).not.toContain(t);
    }
    expect(hint).toBe("Свой домен: канал пока не подключён на нашей стороне.");
  });
});
