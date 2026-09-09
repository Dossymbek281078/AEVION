import { describe, expect, it } from "vitest";
import { parseDxf } from "./dxf";

/** Собирает ASCII-DXF из пар «код/значение». */
function dxf(pairs: Array<[number | string, string | number]>): string {
  return pairs.map(([c, v]) => `${c}\n${v}`).join("\n") + "\n";
}

function entitiesWrap(inner: Array<[number | string, string | number]>): Array<[number | string, string | number]> {
  return [
    [0, "SECTION"], [2, "ENTITIES"],
    ...inner,
    [0, "ENDSEC"], [0, "EOF"],
  ];
}

const LINE = (x1: number, y1: number, x2: number, y2: number, layer = "0"): Array<[number | string, string | number]> => [
  [0, "LINE"], [8, layer], [10, x1], [20, y1], [11, x2], [21, y2],
];

describe("parseDxf", () => {
  it("миллиметры по габариту: 8000×6000 мм → 8×6 м, координаты нормированы к нулю", () => {
    const text = dxf(entitiesWrap([
      ...LINE(1000, 1000, 9000, 1000),
      ...LINE(9000, 1000, 9000, 7000),
      ...LINE(9000, 7000, 1000, 7000),
      ...LINE(1000, 7000, 1000, 1000),
    ]));
    const r = parseDxf(text);
    expect(r.plan).not.toBeNull();
    expect(r.unitLabel).toContain("мм");
    const walls = r.plan!.walls;
    expect(walls.length).toBe(4);
    // первый отрезок: (1000,1000)→(9000,1000) минус минимум (1000,1000), в метрах
    expect(walls[0].x1).toBeCloseTo(0, 9);
    expect(walls[0].y1).toBeCloseTo(0, 9);
    expect(walls[0].x2).toBeCloseTo(8, 9);
    expect(walls[0].y2).toBeCloseTo(0, 9);
  });

  it("$INSUNITS=6 (метры) уважается даже при большом габарите-числе", () => {
    const text = dxf([
      [0, "SECTION"], [2, "HEADER"],
      [9, "$INSUNITS"], [70, 6],
      [0, "ENDSEC"],
      ...entitiesWrap([...LINE(0, 0, 8, 0), ...LINE(8, 0, 8, 6)]),
    ]);
    const r = parseDxf(text);
    expect(r.unitLabel).toContain("$INSUNITS");
    expect(r.plan!.walls[0].x2).toBeCloseTo(8, 9);
  });

  it("замкнутая LWPOLYLINE из 4 вершин даёт 4 стены", () => {
    const text = dxf(entitiesWrap([
      [0, "LWPOLYLINE"], [8, "WALLS"], [90, 4], [70, 1],
      [10, 0], [20, 0],
      [10, 8], [20, 0],
      [10, 8], [20, 6],
      [10, 0], [20, 6],
    ]));
    const r = parseDxf(text);
    expect(r.plan!.walls.length).toBe(4);
  });

  it("слой стен побеждает мусорные слои, и об этом сказано в warnings", () => {
    const text = dxf(entitiesWrap([
      ...LINE(0, 0, 8, 0, "A-WALL"),
      ...LINE(8, 0, 8, 6, "A-WALL"),
      ...LINE(8, 6, 0, 6, "A-WALL"),
      ...LINE(0, 6, 0, 0, "A-WALL"),
      ...LINE(0, -2, 8, -2, "DIMENSIONS"),
    ]));
    const r = parseDxf(text);
    expect(r.plan!.walls.length).toBe(4); // размерная линия не стала стеной
    expect(r.warnings.join(" ")).toContain("слой стен");
  });

  it("ARC пропускается с честным предупреждением", () => {
    const text = dxf(entitiesWrap([
      ...LINE(0, 0, 8, 0),
      ...LINE(8, 0, 8, 6),
      [0, "ARC"], [8, "0"], [10, 1], [20, 1], [40, 0.5],
    ]));
    const r = parseDxf(text);
    expect(r.warnings.join(" ")).toContain("ARC");
  });

  it("не-DXF даёт null-план и объяснение, а не пустой успех", () => {
    const r = parseDxf("просто текст, не чертёж");
    expect(r.plan).toBeNull();
    expect(r.warnings.length).toBeGreaterThanOrEqual(1);
    expect(r.warnings[0]).toContain("ENTITIES");
  });

  it("обрезка длинного чертежа называет число отброшенных", () => {
    const inner: Array<[number | string, string | number]> = [];
    for (let i = 0; i < 450; i++) inner.push(...LINE(0, i * 10, 1000, i * 10));
    const r = parseDxf(dxf(entitiesWrap(inner)));
    expect(r.truncated).toBe(50);
    expect(r.plan!.walls.length).toBe(400);
    expect(r.warnings.join(" ")).toContain("отброшено 50");
  });
});

