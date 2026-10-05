import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import express from "express";

import cyberchessPuzzlesRouter from "../src/routes/cyberchessPuzzles";
import { ispravitPodpisMata, matIzResheniya } from "../src/lib/chessPuzzleLabel";

/**
 * Подпись задачи совпадает с её решением — проверяем на ОТВЕТЕ РУЧКИ.
 *
 * Повод (05.10.2026). В банке лежали задачи с подписью «Мат в 5 · Мастер»,
 * которые матуют на 6–7-м ходу. Причина не у нас: у Lichess набор тем
 * заканчивается на `mateIn5`, любой мат длиннее помечен тем же словом, а наш
 * сев скопировал это число и в поле `mateIn`, и прямо в название. Замер окна
 * Связи: 6 из 43 задач темы «Мат в 5+» матуют не в 5.
 *
 * Это тот класс, за который основатель ругал ролик «мат в 1»: утверждение о
 * позиции берут из подписи рядом, а не из решения.
 *
 * Сторож спрашивает РУЧКУ, а не функцию: проверять свою же копию правила
 * бессмысленно — на проде отвечает маршрут, и чинили мы именно его.
 * Регулярок в файле нет намеренно: слэши теряются на границе вызова, и тогда
 * тест молча перестаёт разбираться («no tests» вместо красного).
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use(cyberchessPuzzlesRouter);
  return a;
}

/** Число из подписи «Мат в N · …» без регулярки. null — подпись не про мат. */
function chisloVPodpisi(name: string): number | null {
  const ПРЕФИКС = "Мат в ";
  if (!name.startsWith(ПРЕФИКС)) return null;
  let i = ПРЕФИКС.length;
  let cifry = "";
  while (i < name.length && name[i] >= "0" && name[i] <= "9") { cifry += name[i]; i++; }
  return cifry ? Number(cifry) : null;
}

/**
 * Пул с ЗАВЕДОМО кривой подписью. Без него проверка на ручке зелена по пустому
 * охвату: в штатном файле-пуле расходящихся подписей просто нет, и мутация
 * «выключить правку» проходила насквозь — поймано 05.10.2026.
 */
function fayl_s_krivoy_podpisyu(): string {
  const dir = mkdtempSync(join(tmpdir(), "cc-podpis-"));
  const put = join(dir, "pool.json");
  // Сырой формат Lichess: первый ход — соперника. Длина 12 => шесть ходов решателя.
  const dlinnyySol = ["a1a2", "b1b2", "a2a3", "b2b3", "a3a4", "b3b4", "a4a5", "b4b5", "a5a6", "b5b6", "a6a7", "b6b7"];
  writeFileSync(
    put,
    JSON.stringify([
      { fen: "8/8/8/8/8/8/8/K6k w - - 0 1", sol: dlinnyySol, name: "Мат в 5 · Мастер", r: 2100, theme: "Мат в 5+", goal: "Mate", mateIn: 5 },
      { fen: "8/8/8/8/8/8/8/K6k b - - 0 1", sol: ["e8f8", "d5f7"], name: "Мат в 1 · Новичок", r: 600, theme: "Мат в 1", goal: "Mate", mateIn: 1 },
      { fen: "8/8/8/8/8/8/8/K6k w - - 0 1", sol: ["e2e4", "d7d5", "g1f3"], name: "Вилка · Средняя", r: 1400, theme: "Вилка", goal: "Best move" },
    ]),
    "utf-8",
  );
  return put;
}

