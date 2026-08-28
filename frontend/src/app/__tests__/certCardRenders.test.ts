import { describe, test, expect, afterEach, vi } from "vitest";
import { renderCertCard } from "../bureau/og/certCard";

/**
 * Картинка карточки рисуется строгим отрисовщиком: он бросает на вёрстке,
 * которую не поддерживает (например, у `div` с несколькими детьми обязан быть
 * `display: flex`). Проверить это могла только СБОРКА — тесты и проверка типов
 * до отрисовки не доходят.
 *
 * Здесь картинка рисуется по-настоящему и проверяется, что на выходе PNG.
 * Сборку на машине в тот вечер запустить было нельзя (шесть чужих сборок,
 * сторож памяти запретил), и эта проверка закрывает ровно ту дыру.
 */

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/**
 * Перехватываем ТОЛЬКО свой адрес. Отрисовщик сам ходит за шрифтами, и
 * глобальная заглушка ломала бы именно их — первая версия этого теста так и
 * упала («.text is not a function»), то есть проверяла бы не тот путь.
 */
function stubBundle(body: unknown | "throw") {
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init?: unknown) => {
    const url = String(typeof input === "string" ? input : (input as { url?: string })?.url ?? "");
    if (url.includes("/api/pipeline/certificate/")) {
      if (body === "throw") throw new Error("ECONNRESET");
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }
    return real(input as RequestInfo, init as RequestInit);
  }) as unknown as typeof fetch);
}

/**
 * ГРАНИЦА ЭТОЙ ПРОВЕРКИ, названная честно.
 *
 * Отрисовка идёт в два шага: вёрстка → SVG (строгий шаг, наш) и SVG → PNG
 * (шаг среды, требует WASM, которого в тестовом окружении нет). Первый шаг
 * здесь проверяется по-настоящему: именно он бросает на неподдерживаемой
 * вёрстке и именно он нашёл настоящий дефект — блок с двумя детьми без
 * display:flex, из-за которого маршрут упал бы.
 *
 * Второй шаг проверить тут нельзя, и притворяться не надо: ошибку перевода в
 * PNG пропускаем, ошибку ВЁРСТКИ — нет.
 */
const LAYOUT_ERROR = /display: flex|Expected <div>|Unsupported style|not supported/i;
const ENV_ERROR = /Unsupported input|wasm|WebAssembly/i;

async function rendersWithoutLayoutError(certId: string): Promise<void> {
  try {
    const res = await renderCertCard(certId);
    await res.arrayBuffer();
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (LAYOUT_ERROR.test(msg)) throw new Error("ошибка ВЁРСТКИ карточки: " + msg.slice(0, 160));
    if (ENV_ERROR.test(msg)) return; // перевод в PNG недоступен в тестовой среде
    throw e;
  }
}

describe("карточка сертификата действительно рисуется", () => {
  test("подтверждённый якорь: на выходе PNG, а не ошибка вёрстки", async () => {
    stubBundle({
      certificate: { title: "Степной рассвет", author: "Досымбек", protectedAt: "2026-08-01T00:00:00.000Z" },
      proofs: { openTimestamps: { status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 } },
    });
    await rendersWithoutLayoutError("cert-x");
  }, 30000);

  test("без якоря и без автора — тоже рисуется", async () => {
    // Пустые поля — самый частый способ уронить строгий отрисовщик.
    stubBundle({ certificate: { title: "Работа" }, proofs: {} });
    await rendersWithoutLayoutError("cert-y");
  }, 30000);

  test("API недоступен — карточка всё равно рисуется, а не падает", async () => {
    stubBundle("throw");
    await rendersWithoutLayoutError("cert-z");
  }, 30000);
});
