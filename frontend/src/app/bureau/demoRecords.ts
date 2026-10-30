/**
 * Подписи демонстрационных записей публичного реестра бюро — на языке страницы.
 *
 * 30.10.2026 (замер прода): /api/pipeline/certificates отдаёт три записи AEVION
 * с подписями на ОДНОМ языке каждая — две по-русски («Демонстрация …: пример записи
 * для партнёров»), одна по-английски («Demo record: …», автор «AEVION (demonstration
 * for partner)»). На /bureau?lang=en реестр выглядел русским, на ru — английским.
 * Это наши собственные демо-записи, не данные пользователей, поэтому честно
 * подменить на экране только текст подписи; сама запись, хэш и ссылка проверки — те же.
 * Словарь — по ТОЧНОМУ тексту от сервера: любая другая запись (настоящая, чужая)
 * не трогается ни на букву.
 */
type Tr = { en: string; ru: string; kk: string };

const TITLES: Record<string, Tr> = {
  "Demo record: proof of a work's creation date": {
    en: "Demo record: proof of a work's creation date",
    ru: "Демонстрационная запись: подтверждение даты создания работы",
    kk: "Демонстрациялық жазба: жұмыстың жасалған күнін растау",
  },
  "Демонстрация со-подписи автора: пример записи для партнёров": {
    en: "Author co-signature demo: a sample record for partners",
    ru: "Демонстрация со-подписи автора: пример записи для партнёров",
    kk: "Автордың бірлескен қолтаңбасының демонстрациясы: серіктестерге арналған жазба үлгісі",
  },
  "Демонстрация бренда бюро: пример записи для партнёров": {
    en: "Bureau brand demo: a sample record for partners",
    ru: "Демонстрация бренда бюро: пример записи для партнёров",
    kk: "Бюро брендінің демонстрациясы: серіктестерге арналған жазба үлгісі",
  },
};

const AUTHORS: Record<string, Tr> = {
  "AEVION (demonstration for partner)": {
    en: "AEVION (demonstration for partner)",
    ru: "AEVION (демонстрация для партнёра)",
    kk: "AEVION (серіктеске арналған демонстрация)",
  },
};

function pick(map: Record<string, Tr>, raw: string, lang: string): string {
  const tr = Object.prototype.hasOwnProperty.call(map, raw) ? map[raw] : undefined;
  if (!tr) return raw;
  return lang === "ru" ? tr.ru : lang === "kk" ? tr.kk : tr.en;
}

/** Заголовок записи реестра на языке страницы (чужие записи — как есть). */
export function demoRecordTitle(raw: string, lang: string): string {
  return pick(TITLES, raw, lang);
}

/** Автор записи реестра на языке страницы (остальных авторов переводит tb()). */
export function demoRecordAuthor(raw: string, lang: string): string {
  return pick(AUTHORS, raw, lang);
}
