/**
 * Перевод реестра нотариусов /bureau/notaries (серверный компонент).
 * Замер прода 30.10.2026: на ru заголовок, пустое состояние и блок «How
 * Notarized tier works» английские. Отдельный файл по той же причине, что и
 * ../cert/[certId]/certText.ts: bureauText.ts тянет хук react, серверной
 * странице он не годится. Verified / Notarized — названия уровней, не переводятся.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
type Tr = { ru: string; kk: string };

export const NOTARIES_TEXT: Record<string, Tr> = {
  "Notary Registry": { ru: "Реестр нотариусов", kk: "Нотариустар тізілімі" },
  "AEVION-vetted notarial partners who co-sign IP certificates with Ed25519 digital signatures.": { ru: "Нотариальные партнёры, прошедшие отбор AEVION: они соподписывают сертификаты ИС цифровой подписью Ed25519.", kk: "AEVION іріктеген нотариалдық серіктестер: олар ИМ сертификаттарына Ed25519 цифрлық қолтаңбасымен қосымша қол қояды." },
  "A Notarized badge means a licensed notary has independently verified the authorship claim.": { ru: "Значок Notarized означает, что лицензированный нотариус независимо проверил заявление об авторстве.", kk: "Notarized белгісі лицензиялы нотариус авторлық туралы мәлімдемені тәуелсіз тексергенін білдіреді." },
  "All": { ru: "Все", kk: "Барлығы" },
  "No notaries found": { ru: "Нотариусы не найдены", kk: "Нотариустар табылмады" },
  "No active notaries in": { ru: "Нет действующих нотариусов:", kk: "Белсенді нотариустар жоқ:" },
  "The notary registry is empty. Check back soon.": { ru: "Реестр нотариусов пока пуст. Загляните позже.", kk: "Нотариустар тізілімі әзірге бос. Кейінірек қараңыз." },
  "← Bureau": { ru: "← Бюро", kk: "← Бюро" },
  "Active": { ru: "Действует", kk: "Белсенді" },
  "License:": { ru: "Лицензия:", kk: "Лицензия:" },
  "Partner since": { ru: "Партнёр с", kk: "Серіктес:" },
  "Key fingerprint:": { ru: "Отпечаток ключа:", kk: "Кілт таңбасы:" },
  "View public key →": { ru: "Открытый ключ →", kk: "Ашық кілт →" },
  "How Notarized tier works": { ru: "Как работает уровень Notarized", kk: "Notarized деңгейі қалай жұмыс істейді" },
  "Your certificate must first reach": { ru: "Сначала сертификат должен достичь уровня", kk: "Алдымен сертификат мына деңгейге жетуі керек:" },
  "tier (KYC + payment).": { ru: "(проверка личности + оплата).", kk: "(KYC + төлем)." },
  "Submit a notarization request, selecting a partner notary.": { ru: "Подайте заявку на нотариальное заверение, выбрав нотариуса-партнёра.", kk: "Серіктес нотариусты таңдап, нотариалдық растауға өтінім беріңіз." },
  "The notary independently verifies your authorship claim and co-signs with Ed25519.": { ru: "Нотариус независимо проверяет ваше заявление об авторстве и соподписывает его Ed25519.", kk: "Нотариус авторлық туралы мәлімдемеңізді тәуелсіз тексеріп, Ed25519 арқылы қосымша қол қояды." },
  "Your certificate badge upgrades to": { ru: "Значок сертификата повышается до", kk: "Сертификат белгісі мынаған көтеріледі:" },
  "with a permanent registry reference.": { ru: "с постоянной ссылкой на запись в реестре.", kk: "тізілімдегі тұрақты сілтемемен." },
  "Third parties can verify the notary signature offline using the notary's public Ed25519 key listed above.": { ru: "Третьи лица могут проверить подпись нотариуса офлайн по его открытому ключу Ed25519, указанному выше.", kk: "Үшінші тұлғалар нотариустың қолтаңбасын жоғарыда көрсетілген ашық Ed25519 кілті арқылы офлайн тексере алады." },
  "← Back to Bureau": { ru: "← Назад в бюро", kk: "← Бюроға оралу" },
  "Kazakhstan": { ru: "Казахстан", kk: "Қазақстан" },
  "European Union": { ru: "Европейский союз", kk: "Еуропалық одақ" },
  "United States": { ru: "США", kk: "АҚШ" },
  "Russia": { ru: "Россия", kk: "Ресей" },
  "Ukraine": { ru: "Украина", kk: "Украина" },
  "United Kingdom": { ru: "Великобритания", kk: "Ұлыбритания" },
};

export function tNot(lang: string, en: string): string {
  if (lang !== "ru" && lang !== "kk") return en;
  return NOTARIES_TEXT[en]?.[lang] ?? en;
}