describe("число в подписи равно фактической длине мата", () => {
  it("ручка ИСПРАВЛЯЕТ заведомо кривую подпись, а не отдаёт её как есть", async () => {
    // Подменяем источник пула и поднимаем маршрут заново: правка живёт в
    // ingest(), через который проходят все три источника.
    const bylo = process.env.CYBERCHESS_PUZZLES_PATH;
    process.env.CYBERCHESS_PUZZLES_PATH = fayl_s_krivoy_podpisyu();
    vi.resetModules();
    try {
      const svezhiy = (await import("../src/routes/cyberchessPuzzles?podpis")).default;
      const a = express();
      a.use(express.json());
      a.use(svezhiy);
      const r = await request(a).get("/?limit=50");
      expect(r.status, `ручка ответила ${r.status}`).toBe(200);
      const zadachi = (r.body?.puzzles ?? []) as Array<{ name?: string; mateIn?: number; sol?: string[] }>;
      expect(zadachi.length, `задач в ответе: ${zadachi.length}`).toBe(3);

      const krivaya = zadachi.find((z) => String(z.name ?? "").startsWith("Мат в"));
      const shestihodovaya = zadachi.find((z) => (z.sol ?? []).length === 12);
      expect(shestihodovaya, "задача с длинным решением пропала из ответа").toBeTruthy();
      expect(shestihodovaya!.name, "подпись не исправлена на выдаче").toBe("Мат в 6 · Мастер");
      expect(shestihodovaya!.mateIn, "поле mateIn не исправлено").toBe(6);
      expect(krivaya, "контроль: подписи про мат вообще не пришли").toBeTruthy();

      // Контроль в другую сторону: верная подпись и не-мат остались как были.
      const vernaya = zadachi.find((z) => (z.sol ?? []).length === 2);
      expect(vernaya!.name).toBe("Мат в 1 · Новичок");
      const neMat = zadachi.find((z) => (z.sol ?? []).length === 3);
      expect(neMat!.name).toBe("Вилка · Средняя");
    } finally {
      if (bylo === undefined) delete process.env.CYBERCHESS_PUZZLES_PATH;
      else process.env.CYBERCHESS_PUZZLES_PATH = bylo;
      vi.resetModules();
    }
  });

  it("ручка выдачи задач не отдаёт ни одной расходящейся подписи", async () => {
    const r = await request(app()).get("/?limit=4000&shuffle=1");
    expect(r.status, `ручка ответила ${r.status}`).toBe(200);
    const zadachi = (r.body?.puzzles ?? []) as Array<{ name?: string; sol?: string[]; goal?: string; mateIn?: number }>;

    // Охват: без него зелёный цвет не значит ничего.
    expect(zadachi.length, `задач в ответе: ${zadachi.length}`).toBeGreaterThan(50);

    const rashozhdeniya: string[] = [];
    let proverenoMatov = 0;
    for (const z of zadachi) {
      const vPodpisi = chisloVPodpisi(String(z.name ?? ""));
      if (vPodpisi == null) continue;
      proverenoMatov++;
      const nastoyaschiy = matIzResheniya(z.sol);
      if (nastoyaschiy == null) { rashozhdeniya.push(`«${z.name}» — решения нет`); continue; }
      if (vPodpisi !== nastoyaschiy) rashozhdeniya.push(`«${z.name}» на деле мат в ${nastoyaschiy}`);
      // Поле рядом с подписью обязано говорить то же самое: по нему работают фильтры.
      if (z.mateIn != null && z.mateIn !== nastoyaschiy) {
        rashozhdeniya.push(`«${z.name}»: поле mateIn=${z.mateIn}, а мат в ${nastoyaschiy}`);
      }
    }

    expect(
      proverenoMatov,
      `задач с подписью про мат в ответе: ${proverenoMatov} из ${zadachi.length} — слишком мало, сторож ослеп`
    ).toBeGreaterThan(5);

    expect(
      rashozhdeniya,
      `проверено матовых подписей: ${proverenoMatov} (всего задач ${zadachi.length}); расходятся: ${rashozhdeniya.slice(0, 10).join(" | ")}`
    ).toEqual([]);
  });

  it("настоящий случай из банка: «Мат в 5 · Мастер» с решением на шесть ходов", () => {
    // Сырой формат Lichess: первый ход — соперника, дальше по два полухода на
    // ход решателя. Длина 12 => шесть ходов решателя.
    const sol = ["a1a2", "b1b2", "a2a3", "b2b3", "a3a4", "b3b4", "a4a5", "b4b5", "a5a6", "b5b6", "a6a7", "b6b7"];
    const out = ispravitPodpisMata({ name: "Мат в 5 · Мастер", sol, goal: "Mate", mateIn: 5 });
    expect(out.name).toBe("Мат в 6 · Мастер");
    expect(out.mateIn).toBe(6);
    expect(out.ispravleno).toBe(true);
  });

  it("контроль: верную подпись не трогаем, а не-мат не трогаем вовсе", () => {
    const matVOdin = ispravitPodpisMata({ name: "Мат в 1 · Новичок", sol: ["e8f8", "d5f7"], goal: "Mate", mateIn: 1 });
    expect(matVOdin.name).toBe("Мат в 1 · Новичок");
    expect(matVOdin.ispravleno).toBe(false);

    const neMat = ispravitPodpisMata({ name: "Вилка · Средняя", sol: ["e2e4", "d7d5", "g1f3"], goal: "Best move", mateIn: null });
    expect(neMat.name).toBe("Вилка · Средняя");
    expect(neMat.mateIn).toBeUndefined();
    expect(neMat.ispravleno).toBe(false);
  });

  it("нормализованное решение (нечётной длины) считается верно", () => {
    // Дыра, найденная мутацией 05.10: все примеры выше — сырой формат Lichess
    // (чётная длина), а на нём ceil и floor дают ОДНО И ТО ЖЕ. Значит проверка
    // не отличала верную формулу от неверной. Нормализованное решение — это
    // ходы решателя с ответами соперника между ними, длина нечётная:
    //   1 полуход  => мат в 1
    //   3 полухода => мат в 2 (ход, ответ, мат)
    //   5 полуходов => мат в 3
    expect(matIzResheniya(["d5f7"])).toBe(1);
    expect(matIzResheniya(["a1a2", "b1b2", "a2a3"])).toBe(2);
    expect(matIzResheniya(["a1a2", "b1b2", "a2a3", "b2b3", "a3a4"])).toBe(3);

    // И сырой формат рядом, чтобы было видно: ответ один для обоих.
    expect(matIzResheniya(["b1b2", "d5f7"])).toBe(1);
    expect(matIzResheniya(["b1b2", "a1a2", "b2b3", "a2a3"])).toBe(2);
  });

  it("подпись про мат исправляется и без поля goal — по самой подписи", () => {
    // Поле goal приходит не всегда (файловые пулы его не несут). Тогда признак
    // «это задача про мат» берётся из подписи. Без этого запаса кривое имя
    // уезжало бы наружу у любого источника, где goal не заполнен.
    const out = ispravitPodpisMata({
      name: "Мат в 5 · Мастер",
      sol: ["a1a2", "b1b2", "a2a3", "b2b3", "a3a4", "b3b4", "a4a5", "b4b5", "a5a6", "b5b6", "a6a7", "b6b7"],
    });
    expect(out.name).toBe("Мат в 6 · Мастер");
    expect(out.ispravleno).toBe(true);
  });

  it("решения нет — число не выдумываем", () => {
    const out = ispravitPodpisMata({ name: "Мат в 3 · Средняя", sol: [], goal: "Mate", mateIn: 3 });
    expect(out.name).toBe("Мат в 3 · Средняя");
    expect(out.ispravleno).toBe(false);
  });
});
