import { describe, expect, it } from "vitest";
import { applyReferenceFixes, hasMechanicalFixes } from "./examFix";
import type { Lsr, SmetaPosition } from "./types";
import type { ExamReport, PositionDiff } from "./examGrader";

function pos(rateCode: string, volume: number, id = rateCode): SmetaPosition {
  return { id, rateCode, volume, coefficients: [] };
}

function lsr(positions: SmetaPosition[], sections2: SmetaPosition[] = []): Lsr {
  return {
    id: "l", title: "L", objectId: "o", method: "базисно-индексный",
    indexQuarter: "q", indexRegion: "r",
    sections: [
      { id: "s1", title: "Раздел 1", category: "земляные", positions },
      // Категория берётся из WorkCategory. Было "бетонные" — такой в типе нет,
      // и продукт её не создаёт, то есть фикстура проверяла невозможный раздел.
      { id: "s2", title: "Раздел 2", category: "общестроительные", positions: sections2 },
    ],
    createdAt: "", updatedAt: "",
  };
}

const diff = (over: Partial<PositionDiff> & { rateCode: string; status: PositionDiff["status"] }): PositionDiff => ({
  rateTitle: "T", unit: "м3", refVolume: 0, studentVolume: 0, deltaPct: 0, score: 0, ...over,
});

function report(positions: PositionDiff[]): ExamReport {
  return {
    score: 50, grade: "удовл.",
    breakdown: {
      ai: { score: 0, weight: 40, notices: [] },
      coverage: { score: 0, weight: 30, matched: 0, total: 0 },
      volumes: { score: 0, weight: 20, avgDeltaPct: 0 },
      total: { score: 0, weight: 10, deltaPct: 0 },
    },
    positions, refTotal: 0, studentTotal: 0,
  };
}

describe("applyReferenceFixes", () => {
  it("приводит объём к эталонному", () => {
    const student = lsr([pos("A", 12)]);
    const ref = lsr([pos("A", 10)]);
    const r = applyReferenceFixes(student, report([diff({ rateCode: "A", status: "off-volume", refVolume: 10, studentVolume: 12 })]), ref);
    expect(r.lsr.sections[0].positions[0].volume).toBe(10);
    expect(r.counts.volume).toBe(1);
  });

  it("удаляет лишнюю позицию", () => {
    const student = lsr([pos("A", 10), pos("Z", 3)]);
    const ref = lsr([pos("A", 10)]);
    const r = applyReferenceFixes(student, report([diff({ rateCode: "Z", status: "extra" })]), ref);
    expect(r.lsr.sections[0].positions.map((p) => p.rateCode)).toEqual(["A"]);
    expect(r.counts.removed).toBe(1);
  });

  it("добавляет пропущенную позицию с эталонным объёмом и коэффициентами", () => {
    const student = lsr([pos("A", 10)]);
    const refPos: SmetaPosition = {
      id: "B", rateCode: "B", volume: 7,
      coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "СН РК 8.02-10" }],
    };
    const ref = lsr([pos("A", 10), refPos]);
    const r = applyReferenceFixes(student, report([diff({ rateCode: "B", status: "missing", refVolume: 7 })]), ref);
    const added = r.lsr.sections[0].positions.find((p) => p.rateCode === "B")!;
    expect(added.volume).toBe(7);
    expect(added.coefficients[0].value).toBe(1.15);
    expect(r.counts.added).toBe(1);
  });

  it("не мутирует исходную ЛСР", () => {
    const student = lsr([pos("A", 12)]);
    const ref = lsr([pos("A", 10)]);
    applyReferenceFixes(student, report([diff({ rateCode: "A", status: "off-volume", refVolume: 10 })]), ref);
    expect(student.sections[0].positions[0].volume).toBe(12); // оригинал цел
  });

  it("не трогает позиции со статусом match", () => {
    const student = lsr([pos("A", 10)]);
    const ref = lsr([pos("A", 10)]);
    const r = applyReferenceFixes(student, report([diff({ rateCode: "A", status: "match", refVolume: 10, studentVolume: 10 })]), ref);
    expect(r.counts).toEqual({ volume: 0, removed: 0, added: 0 });
    expect(r.lsr.sections[0].positions[0].volume).toBe(10);
  });

  it("пропускает missing, которого нет в эталоне", () => {
    const student = lsr([pos("A", 10)]);
    const ref = lsr([pos("A", 10)]);
    const r = applyReferenceFixes(student, report([diff({ rateCode: "GHOST", status: "missing", refVolume: 5 })]), ref);
    expect(r.counts.added).toBe(0);
  });

  it("комбинирует все три типа за один проход", () => {
    const student = lsr([pos("A", 99), pos("Z", 1)]);
    const ref = lsr([pos("A", 10), pos("B", 4)]);
    const r = applyReferenceFixes(
      student,
      report([
        diff({ rateCode: "A", status: "off-volume", refVolume: 10 }),
        diff({ rateCode: "Z", status: "extra" }),
        diff({ rateCode: "B", status: "missing", refVolume: 4 }),
      ]),
      ref,
    );
    expect(r.counts).toEqual({ volume: 1, removed: 1, added: 1 });
    const codes = r.lsr.sections[0].positions.map((p) => p.rateCode).sort();
    expect(codes).toEqual(["A", "B"]);
  });
});

describe("hasMechanicalFixes", () => {
  it("true при наличии off-volume/extra/missing", () => {
    expect(hasMechanicalFixes(report([diff({ rateCode: "A", status: "missing" })]))).toBe(true);
  });
  it("false когда только match и AI-замечания", () => {
    expect(hasMechanicalFixes(report([diff({ rateCode: "A", status: "match" })]))).toBe(false);
  });
});
