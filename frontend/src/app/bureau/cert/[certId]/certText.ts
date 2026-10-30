/**
 * Перевод публичной страницы сертификата /bureau/cert/<id> (серверный компонент).
 *
 * Замер прода 30.10.2026: на ru страница целиком английская («ANONYMOUS»,
 * «Author identity has not been verified.», «Protected on», «Embed badge →»).
 * Лежит рядом со страницей, а не в ../../bureauText.ts: тот файл тянет
 * useCallback из react, а эта страница — серверная (generateMetadata), хук в
 * её импортах Next отвергает. Английский — исходник; нет перевода — он же.
 * Названия уровней VERIFIED / NOTARIZED не переводятся (как на витрине бюро).
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */

type Tr = { ru: string; kk: string };

export const CERT_TEXT: Record<string, Tr> = {
  "ANONYMOUS": { ru: "АНОНИМНЫЙ", kk: "ЖАСЫРЫН" },
  "REVOKED": { ru: "ОТОЗВАН", kk: "ҚАЙТАРЫП АЛЫНҒАН" },
  "← AEVION Bureau": { ru: "← Бюро AEVION", kk: "← AEVION бюросы" },
  "Certificate": { ru: "Сертификат", kk: "Сертификат" },
  "Certificate ID": { ru: "Номер сертификата", kk: "Сертификат нөмірі" },
  "Verification": { ru: "Проверка автора", kk: "Авторды тексеру" },
  "Verified author": { ru: "Автор подтверждён", kk: "Автор расталған" },
  "since": { ru: "с", kk: "бастап" },
  "This certificate's verification has been revoked.": { ru: "Проверка автора по этому сертификату отозвана.", kk: "Осы сертификат бойынша автор тексеруі қайтарып алынған." },
  "Author identity has not been verified.": { ru: "Личность автора не подтверждена.", kk: "Автордың жеке басы расталмаған." },
  "Protected on": { ru: "Защищено", kk: "Қорғалған күні" },
  "Public badge": { ru: "Публичный значок", kk: "Жария белгі" },
  "Embed badge →": { ru: "Встроить значок →", kk: "Белгіні ендіру →" },
  "Upgrade to Verified →": { ru: "Повысить до Verified →", kk: "Verified деңгейіне көтеру →" },
  "Request Notarization →": { ru: "Запросить нотариальное заверение →", kk: "Нотариалдық растауды сұрау →" },
  "Embed JSON ↗": { ru: "JSON для встраивания ↗", kk: "Ендіру JSON ↗" },
  "Could not load certificate": { ru: "Не удалось загрузить сертификат", kk: "Сертификатты жүктеу мүмкін болмады" },
  "The Bureau API did not respond. Try again in a moment.": { ru: "API бюро не ответил. Попробуйте ещё раз через минуту.", kk: "Бюро API жауап бермеді. Бір минуттан кейін қайталап көріңіз." },
  "Music / Audio": { ru: "Музыка / Аудио", kk: "Музыка / Аудио" },
  "Code / Software": { ru: "Код / Программы", kk: "Код / Бағдарламалар" },
  "Design / Visual": { ru: "Дизайн / Графика", kk: "Дизайн / Графика" },
  "Text / Article": { ru: "Текст / Статья", kk: "Мәтін / Мақала" },
  "Video / Film": { ru: "Видео / Фильм", kk: "Видео / Фильм" },
  "Idea / Concept": { ru: "Идея / Концепция", kk: "Идея / Тұжырым" },
  "Other": { ru: "Другое", kk: "Басқа" },
};

/** Перевод строки страницы сертификата; нет перевода — английский исходник. */
export function tCert(lang: string, en: string): string {
  if (lang !== "ru" && lang !== "kk") return en;
  return CERT_TEXT[en]?.[lang] ?? en;
}
