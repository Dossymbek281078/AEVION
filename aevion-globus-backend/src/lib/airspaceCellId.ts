/**
 * QSkyway — устойчивый идентификатор ячейки воздушного пространства (серверная
 * копия).
 *
 * ЗАЧЕМ ДВЕ КОПИИ. Ингест живёт в `scripts/lib/airspace-cell-id.mjs`, а сторож
 * свежести — здесь, в `src/`. Папка `scripts/` вне области сборки бэкенда, и
 * импортировать её из `src/` нельзя: сборка соберётся, а `dist/` упадёт в
 * рантайме. В репозитории это уже принятая развилка (см. `city-twin-geometry.mjs`
 * и projector в `qskyway.ts`), и обычно её сторожит комментарий «держите
 * одинаковыми».
 *
 * Комментарий здесь заменён на ТЕСТ: `tests/qskywayAirspaceCellId.test.ts`
 * прогоняет обе реализации по одному набору входов и требует совпадения. Пока
 * они расходятся молча, сторож и ингест говорят на разных языках ключей — а это
 * ровно та поломка, ради которой всё и затевалось.
 *
 * Смысл самого ключа и выбор точности — в комментарии .mjs-копии.
 */

function fixed(n: number, digits: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "nan";
  const s = v.toFixed(digits);
  return s === "-" + (0).toFixed(digits) ? (0).toFixed(digits) : s;
}

export interface CellIdInput {
  minLat: number;
  minLon: number;
  airportIcao?: string | null;
}

export function stableCellId(
  cell: CellIdInput | undefined,
  { prefix = "faa", digits = 4 }: { prefix?: string; digits?: number } = {},
): string {
  const icao = typeof cell?.airportIcao === "string" ? cell.airportIcao.trim().toUpperCase() : "";
  const sw = `${fixed(cell?.minLat as number, digits)}_${fixed(cell?.minLon as number, digits)}`;
  return icao ? `${prefix}-${icao}-${sw}` : `${prefix}-${sw}`;
}
