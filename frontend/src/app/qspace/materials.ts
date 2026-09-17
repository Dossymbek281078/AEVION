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

/** Рисунок укладки — то, что человек выбирает для плитки и доски. */
export type Layout = "straight" | "offset" | "diagonal" | "herringbone";
export const LAYOUTS: Array<{ id: Layout; name: string }> = [
  { id: "straight", name: "прямая" },
  { id: "offset", name: "со смещением" },
  { id: "diagonal", name: "по диагонали" },
  { id: "herringbone", name: "ёлочка" },
];

/** Цвет материала — палитра поверх позиции каталога; смета считает ту же позицию. */
export interface Colorway { id: string; name: string; colors: string[] }
export const TILE_COLORWAYS: Colorway[] = [
  { id: "white", name: "белый", colors: ["#e4e1db", "#c4c0b8"] },
  { id: "beige", name: "бежевый", colors: ["#dccdb8", "#bfae96"] },
  { id: "grey", name: "серый", colors: ["#bdbbb6", "#9e9c97"] },
  { id: "graphite", name: "графит", colors: ["#5a5b5c", "#434445"] },
  { id: "terracotta", name: "терракота", colors: ["#c48a67", "#a36f50"] },
  { id: "sage", name: "шалфей", colors: ["#b9c4b6", "#98a494"] },
  { id: "navy", name: "синий", colors: ["#4f5f78", "#3b485c"] },
];
export const WOOD_COLORWAYS: Colorway[] = [
  { id: "light", name: "светлый", colors: ["#dccbb0", "#d0bea2", "#c7b496"] },
  { id: "natural", name: "натуральный", colors: ["#c9a87c", "#bd9a6c", "#b08c5f"] },
  { id: "dark", name: "тёмный", colors: ["#7a5a42", "#6b4d38", "#5c422f"] },
  { id: "grey", name: "серый", colors: ["#a8a29a", "#9a948b", "#8c867d"] },
];

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
  /** рисунок укладки — только у разобранного составного id (см. materialById) */
  layout?: Layout;
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
  // Керамогранит — основной пол ванной, кухни и прихожей в готовых стилях.
  // Отличие от плитки для сметы и человека: плотнее, крупнее формат, ректификат.
  {
    id: "porcelain-grey",
    name: "Керамогранит серый 60×60",
    surface: "floor",
    pattern: "tile",
    colors: ["#c3c1bc", "#a8a6a1"],
    unitM: 0.6,
    note: "ректификат, шов 2 мм",
  },
  {
    id: "porcelain-marble",
    name: "Керамогранит под мрамор 60×120",
    surface: "floor",
    pattern: "tile",
    colors: ["#e6e3de", "#cfcbc4"],
    unitM: 1.2,
    note: "светлый, с прожилками (условно)",
  },
  {
    id: "porcelain-terrazzo",
    name: "Керамогранит терраццо 60×60",
    surface: "floor",
    pattern: "tile",
    colors: ["#d9d3c9", "#b9b1a4"],
    unitM: 0.6,
    note: "крошка не имитируется — тон",
  },
  {
    id: "porcelain-wood",
    name: "Керамогранит под дерево 20×120",
    surface: "floor",
    pattern: "planks",
    colors: ["#b08c62", "#a17f57", "#bb976c", "#98764f"],
    unitM: 1.2,
    note: "для кухни и прихожей: вид дерева, стойкость плитки",
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
  {
    id: "tile-wall-grey",
    name: "Плитка стеновая серая 30×60",
    surface: "wall",
    pattern: "tile",
    colors: ["#cfcdc8", "#b3b1ac"],
    unitM: 0.45,
    note: "санузел, крупный формат",
  },
  {
    id: "porcelain-wall-marble",
    name: "Керамогранит стеновой под мрамор 60×120",
    surface: "wall",
    pattern: "tile",
    colors: ["#e8e5e0", "#d2cec7"],
    unitM: 0.9,
    note: "санузел, минимум швов",
  },
  { id: "paint-graphite", name: "Краска: графит", surface: "wall", pattern: "solid", colors: ["#5b5e60"], unitM: 1, note: "акцентная, матовая" },
  { id: "paint-terracotta", name: "Краска: терракота", surface: "wall", pattern: "solid", colors: ["#c9906e"], unitM: 1, note: "акцентная, матовая" },
  { id: "paint-olive", name: "Краска: олива", surface: "wall", pattern: "solid", colors: ["#a9ab8d"], unitM: 1, note: "матовая" },
];

/**
 * Готовые сочетания «пол + стены» — одной кнопкой вместо двух рядов образцов.
 *
 * Появились 15.09.2026 после вопроса основателя «а где три варианта»: они были
 * в отдельной 3D-странице по плану LA VIE, а на сайте — только образцы по одному.
 * Названия те же, что там; материалы — из каталога выше, отдельных цветов нет,
 * иначе смета считала бы одно, а на экране было бы другое.
 */
export interface FinishPreset {
  id: string;
  name: string;
  wall: string;
  floor: string;
}

export const FINISH_PRESETS: FinishPreset[] = [
  { id: "light-oak", name: "Светлый дуб", wall: "paint-warm-white", floor: "laminate-light" },
  { id: "warm-walnut", name: "Тёплый орех", wall: "paint-sand", floor: "parquet-oak" },
  { id: "graphite", name: "Графит и бетон", wall: "paint-grey", floor: "concrete-floor" },
];

