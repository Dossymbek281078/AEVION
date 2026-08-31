import { ccPlural } from "./ccPlural";

/**
 * Разбор партии сразу после её конца — без обращения к ИИ.
 *
 * Почему без ИИ: разбор нужен ВСЕМ и МГНОВЕННО, а запрос к тренеру стоит
 * денег и секунд. Данные для честного разбора уже посчитаны: после партии
 * автоматически запускается runAnalysis(10) и заполняет analysis[] — оценку
 * и качество КАЖДОГО хода. Их и показываем; кнопка «Разбор от тренера»
 * остаётся для тех, кому нужно глубже.
 *
 * Считаем ТОЛЬКО ходы игрока: analysis[i] описывает hist[i], а ходы в
 * истории чередуются. Без этого «твои ошибки» включали бы ошибки соперника,
 * и разбор врал бы в самую польстительную сторону.
 */

export type PlyAnalysis = {
  move: number;
  cp: number;
  mate: number;
  quality: string;
  cpLoss: number;
  best?: string;
};

export type GameSummary = {
  /** сколько ходов игрока разобрано — знаменатель для всех чисел ниже */
  vsego: number;
  tochnyh: number;
  netochnostey: number;
  oshibok: number;
  zevkov: number;
  blestyashchih: number;
  /** доля хороших ходов, 0..100; null если разбирать было нечего */
  tochnost: number | null;
  /** ход, который стоил дороже всего: номер в партии, запись, потеря в пешках */
  perelom: { nomerHoda: number; zapis: string; poterya: number; luchshe?: string } | null;
};

const HOROSHIE = new Set(["brilliant", "great", "good"]);

/** Ход под индексом i в истории сделан игроком? Белые ходят чётными. */
export function hodIgroka(i: number, pCol: "w" | "b"): boolean {
  return pCol === "w" ? i % 2 === 0 : i % 2 === 1;
}

export function postGameSummary(
  hist: string[],
  analysis: PlyAnalysis[],
  pCol: "w" | "b",
): GameSummary {
  const pustoy: GameSummary = {
    vsego: 0, tochnyh: 0, netochnostey: 0, oshibok: 0, zevkov: 0,
    blestyashchih: 0, tochnost: null, perelom: null,
  };
  if (!analysis?.length || !hist?.length) return pustoy;

  let vsego = 0, tochnyh = 0, netochnostey = 0, oshibok = 0, zevkov = 0, blestyashchih = 0;
  let hudshiy: { i: number; a: PlyAnalysis } | null = null;

  for (let i = 0; i < analysis.length && i < hist.length; i++) {
    if (!hodIgroka(i, pCol)) continue;
    const a = analysis[i];
    if (!a) continue;
    vsego++;
    if (a.quality === "brilliant") blestyashchih++;
    if (HOROSHIE.has(a.quality)) tochnyh++;
    else if (a.quality === "inacc") netochnostey++;
    else if (a.quality === "mistake") oshibok++;
    else if (a.quality === "blunder") zevkov++;

    const poterya = Number.isFinite(a.cpLoss) ? a.cpLoss : 0;
    if (poterya > 0 && (!hudshiy || poterya > (hudshiy.a.cpLoss ?? 0))) {
      hudshiy = { i, a };
    }
  }

  if (vsego === 0) return pustoy;

  // Переломным считаем только по-настоящему дорогой ход: меньше половины
  // пешки — это шум оценки, а не «момент, решивший партию».
  const perelom =
    hudshiy && hudshiy.a.cpLoss >= 50
      ? {
          nomerHoda: Math.floor(hudshiy.i / 2) + 1,
          zapis: hist[hudshiy.i],
          poterya: Math.round((hudshiy.a.cpLoss / 100) * 10) / 10,
          // Совет показываем, только если он ОТЛИЧАЕТСЯ от сыгранного хода:
          // иначе человек читает «сильнее было Bxd1» про Bxd1, который сам
          // и сделал. Поймано глазами на стенде, тестами не ловилось.
          luchshe: hudshiy.a.best && hudshiy.a.best !== hist[hudshiy.i]
            ? hudshiy.a.best
            : undefined,
        }
      : null;

  return {
    vsego, tochnyh, netochnostey, oshibok, zevkov, blestyashchih,
    tochnost: Math.round((tochnyh / vsego) * 100),
    perelom,
  };
}

/**
 * Одна фраза о партии — то, что человек прочтёт первым.
 * Пишем от результата игрока, а не от абстрактной «оценки качества».
 */
export function odnaFraza(s: GameSummary): string {
  if (s.vsego === 0) return "Партия слишком короткая для разбора.";
  if (s.zevkov === 0 && s.oshibok === 0) {
    return s.blestyashchih > 0
      ? "Партия без ошибок, и среди ходов есть блестящие."
      : "Партия без грубых ошибок — так и держать.";
  }
  if (s.zevkov === 0) {
    return `Грубых зевков нет, но ${s.oshibok} ${ccPlural(s.oshibok, "ошибка", "ошибки", "ошибок")} стоили позиции.`;
  }
  return `Главное, над чем работать: ${s.zevkov} ${ccPlural(s.zevkov, "зевок", "зевка", "зевков")} за партию.`;
}

