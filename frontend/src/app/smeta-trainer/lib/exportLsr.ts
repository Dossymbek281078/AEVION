// Экспорт ЛСР в CSV (открывается в Excel) и HTML (для печати/PDF).

import type { Lsr, LsrCalc, Ks2Period } from "./types";
import { formatKzt } from "./calc";
import { buildXlsx, downloadBlob, type Cell, type Sheet } from "./xlsx";

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

// ── XLSX (настоящий Excel-файл, pure-TS, без зависимостей) ──────────────────

export function exportToXlsx(lsr: Lsr, calc: LsrCalc): void {
  const rows: Cell[][] = [];

  // Шапка
  rows.push([{ v: "ЛОКАЛЬНАЯ СМЕТНАЯ РАСЧЁТ", style: "header" }]);
  rows.push([{ v: lsr.meta?.lsrNumber ?? "" }, { v: lsr.title }]);
  rows.push([{ v: "Объект:" }, { v: lsr.meta?.objectTitle ?? "" }]);
  rows.push([{ v: "Стройка:" }, { v: lsr.meta?.strojkaTitle ?? "" }]);
  rows.push([{ v: "Основание:" }, { v: lsr.meta?.osnovanje ?? "" }]);
  rows.push([{ v: "Дата цен:" }, { v: lsr.meta?.priceDate ?? "" }]);
  rows.push([{ v: "Метод:" }, { v: lsr.method }, { v: lsr.indexRegion }, { v: lsr.indexQuarter }]);
  rows.push([]);

  // Заголовки таблицы
  rows.push([
    { v: "№ п/п", style: "header" },
    { v: "Обоснование", style: "header" },
    { v: "Наименование работ и затрат", style: "header" },
    { v: "Ед. изм.", style: "header" },
    { v: "Количество", style: "header" },
    { v: "Стоимость ед., ₸", style: "header" },
    { v: "Общая стоимость, ₸", style: "header" },
    { v: "в т.ч. ФОТ", style: "header" },
    { v: "в т.ч. ЭМ", style: "header" },
    { v: "в т.ч. Материалы", style: "header" },
    { v: "Коэффициенты", style: "header" },
  ]);

  let posNum = 0;
  for (const sc of calc.sections) {
    rows.push([
      {}, {}, { v: sc.section.title, style: "subtotal" },
    ]);
    for (const p of sc.positions) {
      posNum++;
      const coefStr = p.position.coefficients.length > 0
        ? p.position.coefficients.map((c) => `К=${c.value}`).join(" × ")
        : "";
      rows.push([
        { v: posNum, fmt: "int" },
        { v: p.rate.code },
        { v: p.rate.title },
        { v: p.rate.unit },
        { v: p.position.volume, fmt: "num" },
        { v: Math.round(p.unitPrice), fmt: "money" },
        { v: Math.round(p.current.direct), fmt: "money" },
        { v: Math.round(p.current.fot), fmt: "money" },
        { v: Math.round(p.current.em), fmt: "money" },
        { v: Math.round(p.current.materials), fmt: "money" },
        { v: coefStr },
      ]);
    }
    if (sc.positions.length > 0) {
      rows.push([
        {}, {}, { v: "Итого ПЗ по разделу:", style: "total" },
        {}, {}, {},
        { v: Math.round(sc.direct), fmt: "money", style: "total" },
      ]);
    }
    rows.push([]);
  }

  // Итоги
  const totalDirect = calc.sections.reduce((s, sc) => s + sc.direct, 0);
  const totalOverhead = calc.sections.reduce((s, sc) => s + sc.overhead + sc.profit, 0);
  rows.push([
    {}, {}, { v: "ВСЕГО прямых затрат:", style: "total" },
    {}, {}, {}, { v: Math.round(totalDirect), fmt: "money", style: "total" },
  ]);
  rows.push([
    {}, {}, { v: "НР + СП:", style: "total" },
    {}, {}, {}, { v: Math.round(totalOverhead), fmt: "money", style: "total" },
  ]);
  rows.push([
    {}, {}, { v: "НДС 12%:", style: "total" },
    {}, {}, {}, { v: Math.round(calc.vat), fmt: "money", style: "total" },
  ]);
  rows.push([
    {}, {}, { v: "ИТОГО с НДС:", style: "total" },
    {}, {}, {}, { v: Math.round(calc.totalWithVat), fmt: "money", style: "total" },
  ]);
  rows.push([]);
  rows.push([{ v: "Составил:" }, { v: lsr.meta?.author ?? "" }]);

  const sheet: Sheet = {
    name: "ЛСР",
    rows,
    colWidths: [6, 18, 50, 8, 10, 14, 14, 14, 14, 14, 18],
  };

  const blob = buildXlsx([sheet]);
  downloadBlob(blob, `ЛСР_${lsr.meta?.lsrNumber ?? lsr.id}.xlsx`);
}

