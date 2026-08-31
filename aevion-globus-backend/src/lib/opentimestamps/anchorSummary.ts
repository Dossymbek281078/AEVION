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

/**
 * Строка про якорь для PDF-сертификата.
 *
 * ЗАЧЕМ. PDF — это документ, который человек показывает суду, работодателю или
 * площадке. Замер 28.08.2026: во всей ручке выдачи PDF (347 строк) якорь не
 * упоминался НИ РАЗУ, хотя данные у неё на руках — она делает `SELECT *`. То
 * есть самое сильное доказательство продукта отсутствовало ровно в том
 * артефакте, ради которого продукт покупают. При этом правовой блок того же
 * документа утверждает, что он «serves as admissible evidence of prior art».
 *
 * ЧЕТЫРЕ ИСХОДА, И НИ ОДИН НЕ МОЛЧИТ. Отсутствие строки читалось бы как
 * «якорь есть, просто не написали» — а для апрельских сертификатов это неправда
 * и никогда правдой не станет. Поэтому «якоря нет» пишется словами.
 *
 * Решение вынесено отдельной функцией намеренно: текст из PDFKit не
 * извлекается (шрифт уезжает подмножеством), и проверка «нет ли в документе
 * лишнего обещания» была бы пустой всегда. Проверяется решение, а не документ.
 */
export function pdfAnchorField(a: AnchorSummary): { label: string; value: string } {
  if (a.status === "bitcoin-confirmed") {
    // Ярлык обещает проверяемость без нас — значит документ обязан сказать,
    // ЧЕМ проверять. Прежнее значение сообщало только наш собственный вывод
    // («confirmed»), то есть предлагало поверить нам на слово ровно там, где
    // обещало обратное. Путь к байтам доказательства короткий и помещается.
    // Слово «confirmed» остаётся, когда высоты нет: иначе документ теряет сам
    // факт подтверждения, а выдумывать номер блока нельзя. Это закреплено
    // тестом, и он справедливо покраснел, когда я слово потерял.
    const where =
      a.bitcoinBlockHeight === null
        ? "OpenTimestamps -> Bitcoin, confirmed"
        : `OpenTimestamps -> Bitcoin, block ${a.bitcoinBlockHeight}`;
    return {
      label: "BITCOIN ANCHOR (verifiable without AEVION)",
      value: `${where}; check the .ots proof at /api/pipeline/ots/<certId>/proof with any OpenTimestamps client`,
    };
  }
  if (a.status === "pending") {
    return {
      label: "BITCOIN ANCHOR",
      value: "submitted to OpenTimestamps calendars; Bitcoin confirmation pending",
    };
  }
  if (a.status === "failed") {
    return {
      label: "BITCOIN ANCHOR",
      value: "stamping failed; the other proof layers below remain in force",
    };
  }
  if (a.status === "not_stamped") {
    return {
      label: "BITCOIN ANCHOR",
      value: "none - this certificate predates Bitcoin anchoring and will not receive one",
    };
  }
  return { label: "BITCOIN ANCHOR", value: a.status };
}
