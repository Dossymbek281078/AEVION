import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { demoPlan, generateLights, generatePlumbing, generateWiring } from "./planModel";
import { estimatePlan } from "./estimate";
import { findRooms } from "./rooms";
import { roomSpec } from "./roomSpec";

describe("спецификация из демо-плана", () => {
  const p = demoPlan();
  const w = generateWiring(p);
  const pl = generatePlumbing(p);
  const est = estimatePlan(p, w, pl, generateLights(p).length);

  it("площадь пола — ровно габарит 8 × 6 = 48 м², покрытие с запасом 5 %", () => {
    expect(est.floorArea).toBe(48);
    expect(est.flooringArea).toBeCloseTo(50.4, 6);
  });

  it("площадь стен считается из длин и высот минус проёмы — не константа", () => {
    // независимый пересчёт той же формулы по данным плана
    let expected = 0;
    for (const wall of p.walls) {
      expected += Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) * wall.height;
    }
    for (const o of p.openings) expected -= o.width * o.height;
    expect(est.wallArea).toBeCloseTo(expected, 9);
    // и порядок величины осмысленный: 37 м стен × 2.7 минус ~15 м² проёмов
    expect(est.wallArea).toBeGreaterThan(80);
    expect(est.wallArea).toBeLessThan(101);
  });

  it("краска = площадь стен × 0.12 л/м² × 2 слоя", () => {
    expect(est.paintLitres).toBeCloseTo(est.wallArea * 0.24, 9);
  });

  it("счётчики точек совпадают со слоем электрики (не с собственной копией)", () => {
    expect(est.outlets).toBe(w.points.filter((x) => x.kind === "outlet").length);
    expect(est.switches).toBe(3);
  });

  it("метры кабеля и труб — суммы настоящих полилиний, не нули", () => {
    // магистрали идут вдоль всех 7 стен: одних магистралей уже больше 37 м
    expect(est.cableMeters).toBeGreaterThan(37);
    expect(est.pipeMeters).toBeGreaterThan(5);
    expect(est.drainMeters).toBeGreaterThan(5);
  });

  it("удлинение стены увеличивает и стены, и краску (число выводится из плана)", () => {
    const p2 = demoPlan();
    p2.walls[0].x2 += 2; // юг длиннее на 2 м
    const est2 = estimatePlan(p2, w, pl, 6);
    expect(est2.wallArea).toBeCloseTo(est.wallArea + 2 * 2.7, 6);
    expect(est2.paintLitres).toBeGreaterThan(est.paintLitres);
  });
});

describe("площадь пола берётся по помещениям, а не по габариту", () => {
  // Прежде площадь бралась габаритом плана — это было написано до того, как
  // модуль научился выделять помещения. Замер на демо: 48 м² габарит против
  // 41.1 м² по комнатам, то есть 17 % лишнего покрытия в закупке. Деньги.
  const plan = demoPlan();
  const парам = () => [generateWiring(plan), generatePlumbing(plan), generateLights(plan).length] as const;

  it("с площадью помещений покрытия нужно МЕНЬШЕ, чем по габариту", () => {
    const [w, pl, l] = парам();
    const поГабариту = estimatePlan(plan, w, pl, l);
    const поКомнатам = estimatePlan(plan, w, pl, l, findRooms(plan).totalArea);
    expect(поКомнатам.flooringArea, "площадь помещений не повлияла — параметр не доехал")
      .toBeLessThan(поГабариту.flooringArea);
    // разница должна быть заметной, а не косметической
    expect(поГабариту.flooringArea - поКомнатам.flooringArea).toBeGreaterThan(3);
  });

  it("запас на подрезку сохраняется — покрытия НЕ меньше самих комнат", () => {
    const [w, pl, l] = парам();
    const area = findRooms(plan).totalArea;
    expect(estimatePlan(plan, w, pl, l, area).flooringArea).toBeGreaterThan(area);
  });

  it("без помещений остаётся запасной путь по габариту, а не ноль", () => {
    // открытый контур или картинка с разрывами: завышенная оценка лучше пустой
    const [w, pl, l] = парам();
    for (const плохо of [undefined, 0, -5]) {
      expect(estimatePlan(plan, w, pl, l, плохо).flooringArea,
        `при значении ${плохо} смета обнулилась`).toBeGreaterThan(40);
    }
  });
});

