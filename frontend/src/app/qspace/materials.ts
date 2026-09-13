/**
 * QSpace — каталог отделочных материалов.
 *
 * Данные отдельно от отрисовки: текстуры рисуются процедурно на canvas,
 * поэтому позиция каталога — это ПАРАМЕТРЫ рисунка, а не путь к картинке.
 * Так каталог растёт без единого мегабайта ассетов и работает офлайн.
 *
 * ⚠️ Цены НЕ здесь и не выдуманы. Их назначает основатель (правило 6), и
 * пока их нет, спецификация считает ОБЪЁМЫ (м², л, м, шт), а не деньги.
 * Число без источника хуже отсутствующего числа.
 */

export type Surface = "floor" | "wall";

export interface Material {
  id: string;
  name: string;
  surface: Surface;
  /** как рисовать: вид рисунка + палитра (HEX) */
  pattern: "planks" | "tile" | "solid" | "stripes";
  colors: string[];
  /** размер элемента рисунка в метрах — задаёт масштаб повторения */
  unitM: number;
  /** короткая честная подпись для человека */
  note: string;
}

export const MATERIALS: Material[] = [
  // --- полы ---------------------------------------------------------------
  {
    id: "parquet-oak",
    name: "Паркет дуб",
    surface: "floor",
    pattern: "planks",
    colors: ["#a9834f", "#9a7644", "#b28d59", "#8f6c3e"],
    unitM: 0.6,
    note: "ёлочка не имитируется — доски вразбежку",
  },
  {
    id: "laminate-light",
    name: "Ламинат светлый",
    surface: "floor",
    pattern: "planks",
    colors: ["#c9ab7e", "#c2a375", "#d0b288", "#bd9d6f"],
    unitM: 1.2,
    note: "доска 1.2 м, вразбежку",
  },
  {
    id: "laminate-grey",
    name: "Ламинат серый",
    surface: "floor",
    pattern: "planks",
    colors: ["#b4b0aa", "#a9a5a0", "#bdb9b3", "#9e9a95"],
    unitM: 1.2,
    note: "доска 1.2 м, вразбежку",
  },
  {
    id: "tile-white",
    name: "Плитка белая 60×60",
    surface: "floor",
    pattern: "tile",
    colors: ["#d8d5cf", "#b5b1a9"],
    unitM: 0.6,
    note: "шов 3 мм условный",
  },
  {
    id: "tile-dark",
    name: "Плитка тёмная 30×30",
    surface: "floor",
    pattern: "tile",
    colors: ["#5c5a56", "#474540"],
    unitM: 0.3,
    note: "для санузла и прихожей",
  },
  {
    id: "concrete-floor",
    name: "Бетон / микроцемент",
    surface: "floor",
    pattern: "solid",
    colors: ["#a5a099"],
    unitM: 1,
    note: "ровный тон без рисунка",
  },

  // --- стены ---------------------------------------------------------------
  { id: "paint-warm-white", name: "Краска: тёплый белый", surface: "wall", pattern: "solid", colors: ["#e8e4da"], unitM: 1, note: "матовая" },
  { id: "paint-sage", name: "Краска: шалфей", surface: "wall", pattern: "solid", colors: ["#dfe6e2"], unitM: 1, note: "матовая" },
  { id: "paint-sand", name: "Краска: песочный", surface: "wall", pattern: "solid", colors: ["#e7dfd2"], unitM: 1, note: "матовая" },
  { id: "paint-powder", name: "Краска: голубая пудра", surface: "wall", pattern: "solid", colors: ["#d9dee8"], unitM: 1, note: "матовая" },
  { id: "paint-rose", name: "Краска: пыльная роза", surface: "wall", pattern: "solid", colors: ["#e6d9d3"], unitM: 1, note: "матовая" },
  { id: "paint-grey", name: "Краска: светло-серый", surface: "wall", pattern: "solid", colors: ["#d6d3cd"], unitM: 1, note: "матовая" },
  {
    id: "wallpaper-stripe",
    name: "Обои в полоску",
    surface: "wall",
    pattern: "stripes",
    colors: ["#e9e3d8", "#d8cfc0"],
    unitM: 0.1,
    note: "полоса 10 см",
  },
  {
    id: "tile-wall-white",
    name: "Плитка стеновая 20×30",
    surface: "wall",
    pattern: "tile",
    colors: ["#eceae5", "#cfccc5"],
    unitM: 0.25,
    note: "кухонный фартук, санузел",
  },
];

export function materialsFor(surface: Surface): Material[] {
  return MATERIALS.filter((m) => m.surface === surface);
}

export function materialById(id: string): Material | undefined {
  return MATERIALS.find((m) => m.id === id);
}

/**
 * Рисует текстуру материала на canvas.
 *
 * `pxPerM` — сколько пикселей приходится на метр в самой картинке; повтор
 * по сцене задаёт вызывающий (repeat.set), потому что он знает габарит
 * помещения. Разделение важно: если масштаб задавать здесь, одна и та же
 * плитка на разных планах будет разного физического размера.
 */
export function drawMaterial(m: Material, pxPerM = 256): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const size = Math.max(64, Math.round(m.unitM * pxPerM));
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  if (m.pattern === "solid") {
    ctx.fillStyle = m.colors[0];
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  if (m.pattern === "tile") {
    ctx.fillStyle = m.colors[0];
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = m.colors[1] ?? "#b5b1a9";
    ctx.lineWidth = Math.max(2, size * 0.012);
    ctx.strokeRect(0, 0, size, size);
    return c;
  }

  if (m.pattern === "stripes") {
    const w = size / 4;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = m.colors[i % m.colors.length];
      ctx.fillRect(i * w, 0, w, size);
    }
    return c;
  }

  // planks — доски вразбежку
  const rows = 8;
  const rowH = size / rows;
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * (size / 2);
    for (let i = -1; i < 3; i++) {
      ctx.fillStyle = m.colors[(row + i + m.colors.length) % m.colors.length];
      ctx.fillRect(i * size + off, row * rowH, size - 2, rowH - 2);
    }
  }
  return c;
}