describe("проёмы из блоков чертежа", () => {
  // В AutoCAD дверь и окно — это ВСТАВКА БЛОКА (INSERT), а не отрезок. Прежде
  // модуль их считал «пропущенными сущностями», и человек ставил каждый проём
  // рукой. Ширина берётся типовая: масштаб блока описывает растяжение символа,
  // а не размер проёма — вывести из него ширину значило бы получить
  // правдоподобно неверное число.
  const дом = (блоки: Array<[string, number, number]>): string => {
    const L: string[] = ["0", "SECTION", "2", "ENTITIES"];
    const стена = (x1: number, y1: number, x2: number, y2: number) => {
      L.push("0", "LINE", "8", "A-WALL",
        "10", String(x1), "20", String(y1), "11", String(x2), "21", String(y2));
    };
    стена(0, 0, 8, 0); стена(8, 0, 8, 6); стена(8, 6, 0, 6); стена(0, 6, 0, 0);
    for (const [имя, x, y] of блоки) {
      const слой = /окно|window/i.test(имя) ? "A-WINDOW" : "A-DOOR";
      L.push("0", "INSERT", "2", имя, "8", слой, "10", String(x), "20", String(y));
    }
    L.push("0", "ENDSEC", "0", "EOF");
    return L.join("\n") + "\n";
  };

  it("дверь и окно из блоков попадают в план", () => {
    const r = parseDxf(дом([["ДВЕРЬ-900", 2, 0], ["ОКНО-1400", 5, 6]]));
    expect(r.plan, "план не построился").not.toBeNull();
    const виды = r.plan!.openings.map((o) => o.kind).sort();
    expect(виды, "проёмы не распознаны").toEqual(["door", "window"]);
  });

  it("имя блока сильнее слоя, когда они спорят", () => {
    // В реальных чертежах окна и двери часто лежат на ОДНОМ слое. Слой
    // описывает группу, имя — предмет; при споре верить надо имени.
    // Первая версия склеивала имя со слоем и делала окно на слое A-DOOR
    // дверью — на экране это лишняя дверь в наружной стене.
    const r = parseDxf(дом([["ОКНО-1400", 5, 6]]));
    expect(r.plan!.openings.map((o) => o.kind), "слой перебил имя блока")
      .toEqual(["window"]);
  });

  it("когда имя молчит, вид берётся из слоя", () => {
    // обратная сторона того же правила: безымянный блок на слое дверей —
    // это дверь, и отказываться от подсказки слоя незачем
    const L: string[] = ["0", "SECTION", "2", "ENTITIES"];
    const стена = (x1: number, y1: number, x2: number, y2: number) =>
      L.push("0", "LINE", "8", "A-WALL",
        "10", String(x1), "20", String(y1), "11", String(x2), "21", String(y2));
    стена(0, 0, 8, 0); стена(8, 0, 8, 6); стена(8, 6, 0, 6); стена(0, 6, 0, 0);
    L.push("0", "INSERT", "2", "BLK17", "8", "A-WINDOW", "10", "5", "20", "6");
    L.push("0", "ENDSEC", "0", "EOF");
    // перевод строки собран кодом символа: обратный слэш в передаваемом
    // тексте съедается на границе вызова и попадает в исходник живьём
    const NL = String.fromCharCode(10);
    const r = parseDxf(L.join(NL) + NL);
    expect(r.plan!.openings.map((o) => o.kind)).toEqual(["window"]);
  });

  it("английские имена блоков распознаются так же", () => {
    const r = parseDxf(дом([["DOOR_INT", 2, 0], ["WINDOW-2", 5, 6]]));
    expect(r.plan!.openings.map((o) => o.kind).sort()).toEqual(["door", "window"]);
  });

  it("контроль прибора: БЕЗ блоков проёмов не появляется", () => {
    // иначе «проёмы есть» неотличимо от «мы их выдумываем из стен»
    expect(parseDxf(дом([])).plan!.openings).toEqual([]);
  });

  it("блок далеко от стен не ставится и попадает в счёт", () => {
    const r = parseDxf(дом([["ДВЕРЬ", 4, 3]])); // середина комнаты
    expect(r.plan!.openings.length, "проём поставлен в воздухе").toBe(0);
    expect(r.warnings.join(" ")).toMatch(/рядом нет стены: 1/);
  });

  it("два вида отказа названы РАЗНЫМИ словами", () => {
    // «Рядом нет стены» и «не помещается в стену» — разные причины и разные
    // действия человека. Первое чаще всего значит, что блок вообще не на
    // плане (штамп, условное обозначение); второе — что стена коротка или
    // проёмы налезают. Считать их одним числом значило бы сказать про
    // половину случаев неправду.
    const NL = String.fromCharCode(10);
    const L: string[] = ["0", "SECTION", "2", "ENTITIES"];
    // короткая стена: дверь 0.9 м в неё не влезет
    L.push("0", "LINE", "8", "A-WALL", "10", "0", "20", "0", "11", "0.6", "21", "0");
    L.push("0", "LINE", "8", "A-WALL", "10", "0.6", "20", "0", "11", "0.6", "21", "6");
    L.push("0", "LINE", "8", "A-WALL", "10", "0.6", "20", "6", "11", "0", "21", "6");
    L.push("0", "LINE", "8", "A-WALL", "10", "0", "20", "6", "11", "0", "21", "0");
    L.push("0", "INSERT", "2", "ДВЕРЬ-900", "8", "A-DOOR", "10", "0.3", "20", "0");
    L.push("0", "ENDSEC", "0", "EOF");
    const w = parseDxf(L.join(NL) + NL).warnings.join(" ");
    expect(w, "отказ по размеру назван «рядом нет стены»").toMatch(/не помещается в стену: 1/);
    expect(w, "названа причина, а не только число").toMatch(/стена|проём/i);
    expect(w).not.toMatch(/рядом нет стены/);
  });

  it("незнакомое имя на чужом слое не угадывается", () => {
    // шкаф лежит на слое мебели — ни имя, ни слой не говорят о проёме
    const L: string[] = ["0", "SECTION", "2", "ENTITIES"];
    const стена = (x1: number, y1: number, x2: number, y2: number) =>
      L.push("0", "LINE", "8", "A-WALL",
        "10", String(x1), "20", String(y1), "11", String(x2), "21", String(y2));
    стена(0, 0, 8, 0); стена(8, 0, 8, 6); стена(8, 6, 0, 6); стена(0, 6, 0, 0);
    L.push("0", "INSERT", "2", "ШКАФ-КУПЕ", "8", "A-FURN", "10", "2", "20", "0");
    L.push("0", "ENDSEC", "0", "EOF");
    const NL = String.fromCharCode(10);
    const r = parseDxf(L.join(NL) + NL);
    expect(r.plan!.openings.length).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/имена не опознаны:.*ШКАФ/);
  });

  it("догадка ПО СЛОЮ считается отдельно и называется вслух", () => {
    // Мебель, попавшая на слой дверей, станет дверью — этого не избежать, но
    // молчать об этом нельзя. Человек должен знать, сколько проёмов взято по
    // слою, а не по имени, чтобы знать, что проверять.
    const L: string[] = ["0", "SECTION", "2", "ENTITIES"];
    const стена = (x1: number, y1: number, x2: number, y2: number) =>
      L.push("0", "LINE", "8", "A-WALL",
        "10", String(x1), "20", String(y1), "11", String(x2), "21", String(y2));
    стена(0, 0, 8, 0); стена(8, 0, 8, 6); стена(8, 6, 0, 6); стена(0, 6, 0, 0);
    L.push("0", "INSERT", "2", "BLK17", "8", "A-DOOR", "10", "2", "20", "0");
    L.push("0", "ENDSEC", "0", "EOF");
    const NL = String.fromCharCode(10);
    const r = parseDxf(L.join(NL) + NL);
    expect(r.plan!.openings.length, "подсказка слоя выброшена зря").toBe(1);
    expect(r.warnings.join(" "), "догадка по слою не названа")
      .toMatch(/по СЛОЮ \(имя блока молчит\): 1/);
  });

  it("контроль: проём по ИМЕНИ в счёт догадок не попадает — ОБЕ ветви", () => {
    // ⚠️ Первая редакция проверяла только дверь, и мутации оконной ветви
    // проходили молча: и «узнавать окно по имени», и «считать оконную
    // догадку по слою». Ветви симметричны — значит и проверять их надо
    // симметрично, иначе половина правила не охраняется вовсе.
    for (const имя of ["ДВЕРЬ-900", "ОКНО-1400"]) {
      const r = parseDxf(дом([[имя, 2, 0]]));
      expect(r.warnings.join(" "), `«${имя}» попал в догадки по слою`)
        .not.toMatch(/по СЛОЮ/);
    }
  });

  it("догадка по слою считается у ОБОИХ видов", () => {
    const блок = (слой: string) => {
      const L: string[] = ["0", "SECTION", "2", "ENTITIES"];
      const стена = (x1: number, y1: number, x2: number, y2: number) =>
        L.push("0", "LINE", "8", "A-WALL",
          "10", String(x1), "20", String(y1), "11", String(x2), "21", String(y2));
      стена(0, 0, 8, 0); стена(8, 0, 8, 6); стена(8, 6, 0, 6); стена(0, 6, 0, 0);
      L.push("0", "INSERT", "2", "BLK17", "8", слой, "10", "2", "20", "0");
      L.push("0", "ENDSEC", "0", "EOF");
      const NL = String.fromCharCode(10);
      return parseDxf(L.join(NL) + NL);
    };
    for (const [слой, вид] of [["A-DOOR", "door"], ["A-WINDOW", "window"]] as const) {
      const r = блок(слой);
      expect(r.plan!.openings.map((o) => o.kind), `слой ${слой}`).toEqual([вид]);
      expect(r.warnings.join(" "), `догадка по слою ${слой} не названа`)
        .toMatch(/по СЛОЮ/);
    }
  });

  it("человеку сказано, что ширина ТИПОВАЯ, а не из чертежа", () => {
    // без этого он поверит, что модуль прочитал размер проёма из файла
    const r = parseDxf(дом([["ДВЕРЬ", 2, 0]]));
    expect(r.warnings.join(" ")).toMatch(/ширина проёма взята ТИПОВАЯ/i);
  });

  it("блоки больше не числятся «пропущенными»", () => {
    const r = parseDxf(дом([["ДВЕРЬ", 2, 0]]));
    expect(r.warnings.join(" "), "подпись пережила правку, которая её опровергла")
      .not.toMatch(/блоки — этап 2/);
  });
});

