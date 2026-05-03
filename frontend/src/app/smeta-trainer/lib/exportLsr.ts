// Экспорт ЛСР в CSV (открывается в Excel) и HTML (для печати/PDF).

import type { Lsr, LsrCalc } from "./types";
import { formatKzt } from "./calc";

// ── CSV ──────────────────────────────────────────────────────────────────────

function escCsv(v: string | number | undefined): string {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function exportToCsv(lsr: Lsr, calc: LsrCalc): void {
  const rows: string[][] = [];

  // Шапка
  rows.push(["ЛОКАЛЬНАЯ СМЕТНАЯ РАСЧЁТ"]);
  rows.push([lsr.meta?.lsrNumber ?? "", lsr.title]);
  rows.push(["Объект:", lsr.meta?.objectTitle ?? ""]);
  rows.push(["Стройка:", lsr.meta?.strojkaTitle ?? ""]);
  rows.push(["Основание:", lsr.meta?.osnovanje ?? ""]);
  rows.push(["Дата цен:", lsr.meta?.priceDate ?? ""]);
  rows.push(["Метод:", lsr.method, lsr.indexRegion, lsr.indexQuarter]);
  rows.push([]);

  // Заголовки таблицы
  rows.push([
    "№ п/п",
    "Обоснование",
    "Наименование работ и затрат",
    "Ед. изм.",
    "Количество",
    "Стоимость ед., тнг.",
    "Общая стоимость, тнг.",
    "в т.ч. ФОТ",
    "в т.ч. ЭМ",
    "в т.ч. Материалы",
    "Коэффициенты",
  ]);

  let posNum = 0;
  for (const sc of calc.sections) {
    // Строка раздела
    rows.push(["", "", sc.section.title, "", "", "", "", "", "", "", ""]);
    for (const p of sc.positions) {
      posNum++;
      const coefStr = p.position.coefficients.length > 0
        ? p.position.coefficients.map((c) => `К=${c.value}`).join(" × ")
        : "";
      rows.push([
        String(posNum),
        p.rate.code,
        p.rate.title,
        p.rate.unit,
        String(p.position.volume),
        String(Math.round(p.unitPrice)),
        String(Math.round(p.current.direct)),
        String(Math.round(p.current.fot)),
        String(Math.round(p.current.em)),
        String(Math.round(p.current.materials)),
        coefStr,
      ]);
    }
    if (sc.positions.length > 0) {
      rows.push(["", "", "Итого прямых затрат по разделу:", "", "", "", String(Math.round(sc.direct)), "", "", "", ""]);
    }
    rows.push([]);
  }

  // Итоги
  const totalDirect   = calc.sections.reduce((s, sc) => s + sc.direct, 0);
  const totalOverhead = calc.sections.reduce((s, sc) => s + sc.overhead + sc.profit, 0);
  rows.push(["", "", "ВСЕГО прямых затрат:", "", "", "", String(Math.round(totalDirect))]);
  rows.push(["", "", "НР + СП:", "", "", "", String(Math.round(totalOverhead))]);
  rows.push(["", "", "НДС 12%:", "", "", "", String(Math.round(calc.vat))]);
  rows.push(["", "", "ИТОГО с НДС:", "", "", "", String(Math.round(calc.totalWithVat))]);
  rows.push([]);
  rows.push(["Составил:", lsr.meta?.author ?? ""]);

  const csvContent = "﻿" + rows.map((r) => r.map(escCsv).join(",")).join("\r\n");
  downloadText(csvContent, `ЛСР_${lsr.meta?.lsrNumber ?? lsr.id}.csv`, "text/csv;charset=utf-8");
}

// ── JSON (резервная копия) ────────────────────────────────────────────────────

export function exportToJson(lsr: Lsr): void {
  const json = JSON.stringify(lsr, null, 2);
  downloadText(json, `smeta_backup_${lsr.id}.json`, "application/json");
}

export function importFromJson(file: File, onLoad: (lsr: Lsr) => void): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const lsr = JSON.parse(e.target?.result as string) as Lsr;
      if (lsr.id && Array.isArray(lsr.sections)) onLoad(lsr);
      else alert("Неверный формат файла — ожидается JSON сметы AEVION.");
    } catch {
      alert("Ошибка чтения файла.");
    }
  };
  reader.readAsText(file);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
