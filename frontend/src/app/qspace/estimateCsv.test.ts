import { describe, expect, it } from "vitest";
import { estimateCsv, estimatePlan } from "./estimate";
import { demoPlan, generateLights, generatePlumbing, generateWiring, planWallHeight } from "./planModel";
import { findRooms } from "./rooms";
import { roomSpec } from "./roomSpec";

/**
 * Список закупки должен УНОСИТЬСЯ с экрана.
 *
 * Скопировать со страницы можно было только разбивку по комнатам; кабель,
 * трубы, розетки и светильники оставались на экране, и в магазин человек шёл
 * с телефоном в руке.
 *
 * Колонки цен ПУСТЫЕ намеренно: цен мы не знаем — они зависят от города,
 * поставщика и дня, — а число без источника хуже отсутствующего. Человек
 * вписывает свои, сумма считается формулой, которую он видит.
 */
function смета() {
  const plan = demoPlan();
  const rooms = findRooms(plan);
  const pr = roomSpec(rooms.rooms, planWallHeight(plan));
  return estimatePlan(
    plan, generateWiring(plan), generatePlumbing(plan),
    generateLights(plan, rooms).length, rooms.totalArea, pr.totals.wallArea,
  );
}

describe("спецификация таблицей", () => {
  const csv = estimateCsv(смета(), "Квартира на Абая");

  it("все позиции сметы на месте — ни одна не потерялась по дороге", () => {
    for (const имя of [
      "Пол", "Покрытие пола", "Стены", "Краска", "Розетки",
      "Выключатели", "Кабель", "Трубы воды", "Канализация", "Светильники",
    ]) {
      expect(csv, `позиция «${имя}» пропала из выгрузки`).toContain(имя);
    }
  });

  it("контроль прибора: выдуманной позиции в файле НЕТ", () => {
    // иначе «все позиции на месте» неотличимо от «в файле есть любое слово»
    expect(csv).not.toContain("Золотые унитазы");
  });

  it("цены НЕ придуманы: колонка есть, значения пустые", () => {
    expect(csv, "нет колонки для цены — человеку некуда вписать свою").toContain("Цена за единицу");
    const строкиПозиций = csv.split(/\r?\n/).filter((s) => /^"(Пол|Краска|Розетки)/.test(s));
    expect(строкиПозиций.length).toBeGreaterThanOrEqual(3);
    for (const s of строкиПозиций) {
      const поля = s.split(";");
      expect(поля[3], `в строке «${поля[0]}» подставлена цена: ${поля[3]}`).toBe("");
    }
  });

  it("сумма считается формулой, а не записана числом", () => {
    expect(csv).toMatch(/=B\d+\*D\d+/);
    expect(csv, "итог тоже обязан быть формулой").toMatch(/ИТОГО[^\n]*=E\d+(\+E\d+)+/);
  });

  it("формулы БЕЗ имён функций — иначе не сработают в русском Excel", () => {
    // имена функций переводятся: SUM в ru-Excel не существует, а + и * работают
    expect(csv).not.toMatch(/=SUM\(|=СУММ\(/);
  });

  it("числа с запятой — пара к разделителю «;», иначе Excel читает их текстом", () => {
    expect(csv).toMatch(/;\d+,\d+;/);
  });

  it("BOM на месте — без него Excel покажет кракозябры вместо русских слов", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("имя плана из ЧУЖОГО файла не исполняется как формула", () => {
    // строка, начинающаяся с =, + или -, в таблице выполняется. Имя приходит
    // из файла человека, то есть это чужой ввод.
    const опасное = estimateCsv(смета(), "=cmd|'/c calc'!A1");
    expect(опасное, "имя плана уехало в файл формулой").toContain("'=cmd");
    expect(опасное).not.toMatch(/\n"=cmd/);
  });

  it("разбивка по помещениям: строк столько же, сколько комнат", () => {
    const plan = demoPlan();
    const rooms = findRooms(plan);
    const pr = roomSpec(rooms.rooms, planWallHeight(plan));
    const сРазбивкой = estimateCsv(смета(), "Демо", pr.lines);
    expect(сРазбивкой).toContain("Разбивка по помещениям");
    const строки = сРазбивкой.split(/\r?\n/).filter((s2) => /^\d+;/.test(s2));
    expect(строки.length, "число строк разбивки разошлось с числом комнат")
      .toBe(pr.lines.length);
    expect(pr.lines.length, "контроль: комнат в демо больше одной").toBeGreaterThan(1);
  });

  it("у разбивки НЕТ колонок цены — иначе одно и то же считалось бы дважды", () => {
    const plan = demoPlan();
    const pr = roomSpec(findRooms(plan).rooms, planWallHeight(plan));
    const csv2 = estimateCsv(смета(), "Демо", pr.lines);
    const шапка = csv2.split(/\r?\n/).find((s2) => s2.startsWith("Помещение;"));
    expect(шапка, "шапка разбивки не найдена").toBeTruthy();
    expect(шапка!, "в разбивку попала цена — два ответа об одном на одном листе")
      .not.toMatch(/Цена|Сумма/);
  });

  it("контроль: без комнат блока разбивки НЕТ, а не пустая шапка", () => {
    expect(estimateCsv(смета(), "Демо", [])).not.toContain("Разбивка по помещениям");
  });

  it("контроль: обычное имя апострофом НЕ портится", () => {
    expect(estimateCsv(смета(), "Квартира на Абая")).toContain("Квартира на Абая");
  });
});

/**
 * ИНЖЕНЕРИЯ ДОЛЖНА УЕХАТЬ В ФАЙЛ.
 *
 * Замер 30.09.2026: тёплый пол, вентиляция и кондиционирование считались и
 * показывались на странице тремя таблицами, а в выгрузку не попадали ни одним
 * числом. Человек уносил подрядчику ровно ту половину, по которой НЕ считают
 * котёл, вытяжку и сплиты. Проверяем не «есть заголовок», а что в файле те
 * САМЫЕ числа, которые передали: заголовок без чисел — это бланк.
 */
describe("инженерия в спецификации", () => {
  const инженерия = {
    heating: {
      rooms: [{ index: 1, heatedArea: 49.7, pipeLength: 331, loops: 4, power: 4972 }],
      totals: { heatedArea: 49.7, pipeLength: 331, loops: 4, power: 4972 },
    },
    vent: {
      rooms: [{ index: 1, kind: "кухня", area: 12.3, flow: 60, needsFan: true }],
      totalFlow: 210,
    },
    cooling: {
      rooms: [
        { index: 1, area: 20.5, needWatt: 2100, pick: { btu: 9000, name: "Сплит 9" } },
        { index: 2, area: 90.0, needWatt: 9900, pick: null },
      ],
    },
    items: [{ name: "Кровать двуспальная", count: 2 }],
  };
  const csv = estimateCsv(смета(), "Демо", [], [], инженерия);

  it("тёплый пол уехал с числами, а не одним заголовком", () => {
    expect(csv).toContain("Тёплый пол");
    expect(csv).toMatch(/"Помещение 1";49,7;331;4;4972/);
    expect(csv).toMatch(/"ИТОГО";49,7;331;4;4972/);
  });

  it("вентиляция: расход и признак вытяжки", () => {
    expect(csv).toMatch(/"Помещение 1";"кухня";12,3;60;да/);
    expect(csv).toContain(";210;");
  });

  it("кондиционирование: подобранное и НЕподобранное названы словами", () => {
    expect(csv).toMatch(/"Помещение 1";20,5;2100;"Сплит 9 \(9000 BTU\)"/);
    // Пустая клетка читалась бы как «сплит не нужен» — противоположный смысл.
    expect(csv).toContain("типоразмера не хватает");
  });

  it("оборудование сведено по количеству", () => {
    expect(csv).toMatch(/"Кровать двуспальная";2;шт/);
  });

  it("без инженерии файл прежний — разделов нет", () => {
    const без = estimateCsv(смета(), "Демо");
    for (const слово of ["Тёплый пол", "Вентиляция —", "Кондиционирование —", "Оборудование и мебель"]) {
      expect(без, `раздел «${слово}» появился там, где инженерию не передавали`).not.toContain(слово);
    }
  });

  it("контроль прибора: пустая инженерия не создаёт пустых таблиц", () => {
    const пусто = estimateCsv(смета(), "Демо", [], [], {
      heating: { rooms: [], totals: { heatedArea: 0, pipeLength: 0, loops: 0, power: 0 } },
      vent: { rooms: [], totalFlow: 0 }, cooling: { rooms: [] }, items: [],
    });
    expect(пусто).not.toContain("Тёплый пол");
    // И сам прибор не всегда зелёный: непустая инженерия раздел даёт.
    expect(csv).toContain("Тёплый пол");
  });
});
