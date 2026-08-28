/**
 * Одно место, отвечающее на вопрос «в каком состоянии якорь этого сертификата».
 *
 * ЗАЧЕМ ОБЩИЙ МОДУЛЬ. Состояние якорения спрашивают четыре поверхности:
 * публичный список реестра, поиск по хешу (им пользуется третья сторона —
 * «существует ли уже такая работа»), выгрузка CSV и страница проверки. Стоит
 * ответить на этот вопрос в каждой из них по-своему, и они разойдутся молча:
 * одна назовёт `null` «pending», другая покажет пустоту, третья — «нет якоря».
 *
 * СЛОВАРЬ (тот же, что уже используют ручки проверки и дообновления, новый не
 * заводится):
 *   not_stamped        — не якорили; у апрельских сертификатов якоря не будет
 *   pending            — штамп есть, подтверждения биткойна ещё нет
 *   bitcoin-confirmed  — подтверждено, есть высота блока
 *   failed             — штамповка сорвалась
 *
 * NULL в колонке значит «не якорили», и это ЧЕСТНЫЙ ноль, а не «не знаю»:
 * колонка заполняется при штамповке, её отсутствие — факт о сертификате.
 */

export type AnchorSummary = {
  /** Из словаря выше. Незнакомое значение отдаётся КАК ЕСТЬ — см. ниже. */
  status: string;
  /** Высота блока биткойна или null. */
  bitcoinBlockHeight: number | null;
};

export function anchorSummary(row: Record<string, unknown>): AnchorSummary {
  const raw = row.otsStatus;
  // Незнакомое значение НЕ приводится к known: подменить его на "not_stamped"
  // значило бы сказать «якоря нет» там, где на самом деле неизвестно что.
  // Пусть доедет как есть и будет заметно.
  const status =
    raw === null || raw === undefined || raw === "" ? "not_stamped" : String(raw);

  // pg отдаёт bigint строкой. Number("") даёт 0, а ноль — правдоподобная
  // высота блока, поэтому пустое отсекается ДО приведения.
  const h = row.otsBitcoinBlockHeight;
  let bitcoinBlockHeight: number | null = null;
  if (h !== null && h !== undefined && h !== "") {
    const n = Number(h);
    if (Number.isFinite(n)) bitcoinBlockHeight = n;
  }

  return { status, bitcoinBlockHeight };
}

/** Колонки, которые надо взять из "IPCertificate", чтобы это посчитать. */
export const ANCHOR_COLUMNS = `"otsStatus","otsBitcoinBlockHeight"`;
