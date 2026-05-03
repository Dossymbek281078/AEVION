// Демо-заполнение сметы для Level 2 — студент видит реалистичный пример.
// Объёмы по крылу Б школы №47: 32 класса, 4 эт., h=3.2м.

import type { Lsr } from "./types";

export function applyDemoFill(lsr: Lsr): Lsr {
  return {
    ...lsr,
    meta: {
      ...lsr.meta,
      strojkaTitle: "Капитальный ремонт СОШ №47, г. Алматы, ул. Жандосова 56",
      strojkaCode: "02-2026-ПВП 20",
      objectTitle: "Учебный корпус, крыло Б — классные комнаты 1–4 этаж",
      objectCode: "2-02",
      lsrNumber: "2-02-01-01",
      worksTitle: "Демонтажные и отделочные работы крыла Б (32 классных комнаты)",
      osnovanje: "РП Том 2. Альбом 2. Черт. ОР-05..08",
      priceDate: "декабрь 2025 г.",
      author: "Ваше ФИО",
    },
    sections: lsr.sections.map((s) => {
      switch (s.id) {
        case "l2-s1": return {
          ...s,
          positions: [
            { id: "d-dem-1", rateCode: "ДЕМ-15-01-001", volume: 26.99, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "ЕНиР прил. 1 п. 2 — школа действующая" }], formula: "32 × (90 − 3.78 − 1.89) = 32 × 84.33 = 2699 м² / 100 = 26.99", drawingRef: "ОР-05" },
            { id: "d-dem-2", rateCode: "ДЕМ-11-02-001", volume: 18.00, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "ЕНиР прил. 1 п. 2" }], formula: "1800 м² (крыло Б, все этажи) / 100 = 18.00", drawingRef: "ОР-05" },
            { id: "d-dem-3", rateCode: "ДЕМ-06-01-001", volume: 64,    coefficients: [], formula: "32 кл × 2 окна = 64 шт", drawingRef: "ОР-07" },
            { id: "d-dem-4", rateCode: "ДЕМ-06-02-001", volume: 32,    coefficients: [], formula: "32 кл × 1 дверь = 32 шт", drawingRef: "ОР-07" },
          ],
        };
        case "l2-s2": return {
          ...s,
          positions: [
            { id: "d-sht-1", rateCode: "ОТД-13-01-001", volume: 26.99, coefficients: [{ kind: "действующий-объект", value: 1.15, justification: "ЕНиР прил. 1 п. 2" }], formula: "2699 м² / 100 = 26.99", drawingRef: "ОР-06" },
            { id: "d-sht-2", rateCode: "ОТД-15-02-003", volume: 26.99, coefficients: [], formula: "26.99 (100 м²)", drawingRef: "ОР-06" },
          ],
        };
        case "l2-s3": return {
          ...s,
          positions: [
            { id: "d-okr-1", rateCode: "ОТД-15-04-001", volume: 26.99, coefficients: [], formula: "2699 м² / 100 = 26.99", drawingRef: "ОР-06" },
            { id: "d-okr-2", rateCode: "ОТД-15-06-005", volume: 217.6, coefficients: [], formula: "Откосы окон: 64×(2×(2.1+1.8)×0.15)=74.9 + двери 32×(2×2.1×0.15)=20.2 + потолки 122.5 = 217.6 м²", drawingRef: "ОР-07" },
          ],
        };
        case "l2-s4": return {
          ...s,
          positions: [
            { id: "d-pol-1", rateCode: "ОТД-11-02-001", volume: 18.00, coefficients: [], formula: "1800 м² / 100 = 18.00", drawingRef: "ОР-05" },
            { id: "d-pol-2", rateCode: "ОТД-11-04-002", volume: 15.60, coefficients: [], formula: "32 кл × 48.75 м² = 1560 / 100 = 15.60", drawingRef: "ОР-05" },
          ],
        };
        case "l2-s5": return {
          ...s,
          positions: [
            { id: "d-okna-1", rateCode: "ОТД-06-02-001", volume: 143.36, coefficients: [], formula: "64 окна × 1.4×1.6 м² = 143.36 м²", drawingRef: "ОР-07" },
            { id: "d-okna-2", rateCode: "ОТД-06-01-001", volume: 32,     coefficients: [], formula: "32 двери × 1 шт = 32 шт", drawingRef: "ОР-07" },
          ],
        };
        default: return s;
      }
    }),
    updatedAt: new Date().toISOString(),
  };
}
