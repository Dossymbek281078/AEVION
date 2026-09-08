import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, demoFurniture, demoPlacedSnapshots } from "./furniture";
import { demoPlan } from "./planModel";
import { checkClearance, type Placed } from "./clearance";
import { checkPassage } from "./passage";

const placed = (): Placed[] =>
  demoFurniture().map((d, i) => {
    const item = CATALOG.find((c) => c.id === d.catalogId);
    if (!item) throw new Error(`нет в каталоге: ${d.catalogId}`);
    return { uid: i + 1, name: item.name, x: d.x, y: d.y, rotY: d.rotY, size: item.size };
  });

describe("демо-квартира обставлена", () => {
  it("каждый предмет есть в каталоге", () => {
    for (const d of demoFurniture()) {
      expect(CATALOG.some((c) => c.id === d.catalogId), `нет предмета ${d.catalogId}`).toBe(true);
    }
  });

  it("в расстановке есть все три вида: жильё, кухня-санузел, декор", () => {
    // Основатель просил «декор и мебель» третьим слоем — одна тумбочка это не
    // ракурс. Проверяем состав, а не количество.
    const groups = new Set(
      demoFurniture().map((d) => CATALOG.find((c) => c.id === d.catalogId)!.group),
    );
    for (const g of ["Гостиная", "Кухня", "Спальня", "Санузел", "Декор"]) {
      expect(groups, `в демо нет ничего из группы «${g}»`).toContain(g);
    }
  });

  it("предметы не налезают друг на друга и не перекрывают двери", () => {
    const issues = checkClearance(demoPlan(), placed());
    expect(issues.map((i) => i.text), "демо встречает гостя своими же замечаниями").toEqual([]);
  });

  it("по квартире можно пройти", () => {
    const r = checkPassage(demoPlan(), placed());
    expect(r.issues.map((i) => i.text)).toEqual([]);
  });

  it("контроль прибора: заведомо плохая расстановка ЛОВИТСЯ", () => {
    // без этого «ноль замечаний» неотличимо от «проверка ничего не смотрит»
    const two = placed().slice(0, 1);
    two.push({ ...two[0], uid: 999 }); // тот же предмет на том же месте
    expect(checkClearance(demoPlan(), two).length).toBeGreaterThan(0);
  });
});

describe("перевод в формат проекта не переставляет оси", () => {
  it("z снимка — это y плана, а x остаётся x", () => {
    const plan = demoFurniture();
    const snap = demoPlacedSnapshots();
    expect(snap.length).toBe(plan.length);
    for (let i = 0; i < plan.length; i++) {
      expect(snap[i].x, `предмет ${plan[i].catalogId}: x уехал`).toBe(plan[i].x);
      expect(snap[i].z, `предмет ${plan[i].catalogId}: z должен равняться y плана`).toBe(plan[i].y);
      expect(snap[i].rotY).toBe(plan[i].rotY);
      expect(snap[i].catalogId).toBe(plan[i].catalogId);
    }
  });

  it("оси РАЗЛИЧИМЫ: в демо есть предмет, у которого x и y не совпадают", () => {
    // без этого перестановка осей прошла бы незамеченной на симметричных точках
    expect(demoFurniture().some((d) => d.x !== d.y), "все точки на диагонали — тест слеп").toBe(true);
  });
});

describe("обещание страницы про демо подкреплено кодом", () => {
  const text = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");

  it("если страница обещает расставленную мебель — она расставлена", () => {
    // Признак — ФРАЗА, а не слово: слово «мебель» встречается в подписи слоя,
    // в названии каталога и в прозе, и сторож зеленел бы от любого из них.
    const promises = text.includes("с расставленной мебелью");
    expect(promises, "фраза-обещание пропала из страницы — поправьте сторожа осознанно").toBe(true);
    expect(demoFurniture().length, "страница обещает мебель, а расстановка пуста").toBeGreaterThan(4);
  });

  it("слой декора сообщает, когда он ПУСТ", () => {
    // молчащий флажок неотличим от сломанного — это и был найденный дефект
    expect(text).toContain("пусто, добавьте из каталога");
  });
});

describe("предметы демо действительно строят геометрию", () => {
  // «13 предметов расставлено» ничего не значит, если build() вернёт пустую
  // группу: слой снова покажет ничего, а счётчик будет говорить «13».
  // Проверяется тем же вызовом, которым пользуется страница.
  const meshCount = (g: { children: Array<{ children?: unknown[] }> }): number => {
    let n = 0;
    const walk = (o: { children?: unknown[] }) => {
      n++;
      for (const c of (o.children ?? []) as Array<{ children?: unknown[] }>) walk(c);
    };
    for (const c of g.children) walk(c);
    return n;
  };

  it("каждый предмет строит непустую группу", () => {
    for (const d of demoFurniture()) {
      const item = CATALOG.find((c) => c.id === d.catalogId)!;
      const g = item.build();
      expect(meshCount(g), `«${item.name}» строит пустую группу — слой покажет пустоту`)
        .toBeGreaterThan(0);
    }
  });

  it("ВЕСЬ каталог строит непустые группы, а не только демо", () => {
    // человек может поставить любой из них, и пустой предмет читался бы как
    // «нажал и ничего не появилось» — тот же класс, что пустой слой
    const пустые = CATALOG.filter((c) => meshCount(c.build()) === 0).map((c) => c.name);
    expect(пустые, "предметы каталога, которые ничего не рисуют").toEqual([]);
    expect(CATALOG.length, "каталог пуст — проверка ничего не смотрит").toBeGreaterThan(30);
  });

  it("у каждого предмета габарит — три положительных числа", () => {
    // нулевой габарит не падает: предмет рисуется, но проверка расстановки
    // считает его точкой и перестаёт видеть пересечения
    for (const c of CATALOG) {
      for (const [i, v] of c.size.entries()) {
        expect(v, `«${c.name}»: габарит ${i} равен ${v}`).toBeGreaterThan(0);
      }
    }
  });

  it("два одинаковых предмета — РАЗНЫЕ объекты", () => {
    // иначе поставленный дважды диван был бы одним и тем же телом, и второй
    // «переехал» бы вместе с первым
    const sofa = CATALOG.find((c) => c.id === "sofa")!;
    expect(sofa.build()).not.toBe(sofa.build());
  });

  it("контроль прибора: пустая группа НАХОДИТСЯ", () => {
    expect(meshCount({ children: [] })).toBe(0);
  });
});