// ── КС-3 Справка о стоимости ─────────────────────────────────────────────────

/**
 * Выгружает накопительную справку КС-3 в CSV для одного отчётного периода.
 * activePeriodId — за какой период; yearStartId — от какого периода считать
 * «с начала года». Если оба не заданы — берёт первый и последний из periods.
 */
export function exportKs3ToCsv(
  lsr: Lsr,
  calc: LsrCalc,
  periods: Ks2Period[],
  activePeriodId?: string,
  yearStartId?: string,
): void {
  const VAT = 0.12;
  const activeIdx = activePeriodId
    ? periods.findIndex((p) => p.id === activePeriodId)
    : periods.length - 1;
  const yearIdx = yearStartId
    ? periods.findIndex((p) => p.id === yearStartId)
    : 0;
  const active = periods[activeIdx];
  if (!active) {
    alert("Нет активного отчётного периода для КС-3. Заведите период в КС-2.");
    return;
  }

  // unitPrice + sectionId for каждой позиции
  const meta = new Map<string, { unitPrice: number; sectionId: string }>();
  for (const sc of calc.sections) {
    for (const p of sc.positions) {
      meta.set(p.position.id, { unitPrice: p.unitPrice, sectionId: sc.section.id });
    }
  }
  function sumPeriod(p: Ks2Period | undefined, sectionId?: string): number {
    if (!p) return 0;
    let s = 0;
    for (const [posId, vol] of Object.entries(p.volumes)) {
      const m = meta.get(posId);
      if (!m) continue;
      if (sectionId && m.sectionId !== sectionId) continue;
      s += m.unitPrice * vol;
    }
    return s;
  }

  const rows: string[][] = [];
  rows.push(["СПРАВКА О СТОИМОСТИ ВЫПОЛНЕННЫХ РАБОТ И ЗАТРАТ (форма КС-3)"]);
  rows.push(["Стройка:", lsr.title]);
  rows.push(["Метод:", lsr.method, lsr.indexRegion, lsr.indexQuarter]);
  rows.push(["Отчётный период:", active.name]);
  rows.push(["С начала года:", periods[yearIdx]?.name ?? ""]);
  rows.push([]);

  rows.push([
    "№", "Наименование работ и затрат",
    "Сметная стоимость",
    "За отчётный период",
    "С начала года",
    "С начала строительства",
  ]);
  let n = 0;
  let periodTotal = 0, yearTotal = 0, allTotal = 0;
  for (const sc of calc.sections) {
    n++;
    const cost = sumPeriod(active, sc.section.id);
    let yearCost = 0;
    for (let i = Math.max(0, yearIdx); i <= activeIdx; i++) {
      yearCost += sumPeriod(periods[i], sc.section.id);
    }
    let allCost = 0;
    for (let i = 0; i <= activeIdx; i++) {
      allCost += sumPeriod(periods[i], sc.section.id);
    }
    periodTotal += cost;
    yearTotal += yearCost;
    allTotal += allCost;
    rows.push([
      String(n),
      `${sc.section.title} (${sc.section.category})`,
      String(Math.round(sc.total)),
      String(Math.round(cost)),
      String(Math.round(yearCost)),
      String(Math.round(allCost)),
    ]);
  }
  rows.push([]);
  rows.push(["", "ИТОГО:",
    String(Math.round(calc.totalBeforeVat)),
    String(Math.round(periodTotal)),
    String(Math.round(yearTotal)),
    String(Math.round(allTotal)),
  ]);
  rows.push(["", `НДС ${(VAT * 100).toFixed(0)}%:`,
    String(Math.round(calc.vat)),
    String(Math.round(periodTotal * VAT)),
    String(Math.round(yearTotal * VAT)),
    String(Math.round(allTotal * VAT)),
  ]);
  rows.push(["", "ВСЕГО к оплате:",
    String(Math.round(calc.totalWithVat)),
    String(Math.round(periodTotal * (1 + VAT))),
    String(Math.round(yearTotal * (1 + VAT))),
    String(Math.round(allTotal * (1 + VAT))),
  ]);
  rows.push([]);
  rows.push(["Заказчик:", "________________"]);
  rows.push(["Подрядчик:", "________________"]);

  const csv = "﻿" + rows.map((r) => r.map(escCsv).join(",")).join("\r\n");
  const safeName = active.name.replace(/[^а-яёА-ЯЁa-zA-Z0-9_-]+/g, "_");
  downloadText(csv, `КС3_${safeName}_${lsr.id}.csv`, "text/csv;charset=utf-8");
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
