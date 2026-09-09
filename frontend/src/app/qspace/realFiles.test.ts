import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parseDxf } from "./dxf";
import { readPdfSegments, planFromPdfSegments } from "./pdf";
import { findRooms } from "./rooms";
import { estimatePlan } from "./estimate";
import { generateWiring, generatePlumbing, generateLights } from "./planModel";

/**
 * Прогон на НАСТОЯЩИХ файлах, которые лежат у основателя в папке проекта.
 *
 * Стандарт требует проверять на реальных данных, а не на синтетике
 * собственного изготовления: свои примеры я подгоняю под свой же разбор, не
 * замечая этого. Эти файлы человек открывает первыми, и если разбор их
 * сломается, узнает он, а не я.
 *
 * Файлы лежат ВНЕ репозитория (в OneDrive), поэтому тест их отсутствие
 * ПРОПУСКАЕТ, а не роняет: на чужой машине репозиторий должен собираться.
 * Но пропуск объявляется вслух — молчаливый пропуск неотличим от прохода.
 */
const ПАПКА = path.join(
  process.env.USERPROFILE ?? "C:/Users/user",
  "OneDrive", "Desktop", "АЕВИОН", "21-QSpace-3D-модельер", "примеры",
);
let разобрано = 0;
const есть = (имя: string) => existsSync(path.join(ПАПКА, имя));

describe("настоящие файлы из папки основателя", () => {
  it("сама папка примеров на месте (иначе всё ниже пропустится молча)", () => {
    if (!existsSync(ПАПКА)) {
      console.warn(`ПРОПУСК: папки примеров нет — ${ПАПКА}`);
      return;
    }
    expect(existsSync(ПАПКА)).toBe(true);
  });

  it("DXF-квартира разбирается и даёт помещения и смету", () => {
    if (!есть("квартира-9x7.dxf")) { console.warn("ПРОПУСК: нет квартира-9x7.dxf"); return; }
    const r = parseDxf(readFileSync(path.join(ПАПКА, "квартира-9x7.dxf"), "utf8"));
    разобрано++;
    expect(r.plan, "настоящий DXF основателя перестал разбираться").not.toBeNull();
    const plan = r.plan!;
    expect(plan.walls.length).toBeGreaterThan(3);

    const rooms = findRooms(plan);
    expect(rooms.rooms.length, "в настоящей квартире не нашлось ни одного помещения")
      .toBeGreaterThan(0);

    const est = estimatePlan(plan, generateWiring(plan), generatePlumbing(plan), generateLights(plan).length);
    expect(est, "смета по настоящему файлу не посчиталась").toBeTruthy();
  });

  it("PDF-план разбирается тем же путём, что и в интерфейсе", async () => {
    if (!есть("план-12x8.pdf")) { console.warn("ПРОПУСК: нет план-12x8.pdf"); return; }
    const bytes = new Uint8Array(readFileSync(path.join(ПАПКА, "план-12x8.pdf")));
    const src = await readPdfSegments(bytes);
    const r = planFromPdfSegments(src, 12);
    // масштаб человек задаёт сам, поэтому проверяем разбор, а не готовый план
    expect(src.segments.length, "в настоящем PDF не нашлось ни одного отрезка")
      .toBeGreaterThan(0);
    разобрано++;
    expect(r.plan, "настоящий PDF основателя перестал давать план").not.toBeNull();
  });

  it("если папка на месте — файлы РЕАЛЬНО разобраны, а не пропущены молча", () => {
    // Пропуск по отсутствию файла — законная ветка, но она делает весь набор
    // зелёным при нуле работы. Знаменатель отличает «проверено» от «нечего
    // было проверять».
    if (!existsSync(ПАПКА)) return;
    expect(разобрано, "папка примеров есть, а разобрано файлов ноль")
      .toBeGreaterThanOrEqual(2);
  });

  it("контроль: подделанный DXF НЕ проходит как настоящий", () => {
    // без этого «настоящий файл разобрался» неотличимо от «разбирается всё»
    const r = parseDxf("это не чертёж");
    expect(r.plan === null || r.plan.walls.length === 0).toBe(true);
  });
});

describe("чертёж с блоками проёмов — настоящий файл из папки", () => {
  // ⚠️ ЧЕСТНАЯ ГРАНИЦА: этот файл собран мной по правилам формата, а НЕ
  // выгружен из настоящего AutoCAD. Значит проверено, что разбор понимает
  // корректный DXF с блоками; НЕ проверено, что он справится с выгрузкой
  // реального проекта, где бывают вложенные блоки, атрибуты, повёрнутые
  // вставки и имена на латинице с транслитом. Первый чужой файл — это
  // проверка, а не подтверждение.
  const файл = path.join(ПАПКА, "квартира-с-проёмами.dxf");

  it("проёмы распознаны, мебель — нет", () => {
    if (!existsSync(файл)) { console.warn("ПРОПУСК: нет квартира-с-проёмами.dxf"); return; }
    const r = parseDxf(readFileSync(файл, "utf8"));
    expect(r.plan, "план не построился").not.toBeNull();
    const виды = r.plan!.openings.map((o) => o.kind);
    expect(виды.filter((k) => k === "door").length, "дверей не три").toBe(3);
    expect(виды.filter((k) => k === "window").length, "окон не три").toBe(3);
    expect(r.warnings.join(" "), "шкаф принят за проём").toMatch(/ШКАФ/);
  });

  it("человеку названы обе оговорки: догадка по слою и типовая ширина", () => {
    if (!existsSync(файл)) return;
    const w = parseDxf(readFileSync(файл, "utf8")).warnings.join(" ");
    expect(w).toMatch(/по СЛОЮ/);
    expect(w).toMatch(/ширина проёма взята ТИПОВАЯ/i);
  });

  it("контроль: единицы взяты из $INSUNITS, а не угаданы", () => {
    // файл в миллиметрах; угадывание по габариту дало бы тот же ответ, но
    // источник обязан быть заголовком — иначе чертёж в метрах сломается
    if (!existsSync(файл)) return;
    expect(parseDxf(readFileSync(файл, "utf8")).unitLabel).toMatch(/\$INSUNITS/);
  });
});
