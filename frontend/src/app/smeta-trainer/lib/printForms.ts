/**
 * Печатные учебные формы → PDF средствами браузера (без внешних зависимостей).
 *
 * buildLsrFormHtml собирает самодостаточный HTML-документ Формы 4* (ЛСР) с
 * print-стилями; openPrintWindow открывает его в новом окне и вызывает печать
 * (пользователь сохраняет в PDF). Билдер чистый (без DOM) — см. printForms.test.ts.
 */

import type { Lsr, LsrCalc } from "./types";
import { formatKzt } from "./calc";

function esc(s: string | number | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; font-size: 11px; color: #111; margin: 24px; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 4px; text-transform: uppercase; }
  .sub { text-align: center; font-size: 11px; color: #444; margin-bottom: 12px; }
  .meta { width: 100%; margin-bottom: 10px; }
  .meta td { padding: 1px 4px; vertical-align: top; }
  .meta .k { color: #555; white-space: nowrap; width: 110px; }
  table.lsr { width: 100%; border-collapse: collapse; }
  table.lsr th, table.lsr td { border: 1px solid #999; padding: 3px 4px; }
  table.lsr th { background: #eee; font-weight: bold; font-size: 10px; text-align: center; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.section td { background: #f3f3f3; font-weight: bold; }
  tr.subtotal td { font-style: italic; }
  tr.total td { font-weight: bold; background: #f7f7f7; }
  .sign { margin-top: 24px; display: flex; justify-content: space-between; }
  .sign .line { border-top: 1px solid #111; width: 180px; text-align: center; padding-top: 2px; color: #555; font-size: 10px; }
  .toolbar { margin-bottom: 16px; }
  .toolbar button { font-family: sans-serif; font-size: 13px; padding: 6px 14px; cursor: pointer; }
  @media print { .toolbar { display: none; } body { margin: 0; } }
`;

/** Самодостаточный HTML Формы 4* (ЛСР) для печати / сохранения в PDF. */
export function buildLsrFormHtml(lsr: Lsr, calc: LsrCalc): string {
  const m = lsr.meta ?? {};
  const totalDirect = calc.sections.reduce((s, sc) => s + sc.direct, 0);
  const totalOverhead = calc.sections.reduce((s, sc) => s + sc.overhead + sc.profit, 0);

  let posNum = 0;
  const bodyRows: string[] = [];
  for (const sc of calc.sections) {
    if (sc.positions.length === 0) continue;
    bodyRows.push(`<tr class="section"><td colspan="8">${esc(sc.section.title)}</td></tr>`);
    for (const p of sc.positions) {
      posNum += 1;
      const coef =
        p.position.coefficients.length > 0
          ? p.position.coefficients.map((c) => `К=${c.value}`).join(" × ")
          : "";
      bodyRows.push(
        `<tr>` +
          `<td class="num">${posNum}</td>` +
          `<td>${esc(p.rate.code)}</td>` +
          `<td>${esc(p.rate.title)}${coef ? ` <span style="color:#777">[${esc(coef)}]</span>` : ""}</td>` +
          `<td>${esc(p.rate.unit)}</td>` +
          `<td class="num">${esc(p.position.volume)}</td>` +
          `<td class="num">${formatKzt(Math.round(p.unitPrice))}</td>` +
          `<td class="num">${formatKzt(Math.round(p.current.direct))}</td>` +
          `<td class="num">${formatKzt(Math.round(p.current.fot))}</td>` +
          `</tr>`,
      );
    }
    bodyRows.push(
      `<tr class="subtotal"><td colspan="6">Итого ПЗ по разделу «${esc(sc.section.title)}»</td>` +
        `<td class="num">${formatKzt(Math.round(sc.direct))}</td><td></td></tr>`,
    );
  }

  const totalsRows = [
    `<tr class="total"><td colspan="6">ВСЕГО прямых затрат</td><td class="num">${formatKzt(Math.round(totalDirect))}</td><td></td></tr>`,
    `<tr class="total"><td colspan="6">Накладные расходы + сметная прибыль</td><td class="num">${formatKzt(Math.round(totalOverhead))}</td><td></td></tr>`,
    `<tr class="total"><td colspan="6">НДС 12%</td><td class="num">${formatKzt(Math.round(calc.vat))}</td><td></td></tr>`,
    `<tr class="total"><td colspan="6">ИТОГО с НДС</td><td class="num">${formatKzt(Math.round(calc.totalWithVat))}</td><td></td></tr>`,
  ];

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>ЛСР ${esc(m.lsrNumber ?? lsr.id)}</title>
<style>${PRINT_CSS}</style></head>
<body>
<div class="toolbar"><button onclick="window.print()">🖨 Печать / Сохранить в PDF</button></div>
<h1>Локальный сметный расчёт (Форма 4*)</h1>
<div class="sub">НДЦС РК 8.01-08-2022 · учебная форма AEVION</div>
<table class="meta">
  <tr><td class="k">Стройка:</td><td>${esc(m.strojkaTitle)}</td><td class="k">№ ЛСР:</td><td>${esc(m.lsrNumber)}</td></tr>
  <tr><td class="k">Объект:</td><td>${esc(m.objectTitle ?? lsr.title)}</td><td class="k">Основание:</td><td>${esc(m.osnovanje)}</td></tr>
  <tr><td class="k">Метод:</td><td>${esc(lsr.method)}</td><td class="k">Цены:</td><td>${esc(m.priceDate ?? `${lsr.indexRegion} ${lsr.indexQuarter}`)}</td></tr>
</table>
<table class="lsr">
  <thead><tr>
    <th style="width:30px">№</th><th style="width:90px">Обоснование</th>
    <th>Наименование работ и затрат</th><th style="width:46px">Ед.</th>
    <th style="width:60px">Кол-во</th><th style="width:90px">Цена ед., ₸</th>
    <th style="width:100px">Стоимость, ₸</th><th style="width:90px">в т.ч. ФОТ</th>
  </tr></thead>
  <tbody>
    ${bodyRows.join("\n    ") || `<tr><td colspan="8" style="text-align:center;color:#888">Смета пуста</td></tr>`}
    ${totalsRows.join("\n    ")}
  </tbody>
</table>
<div class="sign">
  <div class="line">Составил${m.author ? `: ${esc(m.author)}` : ""}</div>
  <div class="line">Проверил</div>
</div>
</body></html>`;
}

/** Открыть HTML в новом окне и инициировать печать (PDF — через диалог браузера). */
export function openPrintWindow(html: string): boolean {
  if (typeof window === "undefined") return false;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return false; // заблокирован поп-ап
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