export function materialsFor(surface: Surface): Material[] {
  return MATERIALS.filter((m) => m.surface === surface);
}

/**
 * Какие цвета и укладки доступны позиции: плитка и керамогранит — палитра плитки и
 * четыре укладки; доска и паркет — палитра дерева, прямая / диагональ / ёлочка;
 * краска, бетон, обои — ничего (их цвет — сама позиция).
 */
export function variantsOf(m: Material): { colorways: Colorway[]; layouts: Layout[] } {
  if (m.pattern === "tile") return { colorways: TILE_COLORWAYS, layouts: ["straight", "offset", "diagonal", "herringbone"] };
  if (m.pattern === "planks") return { colorways: WOOD_COLORWAYS, layouts: ["straight", "diagonal", "herringbone"] };
  return { colorways: [], layouts: [] };
}

/**
 * Составной id: `база|c=цвет|l=укладка`. Хранится там же, где обычный id (пол
 * комнаты, проект), поэтому цвет и укладка переживают сохранение и попадают в смету
 * отдельной строкой — «Плитка белая 60×60 · бежевый · по диагонали».
 */
export function composeMaterialId(base: string, colorway?: string, layout?: Layout): string {
  return base + (colorway ? `|c=${colorway}` : "") + (layout && layout !== "straight" ? `|l=${layout}` : "");
}

export function parseMaterialId(id: string): { base: string; colorway?: string; layout?: Layout } {
  const [base, ...rest] = id.split("|");
  const out: { base: string; colorway?: string; layout?: Layout } = { base };
  for (const part of rest) {
    if (part.startsWith("c=")) out.colorway = part.slice(2);
    else if (part.startsWith("l=")) out.layout = part.slice(2) as Layout;
  }
  return out;
}

export function materialById(id: string): Material | undefined {
  const { base, colorway, layout } = parseMaterialId(id);
  const m = MATERIALS.find((x) => x.id === base);
  if (!m) return undefined;
  if (!colorway && !layout) return m;
  const v = variantsOf(m);
  const cw = colorway ? v.colorways.find((c) => c.id === colorway) : undefined;
  const lay = layout && v.layouts.includes(layout) ? layout : undefined;
  if ((colorway && !cw) || (layout && !lay)) return undefined; // чужой цвет/укладка — не позиция каталога
  return {
    ...m,
    id,
    name: m.name + (cw ? ` · ${cw.name}` : "") + (lay ? ` · ${LAYOUTS.find((l) => l.id === lay)?.name}` : ""),
    colors: cw ? cw.colors : m.colors,
    layout: lay,
  };
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
    const grout = m.colors[1] ?? "#b5b1a9";
    const lw = Math.max(2, size * 0.012);
    if (m.layout === "herringbone") { drawHerringbone(ctx, size, [m.colors[0]], grout); return c; }
    if (m.layout === "diagonal") {
      // та же плитка, повёрнутая на 45°: рисуем 2×2 клетки и поворачиваем вокруг центра
      ctx.fillStyle = m.colors[0]; ctx.fillRect(0, 0, size, size);
      ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = grout; ctx.lineWidth = lw;
      const k = size / Math.SQRT2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * k, -size); ctx.lineTo(i * k, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-size, i * k); ctx.lineTo(size, i * k); ctx.stroke(); }
      ctx.restore();
      return c;
    }
    ctx.fillStyle = m.colors[0];
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = grout;
    ctx.lineWidth = lw;
    if (m.layout === "offset") {
      // кирпичная перевязка: две плитки по высоте, нижний ряд сдвинут на половину
      ctx.strokeRect(0, 0, size, size / 2);
      ctx.strokeRect(-size / 2, size / 2, size, size / 2); ctx.strokeRect(size / 2, size / 2, size, size / 2);
      return c;
    }
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

  // planks — доски вразбежку; ёлочка и диагональ — свои укладки
  if (m.layout === "herringbone") { drawHerringbone(ctx, size, m.colors, undefined); return c; }
  if (m.layout === "diagonal") {
    ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(Math.PI / 4); ctx.translate(-size, -size);
    const rowsD = 16, rowHD = (2 * size) / rowsD;
    for (let row = 0; row < rowsD; row++) {
      const off = (row % 2) * size;
      for (let i = -1; i < 4; i++) { ctx.fillStyle = m.colors[(row + i + m.colors.length) % m.colors.length]; ctx.fillRect(i * size + off, row * rowHD, size - 2, rowHD - 2); }
    }
    ctx.restore();
    return c;
  }
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

/** Ёлочка: планки 1×4 под ±45°, чередование цветов; шов — цвет затирки, если задан. */
function drawHerringbone(ctx: CanvasRenderingContext2D, size: number, colors: string[], grout: string | undefined): void {
  const L = size / 2, W = size / 8;
  ctx.fillStyle = grout ?? colors[0]; ctx.fillRect(0, 0, size, size);
  let k = 0;
  for (let y = -size; y < 2 * size; y += W) {
    for (let x = -size; x < 2 * size; x += 2 * W) {
      const col = colors[k++ % colors.length];
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = col; ctx.fillRect(0, 0, L - 2, W - 2); ctx.restore();
      ctx.save(); ctx.translate(x + W * Math.SQRT2, y); ctx.rotate(-Math.PI / 4); ctx.fillStyle = colors[k++ % colors.length]; ctx.fillRect(0, 0, L - 2, W - 2); ctx.restore();
    }
  }
}
