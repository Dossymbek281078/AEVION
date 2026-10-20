/**
 * Словарь страницы проверки /verify/<cert> — ru / kk поверх английского источника.
 *
 * 🔴 Заявка Продаж 19.10.2026: 6 патентных бюро, которым писали, русскоязычные, а
 * письмо ведёт ровно на этот экран — он был целиком английским при выбранном RU
 * (замер 18:28 и 21:43: 111 строк «только латиница» из 178). Ключ — английская
 * строка из разметки: нет перевода → остаётся английский, а не пустота.
 * Хеши, идентификаторы, названия алгоритмов (SHA-256, HMAC, Ed25519, Shamir,
 * OpenTimestamps, CID) не переводятся — это значения, не подписи.
 */
import type { Lang } from "@/lib/i18n-data";

const RU: Record<string, string> = {
  "Verifying certificate...": "Проверяем сертификат…",
  "Verification Failed": "Проверка не пройдена",
  "Certificate not found": "Сертификат не найден",
  "Go to AEVION": "На главную AEVION",
  "Digital IP Bureau — Public Verification": "Цифровое бюро ИС — публичная проверка",
  "Certificate Verified": "Сертификат проверен",
  "Verification Warning": "Проверка с предупреждением",
  "Every cryptographic layer matches. The work below was registered by the named author at the time shown, and no field has been altered since.":
    "Все криптографические слои сходятся. Работа ниже зарегистрирована названным автором в указанный момент, и ни одно поле с тех пор не менялось.",
  "Every check that applies to this certificate matches — nothing has been altered since registration. Some layers below are marked grey because they did not exist yet when this certificate was issued; that is its age, not a failure.":
    "Все применимые к этому сертификату проверки сходятся — с момента регистрации ничего не менялось. Некоторые слои ниже отмечены серым: их ещё не существовало, когда сертификат выдан; это его возраст, а не ошибка.",
  "One or more integrity layers did not match. The per-layer breakdown below shows exactly which check failed and what it means.":
    "Один или несколько слоёв целостности не сошлись. Разбор по слоям ниже показывает, какая именно проверка не прошла и что это значит.",
  "Verified at": "Проверено",
  "Check #": "Проверка №",
  "Record made via": "Запись сделана через",
  "verification by AEVION": "проверку обеспечивает AEVION",
  "🛡️ Protect your own work in a minute": "🛡️ Защитите свою работу за минуту",
  "💳 Ask about pricing": "💳 Узнать о ценах",
  "🤝 For bureaus & patent attorneys — partnership": "🤝 Бюро и патентным поверенным — партнёрство",
  "How to read this page": "Как читать эту страницу",
  "Status banner": "Вердикт сверху",
  "above is the one-line verdict — green only if every applicable layer matched.": "— итог одной строкой: зелёный только если сошёлся каждый применимый слой.",
  "Integrity Checks": "Проверки целостности",
  "break that verdict apart: content hash, HMAC (with key version), Shamir shielding, and the author's own co-signature. Each tile is one independent test.":
    "раскладывают вердикт по слоям: хеш содержимого, HMAC (с версией ключа), защита Шамира и собственная подпись автора. Каждая плитка — отдельная независимая проверка.",
  "Shard Distribution": "Распределение долей ключа",
  "shows where the Ed25519 private key was split. AEVION holds at most 1 of 3, so we cannot forge or recover this key alone.":
    "показывает, где разделён закрытый ключ Ed25519. У AEVION не больше 1 доли из 3, поэтому мы не можем подделать или восстановить ключ в одиночку.",
  "Bitcoin Anchor": "Якорь в Bitcoin",
  "records": "фиксирует,",
  "when": "когда",
  "the certificate existed — settled by Bitcoin's proof-of-work, not by us.": "сертификат уже существовал — это подтверждает proof-of-work Bitcoin, а не мы.",
  "Independent of AEVION": "Независимо от AEVION",
  "at the bottom downloads a self-contained bundle — verify offline today, in 10 years, on any machine.":
    "внизу — самодостаточный набор доказательств: проверяйте офлайн сегодня, через 10 лет, на любой машине.",
  "AEVION Digital IP Bureau — Protection Certificate": "Цифровое бюро ИС AEVION — сертификат защиты",
  "✓ PROTECTED": "✓ ЗАЩИЩЕНО",
  "Author": "Автор",
  "Type": "Тип",
  "Protected At": "Защищено",
  "Location": "Место",
  "Not specified": "Не указано",
  "Description": "Описание",
  "Author identity verified by AEVION Bureau": "Личность автора подтверждена бюро AEVION",
  "Cryptographic Proof": "Криптографическое доказательство",
  "Content Hash (SHA-256)": "Хеш содержимого (SHA-256)",
  "HMAC-SHA256 Signature": "Подпись HMAC-SHA256",
  "Ed25519 Signature (first 64 chars)": "Подпись Ed25519 (первые 64 знака)",
  "Platform attestation": "Заверение платформы",
  "Algorithm": "Алгоритм",
  "Certificate ID": "Идентификатор сертификата",
  "File Hash (SHA-256)": "Хеш файла (SHA-256)",
  " ✓ valid": " ✓ верно",
  " ✗ mismatch": " ✗ не совпадает",
  "Copy": "Копировать",
  "Each tile is one independent test. Green passed. Red failed — something does not match and the certificate cannot be relied on. Grey means the layer did not exist yet when this certificate was issued.":
    "Каждая плитка — отдельная проверка. Зелёная — пройдена. Красная — не пройдена: что-то не сходится, и на сертификат нельзя полагаться. Серая — слоя ещё не было, когда сертификат выдан.",
  "Author Co-Signature": "Подпись автора",
  "Not signed by author (legacy single-party cert)": "Автором не подписан (прежний сертификат одной стороны)",
  "Content Hash": "Хеш содержимого",
  "HMAC Signature": "Подпись HMAC",
  "HMAC Key Version": "Версия ключа HMAC",
  "Quantum Shield": "Квантовый щит",
  "Secret Sharing": "Разделение секрета",
  "Certificate Status": "Статус сертификата",
  "Linked Quantum Shield record": "Связанная запись Квантового щита",
  "View Shield →": "Открыть щит →",
  "Shard Distribution (Shamir SSS 2-of-3)": "Распределение долей ключа (Шамир 2 из 3)",
  "Any 2 of 3 shards reconstruct the Ed25519 private key; no single holder can forge the certificate.":
    "Любые 2 доли из 3 восстанавливают закрытый ключ Ed25519; ни один держатель в одиночку не подделает сертификат.",
  "Legacy record: all three shards are stored in our DB. Re-protect to upgrade to true distribution.":
    "Прежняя запись: все три доли хранятся в нашей базе. Защитите заново, чтобы получить настоящее распределение.",
  "✓ TRULY DISTRIBUTED": "✓ ДЕЙСТВИТЕЛЬНО РАСПРЕДЕЛЕНО",
  "⚠ LEGACY (LOCAL)": "⚠ ПРЕЖНЯЯ (ЛОКАЛЬНО)",
  "Shard": "Доля",
  "OFFLINE (user holds)": "ОФЛАЙН (у пользователя)",
  "ON-SERVER": "НА СЕРВЕРЕ",
  "Public witness shard — fetchable by anyone, integrity verified via content-addressed CID":
    "Публичная доля-свидетель — доступна любому, целостность проверяется по адресуемому содержимым CID",
  "Fetch Witness Shard →": "Получить долю-свидетель →",
  "Bitcoin Blockchain Anchor": "Якорь в блокчейне Bitcoin",
  "third-party verifiable timestamp": "метка времени, проверяемая третьей стороной",
  "⏱ PENDING CONFIRMATION": "⏱ ЖДЁТ ПОДТВЕРЖДЕНИЯ",
  "✗ FAILED": "✗ НЕ УДАЛОСЬ",
  "Hash submitted to the OpenTimestamps calendar network. It will be included in a Bitcoin block within 1-6 hours, after which this certificate becomes independently verifiable against any Bitcoin node.":
    "Хеш отправлен в сеть календарей OpenTimestamps. Он попадёт в блок биткоина в течение 1–6 часов, после чего этот сертификат можно будет независимо проверить по любому узлу биткоина.",
  "Bitcoin anchoring failed at the time of protection (calendar network unreachable). The other cryptographic layers remain valid.":
    "Якорение в биткоине при защите не удалось (сеть календарей была недоступна). Остальные криптографические слои действуют.",
  "This proof is independent of AEVION — anyone can verify it with the standard OpenTimestamps client.":
    "Это доказательство не зависит от AEVION — любой может проверить его стандартным клиентом OpenTimestamps.",
  "The content hash of this certificate is": "Хеш содержимого этого сертификата",
  "permanently recorded in the Bitcoin blockchain": "навсегда записан в блокчейн Bitcoin",
  "at block": "в блоке",
  "Submitted to OT": "Отправлено в OT",
  "Bitcoin-confirmed": "Подтверждено Bitcoin",
  "⬇ Download .ots proof": "⬇ Скачать доказательство .ots",
  "₿ Try upgrade now": "₿ Проверить подтверждение сейчас",
  "Checking...": "Проверяем…",
  "What is OpenTimestamps?": "Что такое OpenTimestamps?",
  "Legal Basis": "Правовая основа",
  "International Copyright Frameworks": "Международные рамки авторского права",
  "Digital Signature Legislation": "Законодательство об электронной подписи",
  "Legal Disclaimer:": "Правовая оговорка:",
  "⬇ Download bundle.json": "⬇ Скачать bundle.json",
  "Open offline verifier →": "Открыть офлайн-проверку →",
};