describe("общая смета и таблица по комнатам говорят ОДНО", () => {
  // Замер 08.09: по осям стен выходило 86.7 м² и 20.8 л краски, по комнатам —
  // 115.3 м² и 27.7 л. Расхождение 33 %, и оба числа стояли на одном экране.
  // Занижение краски дороже завышения: не хватит посреди работы, а
  // докупленная партия ляжет другим оттенком.
  const plan = demoPlan();
  const rr = findRooms(plan);
  const rs = roomSpec(rr.rooms, 2.7);
  const est = estimatePlan(
    plan, generateWiring(plan), generatePlumbing(plan), generateLights(plan, rr).length,
    rr.totalArea, rs.totals.wallArea,
  );

  it("площадь стен совпадает с суммой по комнатам", () => {
    expect(est.wallArea).toBeCloseTo(rs.totals.wallArea, 1);
  });

  it("краска совпадает с суммой по комнатам", () => {
    expect(est.paintLitres).toBeCloseTo(rs.totals.paint, 1);
  });

  it("площадь пола совпадает с суммой помещений", () => {
    expect(est.floorArea).toBeCloseTo(rr.totalArea, 1);
  });

  it("число само называет своё основание", () => {
    // подпись на экране читает это поле; без него ярлык живёт отдельно от
    // расчёта и переживает его правку — так уже случилось дважды
    expect(est.wallAreaSource).toBe("rooms");
    expect(est.floorAreaSource).toBe("rooms");
  });

  it("контроль: без данных о комнатах основание другое и названо честно", () => {
    const без = estimatePlan(plan, generateWiring(plan), generatePlumbing(plan), 6);
    expect(без.wallAreaSource).toBe("axes");
    expect(без.floorAreaSource).toBe("axes");
    // и запасной путь не обнуляется
    expect(без.wallArea).toBeGreaterThan(10);
    expect(без.floorArea).toBeGreaterThan(10);
  });

  it("контроль прибора: расхождение БЫЛО настоящим, а не выдуманным", () => {
    // иначе «теперь совпадает» неотличимо от «и раньше совпадало»
    const поОсям = estimatePlan(plan, generateWiring(plan), generatePlumbing(plan), 6);
    expect(rs.totals.paint - поОсям.paintLitres).toBeGreaterThan(5); // литров
  });
});

describe("ставки материалов живут в одном месте", () => {
  // Ставка краски стояла в трёх местах: числом в смете, константой в расчёте
  // по комнатам и словами в подписи. Общая смета и таблица по комнатам
  // обязаны сходиться, а три копии одной ставки — готовая причина разойтись.
  const est = readFileSync(path.join(__dirname, "estimate.ts"), "utf8");
  const client = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");

  it("смета не повторяет ставки числом", () => {
    const тело = est.slice(est.indexOf("export function estimatePlan"));
    expect(тело, "ставка краски снова вписана числом").not.toMatch(/0\.12/);
    expect(тело, "запас на подрезку снова вписан числом").not.toMatch(/\*\s*1\.05/);
  });

  it("подпись на экране берёт ставку из кода, а не переписывает словами", () => {
    expect(client).toContain("{PAINT_LITRES_PER_M2}");
    expect(client, "в подписи снова записано число").not.toMatch(/Краска \(0\.12/);
  });

  it("контроль прибора: шаблоны НАХОДЯТ запись числом", () => {
    // без этого «не найдено» неотличимо от «шаблон ничего не ищет»
    expect(/0\.12/.test("paintLitres: wallArea * 0.12 * 2")).toBe(true);
    expect(/Краска \(0\.12/.test("Краска (0.12 л/м², два слоя)")).toBe(true);
  });
});
