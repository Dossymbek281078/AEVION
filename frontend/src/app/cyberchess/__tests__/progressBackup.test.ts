import { describe, it, expect } from "vitest";
import {
  collectProgress, parseBackup, applyProgress, backupFilename,
  type KeyValueStore, type ProgressBackup,
} from "../progressBackup";

/* Резервная копия — единственная защита прогресса: аккаунтов нет, всё живёт в
   localStorage одного браузера. Поэтому тесты здесь про две вещи, которые больно
   ломаются: копия должна возвращать состояние ТОЧНО, и чужой файл не должен
   получить право писать в наш домен. */

function memStore(init: Record<string, string> = {}): KeyValueStore {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => { m.set(k, v) },
    removeItem: (k) => { m.delete(k) },
  };
}
const dump = (s: KeyValueStore) => {
  const o: Record<string, string> = {};
  for (let i = 0; i < s.length; i++) { const k = s.key(i)!; o[k] = s.getItem(k)! }
  return o;
};
const NOW = "2026-07-28T10:00:00.000Z";

describe("сбор копии", () => {
  it("берёт только наши ключи", () => {
    const s = memStore({ aevion_chessy_v1: "{}", aevion_pz_solved_v1: "[]", other_app: "секрет" });
    const b = collectProgress(s, NOW);
    expect(Object.keys(b.keys).sort()).toEqual(["aevion_chessy_v1", "aevion_pz_solved_v1"]);
    expect(b.keys).not.toHaveProperty("other_app");
  });

  it("пустое хранилище даёт валидную копию без данных", () => {
    const b = collectProgress(memStore(), NOW);
    expect(b.app).toBe("cyberchess");
    expect(Object.keys(b.keys)).toHaveLength(0);
  });
});

describe("разбор файла", () => {
  const good = JSON.stringify({ v: 1, app: "cyberchess", exportedAt: NOW, keys: { aevion_x: "1" } });

  it("своя копия принимается", () => {
    const r = parseBackup(good);
    expect(r.ok).toBe(true);
  });

  it("чужие ключи из файла отбрасываются, а не заливаются", () => {
    // иначе подсунутый файл пишет во что угодно в домене
    const r = parseBackup(JSON.stringify({
      v: 1, app: "cyberchess", keys: { aevion_ok: "1", token: "укради меня", "": "x" },
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.backup.keys)).toEqual(["aevion_ok"]);
  });

  it("нестроковые значения отбрасываются", () => {
    const r = parseBackup(JSON.stringify({ v: 1, app: "cyberchess", keys: { aevion_a: "1", aevion_b: { x: 1 } } }));
    if (r.ok) expect(Object.keys(r.backup.keys)).toEqual(["aevion_a"]);
  });

  it("мусор отвергается с внятной причиной, а не молча", () => {
    for (const bad of ["не json", "[]", "42", JSON.stringify({ v: 1, app: "другое", keys: {} })]) {
      const r = parseBackup(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it("неизвестная версия называется в причине", () => {
    const r = parseBackup(JSON.stringify({ v: 99, app: "cyberchess", keys: { aevion_a: "1" } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("99");
  });
});

describe("восстановление", () => {
  const backup: ProgressBackup = {
    v: 1, app: "cyberchess", exportedAt: NOW,
    keys: { aevion_rating: "1750", aevion_chessy: "340" },
  };

  it("replace возвращает состояние ТОЧНО как в копии", () => {
    const s = memStore({ aevion_rating: "800", aevion_мусор: "лишнее" });
    const rep = applyProgress(s, backup, "replace");
    expect(dump(s)).toEqual({ aevion_rating: "1750", aevion_chessy: "340" });
    expect(rep.removed).toBe(1);
  });

  it("merge не затирает то, что уже наиграно", () => {
    const s = memStore({ aevion_rating: "2100" });
    const rep = applyProgress(s, backup, "merge");
    expect(s.getItem("aevion_rating")).toBe("2100");
    expect(s.getItem("aevion_chessy")).toBe("340");
    expect(rep.kept).toBe(1);
    expect(rep.written).toBe(1);
  });

  it("чужие ключи не трогаются НИ в одном режиме", () => {
    for (const mode of ["replace", "merge"] as const) {
      const s = memStore({ other_app: "секрет", aevion_rating: "800" });
      applyProgress(s, backup, mode);
      expect(s.getItem("other_app")).toBe("секрет");
    }
  });

  it("полный оборот: собрал → разобрал → залил = исходное состояние", () => {
    const original = { aevion_a: "1", aevion_b: '{"x":[1,2,3]}', aevion_ю: "кириллица" };
    const src = memStore(original);
    const text = JSON.stringify(collectProgress(src, NOW));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    const dst = memStore({ aevion_a: "старое", aevion_лишнее: "х" });
    if (parsed.ok) applyProgress(dst, parsed.backup, "replace");
    expect(dump(dst)).toEqual(original);
  });
});

describe("имя файла", () => {
  it("содержит дату, чтобы копии не перетирали друг друга", () => {
    expect(backupFilename(NOW)).toBe("cyberchess-progress-2026-07-28.json");
  });
});

import { ourKeys } from "../progressBackup";

describe("перечисление наших ключей", () => {
  it("находит все наши и ни одного чужого", () => {
    const s = memStore({ aevion_a: "1", aevion_b: "2", other: "3", "": "4" });
    expect(ourKeys(s).sort()).toEqual(["aevion_a", "aevion_b"]);
  });

  it("новый ключ попадает в перечисление сам, без правки списка", () => {
    // именно это и ломалось: сброс чистил список из 14 имён при 85 живых ключах
    const s = memStore({ aevion_старый: "1" });
    s.setItem("aevion_совершенно_новый", "2");
    expect(ourKeys(s)).toContain("aevion_совершенно_новый");
  });
});

describe("оба префикса наших ключей", () => {
  it("ключи cc_ тоже попадают в копию — под ними лежит репертуар и калибровка", () => {
    // изначально брался только префикс aevion, и 28 ключей cc_ молча не сохранялись,
    // хотя интерфейс обещал сохранить в том числе дебютный репертуар
    const s = memStore({
      aevion_chessy_v1: "{}",
      cc_opening_repertoire_v1: "[]",
      cc_fide_estimate_v1: "1750",
      cc_login_streak_v1: "{}",
      posторонний: "не наш",
    });
    const keys = Object.keys(collectProgress(s, NOW).keys).sort();
    expect(keys).toEqual(["aevion_chessy_v1", "cc_fide_estimate_v1", "cc_login_streak_v1", "cc_opening_repertoire_v1"]);
  });

  it("replace чистит и cc_, иначе «сбросить ВСЁ» оставляет половину", () => {
    const s = memStore({ cc_старое: "1", aevion_старое: "2" });
    applyProgress(s, { v: 1, app: "cyberchess", exportedAt: NOW, keys: { aevion_новое: "3" } }, "replace");
    expect(dump(s)).toEqual({ aevion_новое: "3" });
  });

  it("чужой ключ по-прежнему не трогается", () => {
    const s = memStore({ other_app: "секрет", cc_наше: "1" });
    applyProgress(s, { v: 1, app: "cyberchess", exportedAt: NOW, keys: {} }, "replace");
    expect(s.getItem("other_app")).toBe("секрет");
    expect(s.getItem("cc_наше")).toBeNull();
  });

  it("перечисление ключей видит оба префикса", () => {
    const s = memStore({ aevion_a: "1", cc_b: "2", чужое: "3" });
    expect(ourKeys(s).sort()).toEqual(["aevion_a", "cc_b"]);
  });
});
