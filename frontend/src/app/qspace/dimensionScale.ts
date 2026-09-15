/**
 * Масштаб PDF-чертежа по его размерным числам — чтобы не спрашивать габарит.
 *
 * PDF масштаба не хранит, но CAD-план подписан размерами в миллиметрах:
 * «1400», «2000», «4200» стоят цепочкой вдоль стены. Надпись каждого отрезка
 * цепочки стоит посередине своего отрезка, поэтому расстояние между центрами
 * СОСЕДНИХ надписей равно (a + b) / 2 мм. Делим на расстояние в пунктах листа —
 * получаем миллиметры в пункте.
 *
 * Отдельная пара врёт: между соседями бывает стена, надпись короткого отрезка
 * выносят в сторону, подписи площадей и отметок стоят в ряд случайно. Поэтому
 * берём САМУЮ ПЛОТНУЮ группу отношений (допуск 1.5 %) и её медиану.
 * Замер на LA VIE.pdf: 63 пары, 12 согласных, 42.59 мм/пт (разброс 0.3 %);
 * пары через стену дают 41.0 — на 3.7 % меньше, и при допуске 3 % они
 * подмешивались бы в группу.
 */

/** Надпись на листе: текст и центр в пунктах листа; ось — вдоль какой прямой она написана. */
export interface СловоНаЛисте {
  text: string;
  x: number;
  y: number;
  axis: "h" | "v";
}

export interface МасштабПоРазмерам {
  mmPerPt: number;
  /** сколько пар соседних чисел рассмотрено */
  pairs: number;
  /** сколько из них согласны с ответом */
  agree: number;
}

/** Меньше стольких согласных пар — ответа нет: три случайных совпадения ещё правдоподобны. */
export const МИН_СОГЛАСНЫХ_ПАР = 3;
const ДОПУСК = 0.015;

/** Элемент текста в том виде, как его отдаёт pdf.js (getTextContent). */
export interface ЭлементТекста {
  str: string;
  transform: number[];
  width: number;
}

/**
 * Из элементов pdf.js — центры числовых надписей. Берём только горизонтальные и
 * вертикальные: наклонные подписи к размерам цепочек не относятся.
 */
export function словаИзТекста(items: ЭлементТекста[]): СловоНаЛисте[] {
  const out: СловоНаЛисте[] = [];
  for (const it of items) {
    const text = (it.str ?? "").trim();
    if (!/^[0-9]{3,5}$/.test(text)) continue;
    const t = it.transform;
    if (!t || t.length < 6) continue;
    const len = Math.hypot(t[0], t[1]);
    if (!(len > 0)) continue;
    const cos = t[0] / len, sin = t[1] / len;
    const axis = Math.abs(sin) < 0.05 ? "h" : Math.abs(cos) < 0.05 ? "v" : null;
    if (!axis) continue;
    const w = Number.isFinite(it.width) ? it.width : 0;
    out.push({ text, x: t[4] + (cos * w) / 2, y: t[5] + (sin * w) / 2, axis });
  }
  return out;
}

export function масштабПоРазмерам(слова: СловоНаЛисте[]): МасштабПоРазмерам | null {
  const отношения: number[] = [];
  for (const axis of ["h", "v"] as const) {
    const ключ = (w: СловоНаЛисте): number => (axis === "h" ? w.y : w.x);
    const место = (w: СловоНаЛисте): number => (axis === "h" ? w.x : w.y);
    const свои = слова
      .filter((w) => w.axis === axis && Number(w.text) >= 100 && Number(w.text) <= 30000)
      .sort((a, b) => ключ(a) - ключ(b));
    const группы: СловоНаЛисте[][] = [];
    let текущая: СловоНаЛисте[] = [];
    for (const w of свои) {
      if (текущая.length > 0 && Math.abs(ключ(w) - ключ(текущая[текущая.length - 1])) > 2) {
        группы.push(текущая);
        текущая = [];
      }
      текущая.push(w);
    }
    if (текущая.length > 0) группы.push(текущая);
    for (const г of группы) {
      const ряд = [...г].sort((a, b) => место(a) - место(b));
      for (let i = 1; i < ряд.length; i++) {
        const d = место(ряд[i]) - место(ряд[i - 1]);
        if (d > 3) отношения.push((Number(ряд[i - 1].text) + Number(ряд[i].text)) / 2 / d);
      }
    }
  }
  let лучшая: number[] = [];
  for (const r of отношения) {
    const группа = отношения.filter((x) => Math.abs(x - r) / r <= ДОПУСК);
    if (группа.length > лучшая.length) лучшая = группа;
  }
  if (лучшая.length < МИН_СОГЛАСНЫХ_ПАР) return null;
  лучшая.sort((a, b) => a - b);
  return { mmPerPt: лучшая[Math.floor(лучшая.length / 2)], pairs: отношения.length, agree: лучшая.length };
}