describe("секция BLOCKS не даёт призрачных проёмов", () => {
  // В ЛЮБОМ настоящем DXF есть секция BLOCKS с определениями блоков, и внутри
  // определений тоже стоят INSERT (блок из блоков). Считать их — значит
  // получить проёмы, которых на плане нет: определение не размещено нигде.
  // Мой синтетический пример секции BLOCKS не имел вовсе, поэтому случай
  // проверяется отдельно — иначе первый же настоящий чертёж дал бы призраки.
  const NL = String.fromCharCode(10);

  it("INSERT внутри BLOCKS игнорируется, внутри ENTITIES — нет", () => {
    const L: string[] = [];
    // определение блока: внутри него своя вставка
    L.push("0", "SECTION", "2", "BLOCKS");
    L.push("0", "BLOCK", "2", "ДВЕРЬ-900", "8", "A-DOOR");
    L.push("0", "INSERT", "2", "ДВЕРЬ-СТВОРКА", "8", "A-DOOR", "10", "0", "20", "0");
    L.push("0", "ENDBLK");
    L.push("0", "ENDSEC");
    // а вот настоящее размещение
    L.push("0", "SECTION", "2", "ENTITIES");
    const стена = (x1: number, y1: number, x2: number, y2: number) =>
      L.push("0", "LINE", "8", "A-WALL",
        "10", String(x1), "20", String(y1), "11", String(x2), "21", String(y2));
    стена(0, 0, 8, 0); стена(8, 0, 8, 6); стена(8, 6, 0, 6); стена(0, 6, 0, 0);
    L.push("0", "INSERT", "2", "ДВЕРЬ-900", "8", "A-DOOR", "10", "2", "20", "0");
    L.push("0", "ENDSEC", "0", "EOF");

    const r = parseDxf(L.join(NL) + NL);
    expect(r.plan!.openings.length, "определение блока принято за размещение").toBe(1);
    expect(r.warnings.join(" "), "в счёт попали блоки из секции определений")
      .toMatch(/Блоков в чертеже: 1/);
  });

  it("контроль прибора: та же вставка ВНУТРИ ENTITIES считается", () => {
    // без этого «BLOCKS не считается» неотличимо от «мы не считаем ничего»
    const L: string[] = ["0", "SECTION", "2", "ENTITIES"];
    const стена = (x1: number, y1: number, x2: number, y2: number) =>
      L.push("0", "LINE", "8", "A-WALL",
        "10", String(x1), "20", String(y1), "11", String(x2), "21", String(y2));
    стена(0, 0, 8, 0); стена(8, 0, 8, 6); стена(8, 6, 0, 6); стена(0, 6, 0, 0);
    L.push("0", "INSERT", "2", "ДВЕРЬ-СТВОРКА", "8", "A-DOOR", "10", "2", "20", "0");
    L.push("0", "ENDSEC", "0", "EOF");
    expect(parseDxf(L.join(NL) + NL).warnings.join(" ")).toMatch(/Блоков в чертеже: 1/);
  });
});

