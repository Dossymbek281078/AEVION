/**
 * «Где моя последняя ошибка?» — ответ считает ДВИЖОК, тренер (ИИ) только объясняет готовый вывод.
 *
 * Повод 31.10.2026 (находки Продаж, Playwright, ловушка Легаля 1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.Nc3 g6
 * 5.Nxe5 Bxd1): тренер в 3 из 5 прогонов называл ошибкой «Kxf7», «Kd7», «Nxe5». Модель получала FEN и
 * список ходов и угадывала сама. Проверка Stockfish 18 lite (глубина 16) той же партии: 5.Nxe5 —
 * лучший ход белых (потеря 0.04), ошибки только у чёрных — 4...g6 (−1.01) и 5...Bxd1?? (мат в 2).
 *
 * Модуль грузится import() из page.tsx — храповик статических импортов страницы не растёт.
 */
import { Chess } from "chess.js";

/** Оценка позиции с точки зрения БЕЛЫХ: сантипешки и мат (>0 — мат белых, <0 — мат чёрных, 0 — нет). */
export type Otsenka = { cp: number; mate: number; best?: string };
export type OtsenkaFn = (fen: string) => Promise<Otsenka>;

export type Oshibka = {
  /** Индекс полухода в истории (0 — первый ход белых). */
  ply: number;
  /** Номер хода для человека: «5.» или «5...». */
  nomer: string;
  san: string;
  /** Потеря для ходившего, в пешках (мат приводится к 20). */
  poteryaPeshek: number;
  /** Лучший ход движка в позиции до ошибки, SAN; null — движок не назвал. */
  luchshe: string | null;
  grubaya: boolean;
  /** Ход отдал мат (после него у соперника мат в N). */
  dalMat: number | null;
};

/** Порог «ошибки» и «грубой ошибки» в пешках — как ?/?? у классификатора страницы. */
export const POROG_OSHIBKI = 1.0;
export const POROG_GRUBOY = 2.0;

/** Оценка в пешках с точки зрения стороны side; мат — ±20 (за вычетом расстояния), чтобы разница была конечной. */
export function dlyaStorony(o: Otsenka, side: "w" | "b"): number {
  const belye = o.mate !== 0 ? Math.sign(o.mate) * (20 - Math.min(Math.abs(o.mate), 10) * 0.1) : o.cp / 100;
  return side === "w" ? belye : -belye;
}

function sanIzUci(fen: string, uci: string | undefined): string | null {
  if (!uci || uci.length < 4) return null;
  try {
    const g = new Chess(fen);
    const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined });
    return m?.san ?? null;
  } catch {
    return null;
  }
}

/**
 * Последняя ошибка игрока цвета `igrok` в партии, заданной позициями `fens` (fens[0] — начало,
 * fens[i] — позиция после i полуходов) и ходами `hist` (SAN, длина fens.length-1).
 * Идёт от конца назад по ходам игрока; по каждому — оценка до и после. Возвращает первую найденную
 * с конца ошибку (потеря ≥ POROG_OSHIBKI) или null. `limit` — сколько ходов игрока проверить максимум.
 */
export async function poslednyayaOshibka(
  fens: string[],
  hist: string[],
  igrok: "w" | "b",
  otsenka: OtsenkaFn,
  limit = 20,
  /** Срок в мс от начала: движок общий с партией, тренер не должен ждать бесконечно. */
  srokMs = Infinity,
): Promise<{ oshibka: Oshibka | null; provereno: number }> {
  const konec = Date.now() + srokMs;
  const kesh = new Map<string, Otsenka>();
  const oc = async (fen: string) => {
    const k = kesh.get(fen);
    if (k) return k;
    const v = await otsenka(fen);
    kesh.set(fen, v);
    return v;
  };
  let provereno = 0;
  for (let ply = hist.length - 1; ply >= 0 && provereno < limit && Date.now() < konec; ply--) {
    const do_ = fens[ply];
    const posle = fens[ply + 1];
    if (!do_ || !posle) continue;
    const kto = do_.split(" ")[1] as "w" | "b";
    if (kto !== igrok) continue;
    provereno++;
    const g = new Chess(posle);
    const ocDo = await oc(do_);
    const ocPosle: Otsenka = g.isCheckmate() ? { cp: 0, mate: kto === "w" ? 1 : -1 } : await oc(posle);
    const poterya = dlyaStorony(ocDo, kto) - dlyaStorony(ocPosle, kto);
    if (poterya >= POROG_OSHIBKI) {
      const matSopernika = ocPosle.mate !== 0 && Math.sign(ocPosle.mate) === (kto === "w" ? -1 : 1) ? Math.abs(ocPosle.mate) : null;
      return {
        provereno,
        oshibka: {
          ply,
          nomer: `${Math.floor(ply / 2) + 1}${kto === "w" ? "." : "..."}`,
          san: hist[ply],
          poteryaPeshek: Math.round(Math.min(poterya, 20) * 100) / 100,
          luchshe: sanIzUci(do_, ocDo.best),
          grubaya: poterya >= POROG_GRUBOY,
          dalMat: matSopernika,
        },
      };
    }
  }
  return { oshibka: null, provereno };
}

/** Строка вывода движка для контекста тренера: модель объясняет ЕЁ и не ищет ошибку сама. */
export function vyvodDlyaTrenera(r: { oshibka: Oshibka | null; provereno: number }, igrok: "w" | "b"): string {
  const cvet = igrok === "w" ? "белыми" : "чёрными";
  if (!r.oshibka && r.provereno === 0) {
    return "ВЫВОД ДВИЖКА: проверить ходы игрока не успели — не называй конкретный ход ошибкой и не утверждай, что ошибок нет; предложи открыть разбор партии.";
  }
  if (!r.oshibka) {
    return `ВЫВОД ДВИЖКА (проверен Stockfish, не спорь с ним): у игрока (играет ${cvet}) в последних ${r.provereno} его ходах ошибок нет — ни один ход не теряет ${POROG_OSHIBKI} пешки и больше.`;
  }
  const o = r.oshibka;
  const mat = o.dalMat ? `, после него у соперника мат в ${o.dalMat}` : "";
  const luchshe = o.luchshe ? ` Лучше было ${o.luchshe}.` : "";
  return `ВЫВОД ДВИЖКА (проверен Stockfish, не спорь с ним): последняя ошибка игрока (играет ${cvet}) — ${o.nomer}${o.san}${o.grubaya ? "??" : "?"}, потеря ${o.poteryaPeshek.toFixed(2)} пешки${mat}.${luchshe}`;
}
