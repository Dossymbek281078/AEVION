import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoPlan } from "./planModel";
import {
  STORAGE_KEY,
  clearLocal,
  isProject,
  loadLocal,
  parseProjectFile,
  projectFileName,
  saveLocal,
  type Project,
} from "./project";

function sample(): Project {
  return {
    version: 1,
    savedAt: "2026-09-08T08:00:00.000Z",
    plan: demoPlan(),
    placed: [{ catalogId: "sofa", x: 2, z: 3, rotY: 0.5 }],
    wallMatId: "paint-sage",
    floorMatId: "tile-white",
    partition: "wall-frame",
    layers: { rough: true, finish: true, decor: false },
  };
}

describe("сохранение в браузер", () => {
  beforeEach(() => { clearLocal(); });

  it("сохранённое читается обратно тем же, что положили", () => {
    const p = sample();
    expect(saveLocal(p).ok).toBe(true);
    const r = loadLocal();
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.project.placed).toEqual(p.placed);
    expect(r.project.wallMatId).toBe("paint-sage");
    expect(r.project.plan.walls.length).toBe(p.plan.walls.length);
    expect(r.project.layers.decor).toBe(false);
  });

  it("«ничего не сохранено» и «сохранённое не читается» — РАЗНЫЕ исходы", () => {
    expect(loadLocal().kind).toBe("none");
    localStorage.setItem(STORAGE_KEY, "{это не json");
    const broken = loadLocal();
    expect(broken.kind).toBe("broken");
    if (broken.kind === "broken") expect(broken.reason).toContain("повреждён");
  });

  it("чужой формат не выдаётся за пустоту — иначе работа пропадёт молча", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, plan: {} }));
    const r = loadLocal();
    expect(r.kind).toBe("broken");
  });

  it("отказ хранилища НЕ роняет работу, но и не молчит", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError: quota");
    });
    const r = saveLocal(sample());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/место|файлом/);
    spy.mockRestore();
  });

  it("недоступное хранилище при чтении — это «не знаю», а не «пусто»", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const r = loadLocal();
    expect(r.kind).toBe("broken");
    spy.mockRestore();
  });
});

describe("файл проекта", () => {
  it("свой файл открывается", () => {
    const r = parseProjectFile(JSON.stringify(sample()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project.floorMatId).toBe("tile-white");
  });

  it("не-json отвергается словами, а не пустым проектом", () => {
    const r = parseProjectFile("<html>совсем другое</html>");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("не файл проекта");
  });

  it("файл будущей версии НЕ толкуется по-старому", () => {
    const future = { ...sample(), version: 2 };
    const r = parseProjectFile(JSON.stringify(future));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("другой версией");
  });

  it("испорченный файл (нет стен) отвергается с объяснением", () => {
    const bad = { ...sample(), plan: { ...sample().plan, walls: [{ x1: 0 }] } };
    const r = parseProjectFile(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("повреждён");
  });

  it("проём, ссылающийся на несуществующую стену, не пропускается", () => {
    const p = sample();
    const bad = { ...p, plan: { ...p.plan, openings: [{ ...p.plan.openings[0], wall: 999 }] } };
    expect(isProject(bad)).toBe(false);
  });

  it("нечисловые координаты мебели не пропускаются", () => {
    const bad = { ...sample(), placed: [{ catalogId: "sofa", x: NaN, z: 0, rotY: 0 }] };
    expect(isProject(bad)).toBe(false);
  });

  it("имя файла содержит дату — чтобы версии не перезаписывали друг друга", () => {
    expect(projectFileName(new Date(2026, 8, 8))).toBe("qspace-2026-09-08.qspace.json");
  });

  it("контроль прибора: правильный проект проходит проверку формы", () => {
    // без этого «отвергает всё» было бы неотличимо от «проверяет»
    expect(isProject(sample())).toBe(true);
  });
});

describe("файл с неполными полями отвергается ДО применения", () => {
  // Проверка формы смотрела «layers это объект» и не смотрела на partition
  // вовсе. Файл с `layers: {}` проходил как исправный, а страница делала
  // checked={layers.rough} со значением undefined — флажок становился
  // неуправляемым уже ПОСЛЕ сообщения «проект восстановлен». Отказать честно
  // дешевле, чем принять и сломаться позже.
  const целый = () => JSON.parse(JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    plan: { name: "п", source: "demo", walls: [
      { x1: 0, y1: 0, x2: 4, y2: 0, thickness: 0.2, height: 2.7 },
    ], openings: [] },
    placed: [],
    wallMatId: "paint-warm-white",
    floorMatId: "parquet-oak",
    partition: "wall-block",
    layers: { rough: false, finish: true, decor: true },
  }));

  it("контроль прибора: целый файл принимается", () => {
    // без этого «всё отвергнуто» неотличимо от «отвергается что угодно»
    expect(isProject(целый())).toBe(true);
  });

  it("слои без нужных полей — отказ", () => {
    for (const плохие of [{}, { rough: true }, { rough: 1, finish: true, decor: true },
                          { rough: true, finish: true }]) {
      const p = целый(); p.layers = плохие;
      expect(isProject(p), `принят файл со слоями ${JSON.stringify(плохие)}`).toBe(false);
    }
  });

  it("тип перегородки обязателен", () => {
    const p = целый(); delete p.partition;
    expect(isProject(p)).toBe(false);
    const q = целый(); q.partition = 5;
    expect(isProject(q)).toBe(false);
  });
});
