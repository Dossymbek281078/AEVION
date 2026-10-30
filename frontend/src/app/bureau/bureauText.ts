/**
 * Перевод страницы бюро: ключ — английская строка из page.tsx, значения — ru/kk.
 *
 * До 24.10.2026 переведён был только первый экран (заголовок, кнопка); ниже —
 * статистика, «как это работает», уровни, реестр, правовая база, оговорка —
 * шли по-английски на ru и kk (замер прода: 31 из 138 строк /bureau на ru).
 * Английский — исходник: tb("…") на en возвращает строку как есть.
 * Уровни «Verified» и «Notarized» — названия, не переводятся (как на ru-витрине).
 * ⚠️ kk — черновой перевод, нужна вычитка носителя; правовые тексты — дословно.
 */
import { useCallback } from "react";

type Tr = { ru: string; kk: string };

export const BUREAU_TEXT: Record<string, Tr> = {
  // виды работ (формат «А / Б» сохраняется: фильтр берёт часть до « / »)
  "Music / Audio": { ru: "Музыка / Аудио", kk: "Музыка / Аудио" },
  "Code / Software": { ru: "Код / Программы", kk: "Код / Бағдарламалар" },
  "Design / Visual": { ru: "Дизайн / Графика", kk: "Дизайн / Графика" },
  "Text / Article": { ru: "Текст / Статья", kk: "Мәтін / Мақала" },
  "Video / Film": { ru: "Видео / Фильм", kk: "Видео / Фильм" },
  "Idea / Concept": { ru: "Идея / Концепция", kk: "Идея / Тұжырым" },
  "Other": { ru: "Другое", kk: "Басқа" },
  // правовая база
  "Berne Convention": { ru: "Бернская конвенция", kk: "Берн конвенциясы" },
  "Automatic copyright protection in 181 member states — no registration required": { ru: "Автоматическая охрана авторского права в 181 стране-участнице — регистрация не требуется", kk: "181 қатысушы елде авторлық құқықты автоматты қорғау — тіркеу қажет емес" },
  "International": { ru: "Международная", kk: "Халықаралық" },
  "WIPO Copyright Treaty": { ru: "Договор ВОИС по авторскому праву", kk: "ДЗМҰ авторлық құқық туралы шарты" },
  "Extends protection to digital works: software, databases, digital content": { ru: "Распространяет охрану на цифровые произведения: программы, базы данных, цифровой контент", kk: "Қорғауды цифрлық туындыларға таратады: бағдарламалар, дерекқорлар, цифрлық контент" },
  "TRIPS Agreement (WTO)": { ru: "Соглашение ТРИПС (ВТО)", kk: "ТРИПС келісімі (ДСҰ)" },
  "Minimum IP protection standards across 164 WTO member states": { ru: "Минимальные стандарты охраны ИС в 164 странах — членах ВТО", kk: "ДСҰ-ның 164 мүше елінде ЗМ қорғаудың ең төменгі стандарттары" },
  "164 countries": { ru: "164 страны", kk: "164 ел" },
  "eIDAS Regulation": { ru: "Регламент eIDAS", kk: "eIDAS регламенті" },
  "Electronic signatures have legal effect equivalent to handwritten": { ru: "Электронная подпись имеет юридическую силу, равную собственноручной", kk: "Электрондық қолтаңбаның заңды күші қолмен қойылғанмен тең" },
  "European Union": { ru: "Европейский союз", kk: "Еуропалық одақ" },
  "ESIGN Act": { ru: "Закон ESIGN", kk: "ESIGN заңы" },
  "Electronic signatures carry same legal standing as handwritten": { ru: "Электронная подпись имеет тот же правовой статус, что и собственноручная", kk: "Электрондық қолтаңбаның құқықтық мәртебесі қолмен қойылғанмен бірдей" },
  "United States": { ru: "США", kk: "АҚШ" },
  "KZ Digital Signature Law": { ru: "Закон РК об электронной цифровой подписи", kk: "ҚР электрондық цифрлық қолтаңба туралы заңы" },
  "Electronic digital signatures are legally equivalent to handwritten": { ru: "Электронная цифровая подпись юридически равнозначна собственноручной", kk: "Электрондық цифрлық қолтаңба заң бойынша қолмен қойылғанға тең" },
  "Kazakhstan": { ru: "Казахстан", kk: "Қазақстан" },
  // герой и личный кабинет
  "🔎 Search prior art": { ru: "🔎 Поиск по реестру приоритета", kk: "🔎 Басымдық тізілімінен іздеу" },
  "Quantum Shield Dashboard": { ru: "Панель Quantum Shield", kk: "Quantum Shield панелі" },
  "A cryptographic proof-of-authorship bureau. Register, sign, and certify your intellectual property with standards-based cryptography (SHA-256, Ed25519, Bitcoin-anchored timestamps) — backed by international copyright law.": { ru: "Бюро криптографического доказательства авторства. Регистрируйте, подписывайте и удостоверяйте свою интеллектуальную собственность стандартной криптографией (SHA-256, Ed25519, метки времени с привязкой к Bitcoin) — с опорой на международное авторское право.", kk: "Авторлықты криптографиялық дәлелдеу бюросы. Зияткерлік меншігіңізді стандартты криптографиямен (SHA-256, Ed25519, Bitcoin-ға байланған уақыт белгілері) тіркеңіз, қол қойыңыз және куәландырыңыз — халықаралық авторлық құқыққа сүйене отырып." },
  "My Bureau identity": { ru: "Моя личность в бюро", kk: "Бюродағы жеке басым" },
  "Identity verified by AEVION Bureau": { ru: "Личность подтверждена бюро AEVION", kk: "Жеке басы AEVION бюросымен расталды" },
  "· attesting": { ru: "· удостоверяет сертификатов:", kk: "· куәландыратын сертификаттар:" },
  "Protect another work": { ru: "Защитить ещё одну работу", kk: "Тағы бір жұмысты қорғау" },
  "You have an upgrade in progress — KYC": { ru: "У вас идёт повышение уровня — проверка личности (KYC)", kk: "Деңгейді көтеру жүріп жатыр — жеке басты тексеру (KYC)" },
  ", payment": { ru: ", оплата", kk: ", төлем" },
  ". Continue from where you left off:": { ru: ". Продолжите с того места, где остановились:", kk: ". Тоқтаған жеріңізден жалғастырыңыз:" },
  "Pick the certificate you started upgrading from the registry below — the": { ru: "Выберите в реестре ниже сертификат, который начали повышать, — кнопка", kk: "Төмендегі тізілімнен көтере бастаған сертификатты таңдаңыз — сол жердегі" },
  "Upgrade to Verified": { ru: "Повысить до Verified", kk: "Verified деңгейіне көтеру" },
  "button there resumes the same flow.": { ru: "там продолжит тот же процесс.", kk: "батырмасы сол процесті жалғастырады." },
  "Anonymous certificates are fully cryptographically protected. Upgrade any one of yours to": { ru: "Анонимные сертификаты полностью защищены криптографически. Любой из ваших можно повысить до", kk: "Анонимді сертификаттар криптографиялық тұрғыдан толық қорғалған. Кез келгенін мына деңгейге көтеруге болады:" },
  "and the bureau will record your declared name alongside the certificate, with the identity check its provider performs.": { ru: "— тогда бюро запишет рядом с сертификатом заявленное вами имя вместе с проверкой личности, которую выполняет её провайдер.", kk: "— сонда бюро сертификаттың жанына мәлімделген атыңызды провайдер жүргізетін жеке басты тексерумен бірге жазады." },
  // граф доверия
  "🔗 Trust Graph — your earned tiers": { ru: "🔗 Граф доверия — заработанные уровни", kk: "🔗 Сенім графы — тапқан деңгейлеріңіз" },
  "Total earned": { ru: "Всего заработано", kk: "Барлығы табылды" },
  "AEC · claimed": { ru: "AEC · получено", kk: "AEC · алынды" },
  "· unclaimed": { ru: "· не получено", kk: "· алынбады" },
  "✓ claimed": { ru: "✓ получено", kk: "✓ алынды" },
  "Claim AEC": { ru: "Получить AEC", kk: "AEC алу" },
  "no reward": { ru: "без награды", kk: "сыйақысыз" },
  // статистика и как работает
  "Certificates Issued": { ru: "Выдано сертификатов", kk: "Берілген сертификаттар" },
  "Total Verifications": { ru: "Всего проверок", kk: "Барлық тексеру" },
  "Legal Frameworks": { ru: "Правовых основ", kk: "Құқықтық негіздер" },
  "Cryptographic Protection": { ru: "Криптографическая защита", kk: "Криптографиялық қорғау" },
  "How AEVION IP Bureau Works": { ru: "Как работает бюро авторства AEVION", kk: "AEVION авторлық бюросы қалай жұмыс істейді" },
  "Register": { ru: "Регистрация", kk: "Тіркеу" },
  "Describe your work — we create a SHA-256 content hash": { ru: "Опишите работу — мы вычислим SHA-256-хеш содержимого", kk: "Жұмысыңызды сипаттаңыз — біз мазмұнның SHA-256 хешін есептейміз" },
  "Sign": { ru: "Подпись", kk: "Қолтаңба" },
  "HMAC-SHA256 cryptographic signature proves integrity": { ru: "Криптографическая подпись HMAC-SHA256 подтверждает целостность", kk: "HMAC-SHA256 криптографиялық қолтаңбасы тұтастықты дәлелдейді" },
  "Shield": { ru: "Щит", kk: "Қалқан" },
  "Ed25519 + Shamir's Secret Sharing for quantum-grade protection": { ru: "Ed25519 + разделение секрета Шамира для защиты квантового уровня", kk: "Кванттық деңгейдегі қорғау үшін Ed25519 + Шамирдің құпияны бөлу әдісі" },
  "Certify": { ru: "Сертификат", kk: "Сертификат" },
  "IP Certificate with legal basis — publicly verifiable": { ru: "Сертификат ИС с правовым основанием — проверяется публично", kk: "Құқықтық негізі бар ЗМ сертификаты — жария тексеріледі" },
  // уровни
  "Service Tiers": { ru: "Уровни услуг", kk: "Қызмет деңгейлері" },
  "Anonymous certificates are free and cryptographically complete. Higher tiers add identity attestation and (soon) notary co-signing — useful when an IP claim needs strong author identification in court.": { ru: "Анонимные сертификаты бесплатны и криптографически полны. Старшие уровни добавляют подтверждение личности и (скоро) соподпись нотариуса — это полезно, когда в суде нужна надёжная идентификация автора.", kk: "Анонимді сертификаттар тегін және криптографиялық тұрғыдан толық. Жоғары деңгейлер жеке басты растауды және (жақында) нотариустың қосымша қолтаңбасын қосады — сотта авторды сенімді анықтау керек болғанда пайдалы." },
  "Free / Anonymous": { ru: "Бесплатно / анонимно", kk: "Тегін / анонимді" },
  "Full Qright stack: SHA-256 hash, HMAC, Ed25519, Shamir 2-of-3, OpenTimestamps Bitcoin anchor, browser-held author co-signature, offline verification bundle.": { ru: "Полный стек QRight: хеш SHA-256, HMAC, Ed25519, Шамир 2 из 3, привязка OpenTimestamps к Bitcoin, соподпись автора ключом в браузере, пакет для офлайн-проверки.", kk: "QRight-тың толық стегі: SHA-256 хеші, HMAC, Ed25519, Шамир 3-тен 2, OpenTimestamps арқылы Bitcoin-ға байлау, браузердегі кілтпен автордың қосымша қолтаңбасы, офлайн тексеру пакеті." },
  "✓ active": { ru: "✓ работает", kk: "✓ жұмыс істейді" },
  "Protect work": { ru: "Защитить работу", kk: "Жұмысты қорғау" },
  "Identity check is in demo mode right now: the flow runs end to end, but no document is actually verified yet. Ask us before buying this tier.": { ru: "Проверка личности сейчас в демо-режиме: процесс проходит целиком, но документы пока реально не проверяются. Спросите нас, прежде чем покупать этот уровень.", kk: "Жеке басты тексеру қазір демо-режимде: процесс толық өтеді, бірақ құжаттар әзірге шын тексерілмейді. Бұл деңгейді сатып алмас бұрын бізден сұраңыз." },
  "Identity check performed by our KYC provider. Bureau records the declared name alongside the certificate together with the provider's verification fingerprint.": { ru: "Личность проверяет наш KYC-провайдер. Бюро записывает рядом с сертификатом заявленное имя вместе с отпечатком проверки провайдера.", kk: "Жеке басты біздің KYC-провайдер тексереді. Бюро сертификаттың жанына мәлімделген атты провайдер тексеруінің ізімен бірге жазады." },
  "Identity verification is arranged on request — ask us to confirm it is available before buying this tier. Bureau records the declared name alongside the certificate.": { ru: "Проверка личности — по запросу: прежде чем покупать этот уровень, уточните у нас, что она доступна. Бюро записывает заявленное имя рядом с сертификатом.", kk: "Жеке басты тексеру — сұраныс бойынша: бұл деңгейді сатып алмас бұрын оның қолжетімді екенін бізден нақтылаңыз. Бюро мәлімделген атты сертификаттың жанына жазады." },
  "▲ demo mode": { ru: "▲ демо-режим", kk: "▲ демо-режим" },
  "▲ available now": { ru: "▲ доступно сейчас", kk: "▲ қазір қолжетімді" },
  "▲ by request": { ru: "▲ по запросу", kk: "▲ сұраныс бойынша" },
  "Pick a cert to upgrade": { ru: "Выбрать сертификат для повышения", kk: "Көтеру үшін сертификат таңдау" },
  "From $89 / cert": { ru: "От $89 за сертификат", kk: "Сертификатқа $89-дан бастап" },
  "A licensed notary co-signs the certificate with Ed25519. The notary registry is still being assembled — check it for current availability.": { ru: "Лицензированный нотариус соподписывает сертификат ключом Ed25519. Реестр нотариусов ещё собирается — проверьте в нём текущую доступность.", kk: "Лицензиясы бар нотариус сертификатқа Ed25519 кілтімен қосымша қол қояды. Нотариустар тізілімі әлі жиналуда — ағымдағы қолжетімділікті сонда тексеріңіз." },
  "A licensed notary co-signs the certificate. Cryptographic co-signing is being finalised — ask us to confirm the current signing mode before buying this tier.": { ru: "Лицензированный нотариус соподписывает сертификат. Криптографическая соподпись дорабатывается — прежде чем покупать этот уровень, уточните у нас текущий режим подписи.", kk: "Лицензиясы бар нотариус сертификатқа қосымша қол қояды. Криптографиялық қосымша қолтаңба аяқталуда — бұл деңгейді сатып алмас бұрын ағымдағы қол қою режимін бізден нақтылаңыз." },
  "▲ live": { ru: "▲ работает", kk: "▲ жұмыс істейді" },
  "View Notary Registry": { ru: "Реестр нотариусов", kk: "Нотариустар тізілімі" },
  "Upgrade your Verified cert — select a notary and submit a request.": { ru: "Повысьте свой Verified-сертификат: выберите нотариуса и отправьте запрос.", kk: "Verified сертификатыңызды көтеріңіз: нотариусты таңдап, сұраныс жіберіңіз." },
  // 30.10.2026: пока kyc/payment — заглушка, витрина не продаёт платные уровни (решение Оркестратора)
  "price appears when notary co-signing opens": { ru: "цена появится, когда откроется нотариальная соподпись", kk: "баға нотариалдық қосымша қолтаңба ашылғанда көрсетіледі" },
  "The Verified mark is still being connected — leave your address and we will write when it opens.": { ru: "Отметка Verified ещё подключается — оставьте адрес, напишем, когда откроется.", kk: "Verified белгісі әлі қосылуда — мекенжай қалдырыңыз, ашылғанда жазамыз." },
  "Notary co-signing is still being connected — leave your address and we will write when it opens.": { ru: "Нотариальная соподпись ещё подключается — оставьте адрес, напишем, когда откроется.", kk: "Нотариалдық қосымша қолтаңба әлі қосылуда — мекенжай қалдырыңыз, ашылғанда жазамыз." },
  "Verified mark and notary co-signing are still being connected": { ru: "Отметка Verified и нотариальная соподпись ещё подключаются", kk: "Verified белгісі мен нотариалдық қосымша қолтаңба әлі қосылуда" },
  "Leave your address — we will send one email when they can be ordered. Nothing is charged today.": { ru: "Оставьте адрес — пришлём одно письмо, когда их можно будет заказать. Сегодня ничего не списывается.", kk: "Мекенжай қалдырыңыз — тапсырыс беруге болғанда бір хат жібереміз. Бүгін ештеңе алынбайды." },
  // реестр
  "Certificate Registry": { ru: "Реестр сертификатов", kk: "Сертификаттар тізілімі" },
  "+ New Certificate": { ru: "+ Новый сертификат", kk: "+ Жаңа сертификат" },
  "Public prior-art lookup — search by title, author, or paste a SHA-256 hash. Or": { ru: "Публичная проверка приоритета — ищите по названию, автору или вставьте SHA-256-хеш. Или", kk: "Басымдықты жария тексеру — атауы, авторы бойынша іздеңіз немесе SHA-256 хешін қойыңыз. Немесе" },
  "drop a file below": { ru: "перетащите файл ниже", kk: "файлды төменге сүйреңіз" },
  "to check it instantly.": { ru: "— проверим сразу.", kk: "— бірден тексереміз." },
  "Drop a file here to check prior art": { ru: "Перетащите файл сюда, чтобы проверить приоритет", kk: "Басымдықты тексеру үшін файлды осында сүйреңіз" },
  "Any format — computes SHA-256 in your browser, then searches the registry instantly": { ru: "Любой формат — SHA-256 считается в вашем браузере, затем сразу ищется в реестре", kk: "Кез келген формат — SHA-256 браузеріңізде есептеледі, содан кейін тізілімнен бірден ізделеді" },
  "Browse": { ru: "Выбрать файл", kk: "Файл таңдау" },
  "Search title, author, or paste SHA-256 hash…": { ru: "Название, автор или SHA-256-хеш…", kk: "Атауы, авторы немесе SHA-256 хеші…" },
  "Search registry": { ru: "Поиск по реестру", kk: "Тізілімнен іздеу" },
  "Clear search": { ru: "Очистить поиск", kk: "Іздеуді тазалау" },
  "Sort registry": { ru: "Сортировка реестра", kk: "Тізілімді сұрыптау" },
  "Newest first": { ru: "Сначала новые", kk: "Алдымен жаңалары" },
  "Oldest first": { ru: "Сначала старые", kk: "Алдымен ескілері" },
  "Most verified": { ru: "Больше всего проверок", kk: "Ең көп тексерілген" },
  "⭐ Verified only": { ru: "⭐ Только Verified", kk: "⭐ Тек Verified" },
  "Reset": { ru: "Сбросить", kk: "Тастау" },
  "All": { ru: "Все", kk: "Барлығы" },
  "Loading certificates...": { ru: "Загружаем сертификаты…", kk: "Сертификаттар жүктелуде…" },
  "No certificates yet": { ru: "Сертификатов пока нет", kk: "Әзірге сертификат жоқ" },
  "Protect your first work to see it here": { ru: "Защитите первую работу — она появится здесь", kk: "Алғашқы жұмысыңызды қорғаңыз — ол осында шығады" },
  "No prior art for this hash": { ru: "По этому хешу совпадений нет", kk: "Бұл хеш бойынша сәйкестік жоқ" },
  "Nothing matches your filters": { ru: "Под фильтры ничего не подходит", kk: "Сүзгілерге ештеңе сәйкес келмейді" },
  "Your content is unique in the AEVION registry — safe to register as new IP.": { ru: "Ваш контент уникален в реестре AEVION — его можно регистрировать как новую ИС.", kk: "Контентіңіз AEVION тізілімінде бірегей — оны жаңа ЗМ ретінде тіркеуге болады." },
  "Try a different search term or reset filters.": { ru: "Попробуйте другой запрос или сбросьте фильтры.", kk: "Басқа сұрау жазып көріңіз немесе сүзгілерді тастаңыз." },
  "🛡️ Register this work": { ru: "🛡️ Зарегистрировать эту работу", kk: "🛡️ Осы жұмысты тіркеу" },
  "Reset filters": { ru: "Сбросить фильтры", kk: "Сүзгілерді тастау" },
  "✓ VERIFIED AUTHOR": { ru: "✓ АВТОР ПОДТВЕРЖДЁН", kk: "✓ АВТОР РАСТАЛҒАН" },
  "✓ CERTIFIED": { ru: "✓ СЕРТИФИЦИРОВАНО", kk: "✓ СЕРТИФИКАТТАЛҒАН" },
  "SHA-256 Content Hash": { ru: "SHA-256-хеш содержимого", kk: "Мазмұнның SHA-256 хеші" },
  "Copy": { ru: "Копировать", kk: "Көшіру" },
  "✓ Verify": { ru: "✓ Проверить", kk: "✓ Тексеру" },
  "⭐ Upgrade to Verified": { ru: "⭐ Повысить до Verified", kk: "⭐ Verified деңгейіне көтеру" },
  "Copy Link": { ru: "Копировать ссылку", kk: "Сілтемені көшіру" },
  "Copy ID": { ru: "Копировать ID", kk: "ID көшіру" },
  "🛡️ Shield": { ru: "🛡️ Щит", kk: "🛡️ Қалқан" },
  "Hash": { ru: "Хеш", kk: "Хеш" },
  "File Hash": { ru: "Хеш файла", kk: "Файл хеші" },
  "Verify URL": { ru: "Ссылка проверки", kk: "Тексеру сілтемесі" },
  "Certificate ID": { ru: "ID сертификата", kk: "Сертификат ID" },
  // ошибки
  "Could not hash file": { ru: "Не удалось вычислить хеш файла", kk: "Файл хешін есептеу мүмкін болмады" },
  "You're on the waitlist!": { ru: "Вы в списке ожидания!", kk: "Сіз күту тізіміндесіз!" },
  "Network error — the waitlist did not receive your address": { ru: "Нет связи — список ожидания не получил ваш адрес", kk: "Байланыс жоқ — күту тізімі мекенжайыңызды алмады" },
  "Network error": { ru: "Нет связи с сервером", kk: "Сервермен байланыс жоқ" },
  "Copy failed": { ru: "Не удалось скопировать", kk: "Көшіру мүмкін болмады" },
  // правовая база и оговорка — дословно
  "Legal Framework": { ru: "Правовая база", kk: "Құқықтық негіз" },
  "AEVION IP Bureau builds on established international copyright and digital signature law. Our certificates are cryptographic proof that a work existed at a recorded time — how much weight that carries depends on the forum and on the frameworks listed below.": { ru: "Бюро авторства AEVION опирается на устоявшееся международное право об авторском праве и электронной подписи. Наши сертификаты — криптографическое доказательство того, что работа существовала в зафиксированный момент; какой вес это имеет, зависит от суда и от перечисленных ниже норм.", kk: "AEVION авторлық бюросы авторлық құқық пен электрондық қолтаңба туралы қалыптасқан халықаралық құқыққа сүйенеді. Біздің сертификаттар — жұмыстың тіркелген сәтте болғанының криптографиялық дәлелі; оның салмағы сотқа және төменде аталған нормаларға байланысты." },
  "Legal Disclaimer": { ru: "Правовая оговорка", kk: "Құқықтық ескерту" },
  // Оговорка: прежнее «They serve as admissible evidence of prior art…» снято 24.10.2026 по слову
  // Оркестратора — спорное обещание суду, противоречило абзацу выше («weight depends on the forum»).
  "Certificates issued by AEVION Digital IP Bureau constitute cryptographic proof of existence and authorship at the recorded time. They do not constitute a patent, trademark, or government-issued copyright registration. They are timestamped, independently verifiable records that you can present in a dispute over who created the work first — how much weight they carry depends on the court or office that reviews them.": { ru: "Сертификаты цифрового бюро авторства AEVION — криптографическое доказательство существования и авторства на зафиксированный момент. Они не являются патентом, товарным знаком или государственной регистрацией авторского права. Это записи с меткой времени, которые любой может проверить независимо; их можно предъявить в споре о том, кто создал работу первым, — какой вес они имеют, решает суд или ведомство, которое их рассматривает.", kk: "AEVION цифрлық авторлық бюросының сертификаттары — тіркелген сәттегі бар болу мен авторлықтың криптографиялық дәлелі. Олар патент, тауар белгісі немесе авторлық құқықты мемлекеттік тіркеу емес. Бұл — кез келген адам тәуелсіз тексере алатын уақыт белгісі бар жазбалар; оларды жұмысты кім бірінші жасағаны туралы дауда ұсынуға болады — олардың салмағын қарайтын сот немесе мекеме шешеді." },
  "Technology Stack": { ru: "Технологии", kk: "Технологиялар" },
  "Shamir's Secret Sharing": { ru: "Разделение секрета Шамира", kk: "Шамирдің құпияны бөлу әдісі" },
  "Threshold 2-of-3": { ru: "Порог 2 из 3", kk: "3-тен 2 шегі" },
  "Public Verification API": { ru: "Публичный API проверки", kk: "Жария тексеру API" },
};

/** Перевод строки страницы бюро. Нет перевода — исходник (английский). */
export function tBureau(lang: string, en: string): string {
  if (lang !== "ru" && lang !== "kk") return en;
  return BUREAU_TEXT[en]?.[lang] ?? en;
}

export function useBureauText(lang: string) {
  return useCallback((en: string) => tBureau(lang, en), [lang]);
}