describe("невероятный габарит назван вслух", () => {
  // $INSUNITS ставит тот, кто чертил, и ошибиться там легко. Квартира в 0.2 м
  // выглядит как исправно построенная, просто маленькая, — это и есть худший
  // класс дефектов модуля: правдоподобно неверная модель. Человек скорее
  // усомнится в модуле, чем в своём файле.
  const NL = String.fromCharCode(10);
  const план = (единицы: number, размер: number) => {
    const L = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", String(единицы), "0", "ENDSEC",
      "0", "SECTION", "2", "ENTITIES"];
    const w = (a: number, b: number, c: number, d: number) =>
      L.push("0", "LINE", "8", "A-WALL", "10", String(a), "20", String(b), "11", String(c), "21", String(d));
    w(0, 0, размер, 0); w(размер, 0, размер, размер * 0.75);
    w(размер, размер * 0.75, 0, размер * 0.75); w(0, размер * 0.75, 0, 0);
    L.push("0", "ENDSEC", "0", "EOF");
    return parseDxf(L.join(NL) + NL);
  };

  it("кукольный домик из-за неверных единиц — предупреждение", () => {
    // 8 «дюймов» вместо 8 метров: 0.2 м по большей стороне
    const w = план(1, 8).warnings.join(" ");
    expect(w, "модуль молча построил квартиру в 20 см").toMatch(/невероятно/i);
    expect(w, "не названы единицы, в которых сомневаемся").toMatch(/дюймы/i);
  });

  it("стадион из-за неверных единиц — тоже предупреждение", () => {
    // 8000 «метров» вместо 8000 мм
    expect(план(6, 8000).warnings.join(" ")).toMatch(/невероятно/i);
  });

  it("контроль: у правдоподобной квартиры такого предупреждения НЕТ", () => {
    // иначе «предупреждаем» неотличимо от «предупреждаем всегда», и человек
    // перестанет читать
    for (const [ед, размер] of [[6, 8], [4, 8000], [5, 800]] as const) {
      expect(план(ед, размер).warnings.join(" "), `единицы ${ед}, размер ${размер}`)
        .not.toMatch(/невероятно/i);
    }
  });

  it("модель всё равно строится — предупреждение, а не отказ", () => {
    // отказать значило бы решить за человека: бывают и макеты, и залы
    expect(план(1, 8).plan, "модуль отказался строить вместо предупреждения")
      .not.toBeNull();
  });
});
