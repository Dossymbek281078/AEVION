import type { ЭлементТекста } from "./dimensionScale";
import type { RoomType } from "./roomTypes";

/**
 * Подписи комнат из текста PDF: «Кухня», «Мастер спальня», «Детский санузел».
 *
 * Основатель 15.09: «нет распознавания комнат по типу, там же были указаны
 * названия». Были — но CAD пишет подписи ПО ОДНОЙ БУКВЕ, а в LA VIE ещё и
 * справа налево (глифы в потоке идут с убывающим x): собранные по x слова
 * выходили зеркальными («янхуК»). Здесь буквы собираются в слова по базовой
 * линии и шагу, направление определяется по порядку глифов, слова — в строки,
 * строки одной подписи — по вертикальному шагу.
 */
export interface Подпись {
  text: string;
  /** центр подписи в координатах листа PDF (пункты) */
  x: number;
  y: number;
}

const СЛОВАРЬ: Array<[RegExp, RoomType]> = [
  [/(с\/у|сан ?узел|санузл|ванн|туалет|душ|wc|bath|toilet)/i, "bath"],
  [/(кухн|kitchen|столов)/i, "kitchen"],
  [/(спальн|детск|bedroom|кабинет)/i, "bedroom"],
  [/(гостин|зал|living)/i, "living"],
  [/(холл|прихож|коридор|тамбур|гардероб|прачечн|кладов|постирочн|hall|entry)/i, "hall"],
];

/** Тип комнаты по подписи; null — подпись не про комнату (мебель, штамп, заголовок). */
export function roomTypeFromLabel(text: string): RoomType | null {
  for (const [re, t] of СЛОВАРЬ) if (re.test(text)) return t;
  return null;
}

interface Глиф { c: string; x: number; y: number; w: number; size: number; order: number }

/**
 * Собирает подписи из элементов pdf.js. Учитываются только горизонтальные
 * элементы (размерные числа стоят вдоль стен под любым углом — их сюда не надо).
 */
export function подписиИзТекста(items: ЭлементТекста[]): Подпись[] {
  const глифы: Глиф[] = [];
  items.forEach((it, order) => {
    const t = it.transform;
    if (!t || t.length < 6) return;
    if (Math.abs(t[1]) > 0.05 * Math.abs(t[0])) return; // повёрнутый текст
    const size = Math.abs(t[3]) || Math.abs(t[0]);
    if (!(size > 0)) return;
    const s = it.str ?? "";
    if (!s.trim()) return;
    // элемент бывает и словом целиком, и одной буквой — оба случая ниже
    глифы.push({ c: s, x: t[4], y: t[5], w: it.width > 0 ? it.width : size * 0.6 * s.length, size, order });
  });
  if (глифы.length === 0) return [];

  // 1. буквы → слова: та же базовая линия, тот же кегль, шаг не больше 1.6 кегля
  глифы.sort((a, b) => a.y - b.y || a.x - b.x);
  const слова: Глиф[][] = [];
  for (const g of глифы) {
    let положен = false;
    for (const w of слова) {
      const last = w[w.length - 1];
      const первый = w[0];
      if (Math.abs(last.y - g.y) <= 0.3 * g.size && Math.abs(last.size - g.size) < 0.3 * g.size
        && g.x - last.x >= -0.2 * g.size && g.x - Math.max(...w.map((q) => q.x)) <= 1.6 * g.size
        && g.x >= первый.x - 0.2 * g.size) {
        w.push(g); положен = true; break;
      }
    }
    if (!положен) слова.push([g]);
  }
  interface Слово { text: string; x0: number; x1: number; y: number; size: number; order: number }
  const тексты: Слово[] = слова.map((w) => {
    // Порядок чтения — порядок В ПОТОКЕ, а не по x: CAD пишет буквы в порядке
    // чтения, а в LA VIE ставит их зеркально (первая буква правее всех) — по x
    // слово выходило «янхуК». По x глифы только группируются в слово.
    const поX = [...w].sort((a, b) => a.x - b.x);
    const text = [...w].sort((a, b) => a.order - b.order).map((q) => q.c).join("");
    return { text, x0: поX[0].x, x1: Math.max(...w.map((q) => q.x + q.w)), y: w[0].y, size: w[0].size, order: Math.min(...w.map((q) => q.order)) };
  }).filter((w) => /[A-Za-zА-Яа-яЁё]{2}/.test(w.text));

  // 2. слова одной строки → фраза (промежуток до 2 кеглей: в LA VIE пробел «Мастер спальня» = 1.6), строки одной подписи
  //    → подпись (вертикальный шаг до 1.6 кегля, горизонтальное пересечение)
  тексты.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const строки: Слово[][] = [];
  for (const w of тексты) {
    const s = строки.find((r) => Math.abs(r[r.length - 1].y - w.y) <= 0.3 * w.size && w.x0 - r[r.length - 1].x1 <= 2.0 * w.size && w.x0 >= r[r.length - 1].x0);
    if (s) s.push(w); else строки.push([w]);
  }
  // слова в строке — по порядку потока, как и буквы: в LA VIE «Мастер» стоит ПРАВЕЕ «спальня»
  const фразы = строки.map((r) => ({
    text: [...r].sort((a, b) => a.order - b.order).map((w) => w.text).join(" "), x0: Math.min(...r.map((w) => w.x0)), x1: Math.max(...r.map((w) => w.x1)),
    y: r[0].y, size: r[0].size,
  }));
  const подписи: Array<{ lines: typeof фразы }> = [];
  for (const f of фразы) {
    const p = подписи.find((g) => {
      const last = g.lines[g.lines.length - 1];
      const dy = Math.abs(f.y - last.y);
      const пересекаются = f.x0 <= last.x1 + f.size && f.x1 >= last.x0 - f.size;
      return dy > 0.3 * f.size && dy <= 1.6 * f.size && пересекаются && Math.abs(last.size - f.size) < 0.3 * f.size;
    });
    if (p) p.lines.push(f); else подписи.push({ lines: [f] });
  }
  return подписи.map((g) => {
    const x0 = Math.min(...g.lines.map((l) => l.x0)), x1 = Math.max(...g.lines.map((l) => l.x1));
    const ys = g.lines.map((l) => l.y);
    // строки подписи — сверху вниз по листу (в PDF y растёт вверх, значит по убыванию y)
    const text = [...g.lines].sort((a, b) => b.y - a.y).map((l) => l.text).join(" ");
    return { text, x: (x0 + x1) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  });
}

/**
 * Подписи → назначения комнат. Подпись с известным типом ставится той комнате,
 * в которой стоит её центр (roomAt по метрам). Первая подпись комнаты выигрывает:
 * «Мастер спальня» и «Мастер санузел» лежат в разных комнатах, а «полки» и
 * «термомикс» типа не имеют и комнату не переименовывают.
 */
export function назначенияПоПодписям(
  labels: Подпись[],
  originPt: { x: number; y: number },
  metersPerPt: number,
  roomAt: (x: number, y: number) => number | null,
): { types: Record<number, RoomType>; names: Record<number, string>; unplaced: string[] } {
  const types: Record<number, RoomType> = {};
  const names: Record<number, string> = {};
  const unplaced: string[] = [];
  for (const l of labels) {
    const t = roomTypeFromLabel(l.text);
    if (!t) continue;
    const idx = roomAt((l.x - originPt.x) * metersPerPt, (l.y - originPt.y) * metersPerPt);
    if (idx === null) { unplaced.push(l.text); continue; }
    if (idx in types) continue;
    types[idx] = t;
    names[idx] = l.text;
  }
  return { types, names, unplaced };
}