const KK: Record<string, string> = {
  "Verifying certificate...": "Сертификат тексерілуде…",
  "Verification Failed": "Тексеру өтпеді",
  "Certificate not found": "Сертификат табылмады",
  "Go to AEVION": "AEVION басты бетіне",
  "Digital IP Bureau — Public Verification": "Цифрлық ЗМ бюросы — жария тексеру",
  "Certificate Verified": "Сертификат тексерілді",
  "Verification Warning": "Ескертумен тексеру",
  "Every cryptographic layer matches. The work below was registered by the named author at the time shown, and no field has been altered since.":
    "Барлық криптографиялық қабаттар сәйкес келеді. Төмендегі жұмысты аталған автор көрсетілген уақытта тіркеген, содан бері бірде-бір өріс өзгермеген.",
  "Every check that applies to this certificate matches — nothing has been altered since registration. Some layers below are marked grey because they did not exist yet when this certificate was issued; that is its age, not a failure.":
    "Осы сертификатқа қолданылатын барлық тексерулер сәйкес — тіркеуден бері ештеңе өзгермеген. Төмендегі кейбір қабаттар сұр түспен белгіленген: сертификат берілген кезде олар әлі болмаған; бұл оның жасы, қате емес.",
  "One or more integrity layers did not match. The per-layer breakdown below shows exactly which check failed and what it means.":
    "Бір немесе бірнеше тұтастық қабаты сәйкес келмеді. Төмендегі қабаттар бойынша талдау қай тексерудің өтпегенін және оның мәнін көрсетеді.",
  "Verified at": "Тексерілді",
  "Check #": "Тексеру №",
  "Record made via": "Жазба мынау арқылы жасалды:",
  "verification by AEVION": "тексеруді AEVION қамтамасыз етеді",
  "🛡️ Protect your own work in a minute": "🛡️ Өз жұмысыңызды бір минутта қорғаңыз",
  "💳 Ask about pricing": "💳 Бағалар туралы сұрау",
  "🤝 For bureaus & patent attorneys — partnership": "🤝 Бюролар мен патенттік сенім білдірілген өкілдерге — серіктестік",
  "How to read this page": "Бұл бетті қалай оқу керек",
  "Status banner": "Жоғарыдағы қорытынды",
  "above is the one-line verdict — green only if every applicable layer matched.": "— бір жолдық қорытынды: тек қолданылатын әр қабат сәйкес келгенде ғана жасыл.",
  "Integrity Checks": "Тұтастық тексерулері",
  "break that verdict apart: content hash, HMAC (with key version), Shamir shielding, and the author's own co-signature. Each tile is one independent test.":
    "қорытындыны қабаттарға бөледі: мазмұн хеші, HMAC (кілт нұсқасымен), Шамир қорғанысы және автордың өз қолтаңбасы. Әр плитка — жеке тәуелсіз тексеру.",
  "Shard Distribution": "Кілт үлестерінің таралуы",
  "shows where the Ed25519 private key was split. AEVION holds at most 1 of 3, so we cannot forge or recover this key alone.":
    "Ed25519 жабық кілтінің қайда бөлінгенін көрсетеді. AEVION-да 3 үлестің ең көбі 1-еуі бар, сондықтан біз кілтті жалғыз қолдан жасай да, қалпына келтіре де алмаймыз.",
  "Bitcoin Anchor": "Bitcoin зәкірі",
  "records": "сертификаттың",
  "when": "қашан",
  "the certificate existed — settled by Bitcoin's proof-of-work, not by us.": "болғанын тіркейді — мұны біз емес, Bitcoin proof-of-work растайды.",
  "Independent of AEVION": "AEVION-нан тәуелсіз",
  "at the bottom downloads a self-contained bundle — verify offline today, in 10 years, on any machine.":
    "төменде — дәлелдердің толық жиынтығы: бүгін де, 10 жылдан кейін де, кез келген машинада офлайн тексеріңіз.",
  "AEVION Digital IP Bureau — Protection Certificate": "AEVION цифрлық ЗМ бюросы — қорғау сертификаты",
  "✓ PROTECTED": "✓ ҚОРҒАЛҒАН",
  "Author": "Автор",
  "Type": "Түрі",
  "Protected At": "Қорғалған уақыты",
  "Location": "Орны",
  "Not specified": "Көрсетілмеген",
  "Description": "Сипаттама",
  "Author identity verified by AEVION Bureau": "Автордың жеке басын AEVION бюросы растады",
  "Cryptographic Proof": "Криптографиялық дәлел",
  "Content Hash (SHA-256)": "Мазмұн хеші (SHA-256)",
  "HMAC-SHA256 Signature": "HMAC-SHA256 қолтаңбасы",
  "Ed25519 Signature (first 64 chars)": "Ed25519 қолтаңбасы (алғашқы 64 таңба)",
  "Platform attestation": "Платформаның куәландыруы",
  "Algorithm": "Алгоритм",
  "Certificate ID": "Сертификат идентификаторы",
  "File Hash (SHA-256)": "Файл хеші (SHA-256)",
  " ✓ valid": " ✓ дұрыс",
  " ✗ mismatch": " ✗ сәйкес емес",
  "Copy": "Көшіру",
  "Each tile is one independent test. Green passed. Red failed — something does not match and the certificate cannot be relied on. Grey means the layer did not exist yet when this certificate was issued.":
    "Әр плитка — жеке тексеру. Жасыл — өтті. Қызыл — өтпеді: бірдеңе сәйкес емес, сертификатқа сенуге болмайды. Сұр — сертификат берілген кезде бұл қабат әлі болмаған.",
  "Author Co-Signature": "Автор қолтаңбасы",
  "Not signed by author (legacy single-party cert)": "Автор қол қоймаған (бұрынғы бір тараптың сертификаты)",
  "Content Hash": "Мазмұн хеші",
  "HMAC Signature": "HMAC қолтаңбасы",
  "HMAC Key Version": "HMAC кілтінің нұсқасы",
  "Quantum Shield": "Кванттық қалқан",
  "Secret Sharing": "Құпияны бөлу",
  "Certificate Status": "Сертификат мәртебесі",
  "Linked Quantum Shield record": "Байланысты Кванттық қалқан жазбасы",
  "View Shield →": "Қалқанды ашу →",
  "Shard Distribution (Shamir SSS 2-of-3)": "Кілт үлестерінің таралуы (Шамир 3-тен 2)",
  "Any 2 of 3 shards reconstruct the Ed25519 private key; no single holder can forge the certificate.":
    "3 үлестің кез келген 2-еуі Ed25519 жабық кілтін қалпына келтіреді; ешбір иеленуші жалғыз сертификатты қолдан жасай алмайды.",
  "Legacy record: all three shards are stored in our DB. Re-protect to upgrade to true distribution.":
    "Бұрынғы жазба: үш үлес те біздің базада сақталады. Нағыз таралу үшін қайта қорғаңыз.",
  "✓ TRULY DISTRIBUTED": "✓ ШЫНАЙЫ ТАРАТЫЛҒАН",
  "⚠ LEGACY (LOCAL)": "⚠ БҰРЫНҒЫ (ЖЕРГІЛІКТІ)",
  "Shard": "Үлес",
  "OFFLINE (user holds)": "ОФЛАЙН (пайдаланушыда)",
  "ON-SERVER": "СЕРВЕРДЕ",
  "Public witness shard — fetchable by anyone, integrity verified via content-addressed CID":
    "Жария куәгер үлесі — кез келген адамға қолжетімді, тұтастығы мазмұнға байланған CID арқылы тексеріледі",
  "Fetch Witness Shard →": "Куәгер үлесін алу →",
  "Bitcoin Blockchain Anchor": "Bitcoin блокчейніндегі зәкір",
  "third-party verifiable timestamp": "үшінші тарап тексере алатын уақыт белгісі",
  "⏱ PENDING CONFIRMATION": "⏱ РАСТАУ КҮТІЛУДЕ",
  "✗ FAILED": "✗ СӘТСІЗ",
  "Hash submitted to the OpenTimestamps calendar network. It will be included in a Bitcoin block within 1-6 hours, after which this certificate becomes independently verifiable against any Bitcoin node.":
    "Хеш OpenTimestamps күнтізбелер желісіне жіберілді. Ол 1–6 сағат ішінде Bitcoin блогына енеді, содан кейін бұл сертификатты кез келген Bitcoin түйіні арқылы тәуелсіз тексеруге болады.",
  "Bitcoin anchoring failed at the time of protection (calendar network unreachable). The other cryptographic layers remain valid.":
    "Қорғау кезінде Bitcoin-ге зәкірлеу сәтсіз аяқталды (күнтізбелер желісі қолжетімсіз болды). Қалған криптографиялық қабаттар жарамды.",
  "This proof is independent of AEVION — anyone can verify it with the standard OpenTimestamps client.":
    "Бұл дәлел AEVION-ға тәуелді емес — кез келген адам оны стандартты OpenTimestamps клиентімен тексере алады.",
  "The content hash of this certificate is": "Бұл сертификаттың мазмұн хеші",
  "permanently recorded in the Bitcoin blockchain": "Bitcoin блокчейніне мәңгі жазылған",
  "at block": "блокта",
  "Submitted to OT": "OT-ға жіберілді",
  "Bitcoin-confirmed": "Bitcoin растады",
  "⬇ Download .ots proof": "⬇ .ots дәлелін жүктеу",
  "₿ Try upgrade now": "₿ Растауды қазір тексеру",
  "Checking...": "Тексерілуде…",
  "What is OpenTimestamps?": "OpenTimestamps деген не?",
  "Legal Basis": "Құқықтық негіз",
  "International Copyright Frameworks": "Халықаралық авторлық құқық шеңберлері",
  "Digital Signature Legislation": "Электрондық қолтаңба туралы заңнама",
  "Legal Disclaimer:": "Құқықтық ескерту:",
  "⬇ Download bundle.json": "⬇ bundle.json жүктеу",
  "Open offline verifier →": "Офлайн тексеруді ашу →",
};

export const VERIFY_DICT: Partial<Record<Lang, Record<string, string>>> = { ru: RU, kk: KK };

/** Перевод строки страницы проверки; нет перевода — английский источник как есть. */
export function tv(lang: Lang | undefined, en: string): string {
  const d = lang ? VERIFY_DICT[lang] : undefined;
  return (d && d[en]) || en;
}

/** Сколько ключей покрыто в каждом языке — для сторожа и отчёта (знаменатель). */
export function verifyDictCoverage(): { ru: number; kk: number } {
  return { ru: Object.keys(RU).length, kk: Object.keys(KK).length };
}
