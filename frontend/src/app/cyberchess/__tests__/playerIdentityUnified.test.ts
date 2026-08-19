import { describe, test, expect, beforeEach, afterEach } from "vitest";

// Один человек — один id во всём модуле. 19.08.2026.
//
// Турниры жили под ключом `cc_user_id`, а задача дня, таблица лидеров, история
// и матчмейкинг — под `cyberchess.userId`. То есть один и тот же игрок был
// двумя разными людьми, и разъезд был МОЛЧАЛИВЫМ: ни ошибки на экране, ни
// красного в проверках — просто рейтинг и история не сходились.
//
// Проверка поведения, а не текста исходника: искать имя ключа грепом
// бессмысленно, оба ключа в файле присутствуют законно.

const PLATFORM = "cyberchess.userId";
const LEGACY = "cc_user_id";

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
  (globalThis as unknown as { window: unknown }).window = { localStorage: store };
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

async function userId(): Promise<string> {
  const mod = await import("../tournaments/playerIdentity");
  return mod.tournamentUserId();
}

describe("личность игрока едина для всего модуля", () => {
  test("берётся личность платформы, а не турнирная", async () => {
    store.setItem(PLATFORM, "acc_777");
    store.setItem(LEGACY, "u_старый");
    // Платформенный ключ при входе в аккаунт перезаписывается настоящим id,
    // поэтому именно он обязан побеждать: иначе вошедший игрок остаётся в
    // турнирах анонимом и его серверный рейтинг туда не доедет.
    expect(await userId()).toBe("acc_777");
  });

  test("человек со старым ключом не становится новым игроком", async () => {
    store.setItem(LEGACY, "u_старый");
    expect(await userId()).toBe("u_старый");
  });

  test("новый игрок записывается в платформенный ключ, а не в турнирный", async () => {
    const id = await userId();
    expect(id).toBeTruthy();
    expect(store.getItem(PLATFORM)).toBe(id);
    // Запись в старый ключ воспроизвела бы разъезд заново, уже для новичков.
    expect(store.getItem(LEGACY)).toBeNull();
  });

  test("повторный вызов даёт тот же id", async () => {
    const first = await userId();
    expect(await userId()).toBe(first);
  });
});
