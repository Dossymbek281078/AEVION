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

  it("контроль: обычное имя апострофом НЕ портится", () => {
    expect(estimateCsv(смета(), "Квартира на Абая")).toContain("Квартира на Абая");
  });
});
