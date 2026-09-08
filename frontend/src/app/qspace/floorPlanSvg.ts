/**
 * QSpace — чертёж сверху в SVG: то, что печатают и берут на стройку.
 *
 * Зачем именно 2D. Снимок 3D красив, но по нему не работают: прорабу нужен
 * вид сверху с размерами, площадями помещений и обозначенными проёмами.
 * Такой лист печатают, кладут в карман и сверяют на месте.
 *
 * SVG, а не картинка: печатается без потери качества на любом принтере, весит
 * килобайты и открывается в браузере без нашего сайта.
 *
 * 🔴 ГРАНИЦА (пишется прямо на листе): это планировочная схема, а не рабочий
 * чертёж. Размеры сняты с модели, построенной по вашему файлу и вашему
 * масштабу; для заказа окон и мебели по ним измеряйте на месте.
 */

import type { Opening, Plan, Wall } from "./planModel";
import { pointOnWall } from "./planModel";
import type { Room } from "./rooms";

export interface PlanSvgOptions {
  /** пикселей на метр в готовом файле */
  scale?: number;
  /** поля вокруг чертежа, м */
  margin?: number;
  /** подписи площадей помещений */
  rooms?: Room[];
  /** заголовок листа */
  title?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function bounds(plan: Plan) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of plan.walls) {
    minX = Math.min(minX, w.x1, w.x2); minY = Math.min(minY, w.y1, w.y2);
    maxX = Math.max(maxX, w.x1, w.x2); maxY = Math.max(maxY, w.y1, w.y2);
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

/** Длина стены, м. */
function wallLength(w: Wall): number {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

/**
 * Строит SVG-чертёж плана сверху.
 *
 * Ось Y переворачивается: в плане она растёт вверх, в SVG — вниз. Без этого
 * чертёж выйдет зеркальным, и это не бросается в глаза — заметят уже на
 * стройке.
 */
export function floorPlanSvg(plan: Plan, opts: PlanSvgOptions = {}): string {
  const scale = opts.scale ?? 50;
  const margin = opts.margin ?? 1.2;
  const b = bounds(plan);
  const W = b.maxX - b.minX;
  const H = b.maxY - b.minY;
  const px = (v: number) => (v * scale).toFixed(1);

  const width = (W + margin * 2) * scale;
  const height = (H + margin * 2) * scale + 70; // место под подпись внизу

  // мир -> лист: сдвиг на поля и переворот Y
  const X = (x: number) => (x - b.minX + margin) * scale;
  const Y = (y: number) => (b.maxY - y + margin) * scale;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px(W + margin * 2)}" `
    + `height="${height.toFixed(1)}" viewBox="0 0 ${(width).toFixed(1)} ${height.toFixed(1)}" `
    + `font-family="system-ui, sans-serif">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

  if (opts.title) {
    parts.push(
      `<text x="${(margin * scale).toFixed(1)}" y="${(margin * scale * 0.55).toFixed(1)}" `
      + `font-size="16" font-weight="600" fill="#1f1d1a">${esc(opts.title)}</text>`,
    );
  }

  // --- стены -------------------------------------------------------------
  for (const w of plan.walls) {
    const t = Math.max(2, w.thickness * scale);
    parts.push(
      `<line x1="${X(w.x1).toFixed(1)}" y1="${Y(w.y1).toFixed(1)}" `
      + `x2="${X(w.x2).toFixed(1)}" y2="${Y(w.y2).toFixed(1)}" `
      + `stroke="#2b2b2b" stroke-width="${t.toFixed(1)}" stroke-linecap="butt"/>`,
    );
  }

  // --- проёмы: белым поверх стены, двери с дугой открывания ---------------
  for (const o of plan.openings) {
    const w = plan.walls[o.wall];
    if (!w) continue;
    const a = pointOnWall(w, o.offset);
    const c = pointOnWall(w, o.offset + o.width);
    const t = Math.max(3, w.thickness * scale + 1);
    parts.push(
      `<line x1="${X(a.x).toFixed(1)}" y1="${Y(a.y).toFixed(1)}" `
      + `x2="${X(c.x).toFixed(1)}" y2="${Y(c.y).toFixed(1)}" `
      + `stroke="#ffffff" stroke-width="${t.toFixed(1)}"/>`,
    );
    if (o.kind === "window") {
      // окно — тонкая линия по оси проёма
      parts.push(
        `<line x1="${X(a.x).toFixed(1)}" y1="${Y(a.y).toFixed(1)}" `
        + `x2="${X(c.x).toFixed(1)}" y2="${Y(c.y).toFixed(1)}" `
        + `stroke="#4a7fb5" stroke-width="2"/>`,
      );
    } else {
      // дверь — четверть дуги, как на настоящих чертежах
      const r = o.width * scale;
      parts.push(
        `<path d="M ${X(a.x).toFixed(1)} ${Y(a.y).toFixed(1)} `
        + `a ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(X(c.x) - X(a.x)).toFixed(1)} `
        + `${(Y(c.y) - Y(a.y)).toFixed(1)}" fill="none" stroke="#8b6f4e" stroke-width="1.2"/>`,
      );
    }
  }

  // --- подписи помещений --------------------------------------------------
  for (const r of opts.rooms ?? []) {
    parts.push(
      `<text x="${X(r.cx).toFixed(1)}" y="${Y(r.cy).toFixed(1)}" font-size="13" `
      + `text-anchor="middle" fill="#3a352e">${r.index}</text>`,
    );
    parts.push(
      `<text x="${X(r.cx).toFixed(1)}" y="${(Y(r.cy) + 15).toFixed(1)}" font-size="11" `
      + `text-anchor="middle" fill="#6a645a">${r.area.toFixed(1)} м²</text>`,
    );
  }

  // --- размеры габарита ---------------------------------------------------
  const dimY = Y(b.minY) + margin * scale * 0.45;
  parts.push(
    `<line x1="${X(b.minX).toFixed(1)}" y1="${dimY.toFixed(1)}" `
    + `x2="${X(b.maxX).toFixed(1)}" y2="${dimY.toFixed(1)}" stroke="#8a857c" stroke-width="1"/>`,
    `<text x="${((X(b.minX) + X(b.maxX)) / 2).toFixed(1)}" y="${(dimY - 5).toFixed(1)}" `
    + `font-size="12" text-anchor="middle" fill="#4a453d">${W.toFixed(2)} м</text>`,
  );
  const dimX = X(b.minX) - margin * scale * 0.45;
  parts.push(
    `<line x1="${dimX.toFixed(1)}" y1="${Y(b.minY).toFixed(1)}" `
    + `x2="${dimX.toFixed(1)}" y2="${Y(b.maxY).toFixed(1)}" stroke="#8a857c" stroke-width="1"/>`,
    `<text x="${dimX.toFixed(1)}" y="${((Y(b.minY) + Y(b.maxY)) / 2).toFixed(1)}" `
    + `font-size="12" text-anchor="middle" fill="#4a453d" `
    + `transform="rotate(-90 ${dimX.toFixed(1)} ${((Y(b.minY) + Y(b.maxY)) / 2).toFixed(1)})">`
    + `${H.toFixed(2)} м</text>`,
  );

  // --- длины стен, только заметные ---------------------------------------
  // Подпись сдвигается ПЕРПЕНДИКУЛЯРНО стене и рисуется с белой обводкой:
  // на снимке первой версии числа лежали прямо на чёрной стене и не читались
  // вовсе — а лист печатают и берут на стройку.
  for (const w of plan.walls) {
    const len = wallLength(w);
    if (len < 1) continue; // короткие подписывать незачем — будет каша
    // Стену во всю ширину или высоту плана не подписываем: её длина уже
    // стоит габаритным размером, и две одинаковые цифры налезали друг на
    // друга («8.8.00м» на снимке первой версии).
    if (Math.abs(len - W) < 0.02 || Math.abs(len - H) < 0.02) continue;
    const mx = (X(w.x1) + X(w.x2)) / 2;
    const my = (Y(w.y1) + Y(w.y2)) / 2;
    // единичная нормаль к стене на листе
    const dx = X(w.x2) - X(w.x1);
    const dy = Y(w.y2) - Y(w.y1);
    const L = Math.hypot(dx, dy) || 1;
    const off = Math.max(10, w.thickness * scale * 0.5 + 8);
    const nx = (-dy / L) * off;
    const ny = (dx / L) * off;
    parts.push(
      `<text x="${(mx + nx).toFixed(1)}" y="${(my + ny + 3).toFixed(1)}" font-size="10" `
      + `text-anchor="middle" fill="#4a453d" stroke="#ffffff" stroke-width="3" `
      + `paint-order="stroke" stroke-linejoin="round">${len.toFixed(2)}</text>`,
    );
  }

  // --- честная подпись листа ----------------------------------------------
  const footY = height - 42;
  parts.push(
    `<text x="${(margin * scale).toFixed(1)}" y="${footY.toFixed(1)}" font-size="11" fill="#6a645a">`
    + `Планировочная схема QSpace. Это НЕ рабочий чертёж.</text>`,
    `<text x="${(margin * scale).toFixed(1)}" y="${(footY + 15).toFixed(1)}" font-size="11" fill="#6a645a">`
    + `Размеры сняты с модели по вашему файлу и вашему масштабу — перед заказом окон`,
    `</text>`,
    `<text x="${(margin * scale).toFixed(1)}" y="${(footY + 29).toFixed(1)}" font-size="11" fill="#6a645a">`
    + `и мебели измеряйте на месте. Цифры у стен — длина в метрах.</text>`,
  );

  parts.push("</svg>");
  return parts.join("\n");
}
