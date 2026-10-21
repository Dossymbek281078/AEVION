import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * Переход из письма на /verify/<certId>?c=mail-… обязан стать визитом в воронке.
 *
 * Повод 21.10.2026 (замер Продаж, [Точно]): письма волн 12–13 ведут первой
 * ссылкой на страницу сертификата, а визит не записывался — после захода на
 * главную он был, после захода на /verify нет. Причина: PageTracking стоял на
 * главной, /proof, /bureau, но не в разделе /verify.
 *
 * Трекер здесь НЕ подменяется: проверяем то, что реально уходит в ручку
 * /api/pricing/events — адрес, тип, страницу, канал и пост письма. Подменён
 * только транспорт (sendBeacon), чтобы поймать тело запроса.
 */

// eslint-disable-next-line import/first
import VerifyLayout from "../layout";

type Ушло = { url: string; body: Record<string, unknown> };
let ушло: Ушло[] = [];

async function тело(b: BodyInit): Promise<Record<string, unknown>> {
  const text = typeof b === "string" ? b : await (b as Blob).text();
  return JSON.parse(text);
}

beforeEach(() => {
  try {
    sessionStorage.clear();
  } catch {
    // приватный режим — хранилища нет
  }
  ушло = [];
  const pending: Promise<void>[] = [];
  (globalThis as { __pending?: Promise<void>[] }).__pending = pending;
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: (url: string, b: BodyInit) => {
      pending.push(тело(b).then((body) => void ушло.push({ url, body })));
      return true;
    },
  });
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

async function визиты() {
  await Promise.all((globalThis as { __pending?: Promise<void>[] }).__pending ?? []);
  return ушло.filter((e) => e.body.type === "page_view");
}

describe("/verify считает визит из письма", () => {
  test("заход по ссылке письма уходит в /api/pricing/events с каналом и постом", async () => {
    window.history.replaceState({}, "", "/verify/cert-9c0df215c5d330e7?c=mail-w14az1");
    render(
      <VerifyLayout>
        <div />
      </VerifyLayout>,
    );
    const v = await визиты();
    expect(v).toHaveLength(1);
    expect(v[0].url).toMatch(/\/api\/pricing\/events$/);
    expect(v[0].body.source).toBe("verify");
    expect(v[0].body.path).toBe("/verify/cert-9c0df215c5d330e7?c=mail-w14az1");
    const meta = v[0].body.meta as Record<string, unknown>;
    // Канал письма, а не «прямой заход» и не «чужая метка».
    expect(meta.channel).not.toBe("direct");
    expect(meta.channel).not.toBe("unknown");
    expect(String(meta.channel)).toMatch(/mail/);
    expect(meta.post).toBeTruthy();
  });

  test("контроль: без метки визит тоже есть, канал direct", async () => {
    window.history.replaceState({}, "", "/verify/cert-9c0df215c5d330e7");
    render(
      <VerifyLayout>
        <div />
      </VerifyLayout>,
    );
    const v = await визиты();
    expect(v).toHaveLength(1);
    expect((v[0].body.meta as Record<string, unknown>).channel).toBe("direct");
  });
});
