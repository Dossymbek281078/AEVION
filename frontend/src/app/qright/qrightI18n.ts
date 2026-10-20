/**
 * Словарь страницы /qright — ru поверх английского источника (образец: verify/[id]/verifyI18n.ts).
 *
 * 🔴 Заявка Продаж 19.10.2026 23:25: адрес aevion.app/qright стоит в подписи пяти
 * писем русскоязычным патентным бюро (уходят 20.10 09:00), а страница была целиком
 * английской при выбранном RU (замер: 0 кириллических знаков при 2058 латинских).
 * Ключ — английская строка из разметки: нет перевода → остаётся английский, а не
 * пустота. Хеши, идентификаторы и имена алгоритмов (SHA-256, Ed25519, HMAC, Shamir,
 * CID, JSON, PDF, QR, Bitcoin) не переводятся — это значения, не подписи.
 * kk — только подписи выгрузки записей (с 20.10); остальное при kk — английский.
 */
import type { Lang } from "@/lib/i18n-data";

const RU: Record<string, string> = {
  // герой
  "Protect Your Work": "Защитите свою работу",
  "One click. Four cryptographic layers. Forever-verifiable.": "Один клик. Четыре криптографических слоя. Проверяемо всегда.",
  "🛡️ Protect my work — free ↓": "🛡️ Защитить работу — бесплатно ↓",
  "Register your work and walk away with a self-contained proof bundle — Ed25519-signed immediately and Bitcoin-anchored once the timestamp confirms, verifiable even if AEVION disappears tomorrow.":
    "Зарегистрируйте работу и получите самодостаточный пакет доказательств — подписанный Ed25519 сразу и закреплённый в Bitcoin после подтверждения метки времени; проверяется, даже если AEVION завтра исчезнет.",
  "Open public transparency report": "Открыть публичный отчёт о прозрачности",
  "Live registry": "Живой реестр",
  "revoked": "отозвано",
  "Public report →": "Публичный отчёт →",
  // ключ автора
  "Your browser doesn't support Ed25519 in WebCrypto, so the author co-signature layer is disabled. The other three layers (SHA-256, HMAC, and Shamir-Ed25519) still apply — but for forge-resistance against an AEVION breach, open this page in an up-to-date Chromium or Firefox.":
    "Ваш браузер не поддерживает Ed25519 в WebCrypto, поэтому слой со-подписи автора отключён. Три остальных слоя (SHA-256, HMAC и Shamir-Ed25519) работают — но для защиты от подделки при взломе AEVION откройте эту страницу в свежем Chromium или Firefox.",
  "Your author identity": "Ваша авторская личность",
  "Back up your key now.": "Сохраните резервную копию ключа сейчас.",
  "If you lose this browser AND the backup, you cannot issue new claims under this identity. Existing certificates remain verifiable forever.":
    "Потеряете этот браузер И резервную копию — новые заявки под этой личностью выпустить не получится. Уже выданные сертификаты проверяемы всегда.",
  "⬇ Download key backup (.json)": "⬇ Скачать копию ключа (.json)",
  "Restore from file": "Восстановить из файла",
  // быстрый старт
  "Quick start guide": "Краткая инструкция",
  "First time? Start here.": "Впервые здесь? Начните отсюда.",
  "Fill": "Заполните",
  "title": "название",
  "description": "описание",
  ", pick the type, press": ", выберите тип и нажмите",
  "🛡️ Protect My Work": "🛡️ Защитить работу",
  "You walk away with: a public verify URL, a downloadable PDF, an Author Shard you store offline, and a Verification Bundle that works even if AEVION goes dark. Save the bundle and the shard — that's the part we cannot do for you.":
    "Вы получите: публичную ссылку проверки, PDF для скачивания, Долю автора, которую храните офлайн, и Пакет проверки, который работает, даже если AEVION исчезнет. Сохраните пакет и долю — это единственное, что мы не можем сделать за вас.",
  "Dismiss quick start guide": "Скрыть краткую инструкцию",
  // файл
  "📎 Attach a file": "📎 Прикрепить файл",
  "(optional)": "(необязательно)",
  "Drop any file to compute its SHA-256 fingerprint — stored alongside your certificate as proof the exact file existed at this timestamp.":
    "Перетащите любой файл — посчитаем его отпечаток SHA-256 и сохраним рядом с сертификатом как доказательство, что именно этот файл существовал на эту метку времени.",
  "Browse…": "Выбрать…",
  "⏳ Computing SHA-256…": "⏳ Считаем SHA-256…",
  "✕ Clear": "✕ Убрать",
  "Checking bureau registry for prior art…": "Проверяем реестр бюро на совпадения…",
  "No prior art found": "Совпадений не найдено",
  "This file is unique in the AEVION registry — safe to register.": "Этот файл уникален в реестре AEVION — можно регистрировать.",
  "Prior art detected": "Найдено совпадение",
  "Identical content already registered as": "Идентичное содержимое уже зарегистрировано как",
  "by": "— автор",
  "View existing certificate →": "Открыть существующий сертификат →",
  // форма
  "What are you protecting? *": "Что вы защищаете? *",
  'e.g. "My AI Music Track", "Logo Design v3", "Trading Algorithm"': "например: «Мой ИИ-трек», «Логотип v3», «Торговый алгоритм»",
  "Title of the work you are protecting": "Название защищаемой работы",
  "Type of work": "Тип работы",
  "Music / Audio": "Музыка / аудио",
  "Code / Software": "Код / ПО",
  "Design / Visual": "Дизайн / визуал",
  "Text / Article": "Текст / статья",
  "Video / Film": "Видео / фильм",
  "Idea / Concept": "Идея / концепция",
  "Other": "Другое",
  "Describe your work *": "Опишите работу *",
  "What is it? What makes it identifiable as yours? Anything you write here becomes part of the signed certificate.":
    "Что это? По чему её можно узнать как вашу? Всё написанное здесь становится частью подписанного сертификата.",
  "Description of the work": "Описание работы",
  "Author details (optional — auto-filled if logged in) · bureau / organisation shown on the verification page":
    "Данные автора (необязательно — заполняются при входе) · бюро / организация показывается на странице проверки",
  "Name": "Имя",
  "Your name": "Ваше имя",
  "Email": "Почта",
  "Country": "Страна",
  "e.g. Kazakhstan": "например: Казахстан",
  "City": "Город",
  "e.g. Astana": "например: Астана",
  "Bureau / organisation (shown on the verification page)": "Бюро / организация (показывается на странице проверки)",
  "Bureau or organisation": "Бюро или организация",
  "e.g. Example Patent Bureau — leave empty if you register as the author": "например: Патентное бюро «Пример» — оставьте пустым, если регистрируете как автор",
  "Shown as «Record made via … · verification by AEVION». Not part of the signature.":
    "Показывается как «Запись сделана через … · проверку обеспечивает AEVION». В подпись не входит.",
  "See plans →": "Смотреть тарифы →",
  "Protect my work — register, sign, and shield in one click": "Защитить работу — зарегистрировать, подписать и укрыть одним нажатием",
  "Protect My Work": "Защитить работу",
  "Protecting your work...": "Защищаем работу...",
  "Please fill in the title and description": "Заполните название и описание",
  "Could not hash file": "Не удалось посчитать хеш файла",
  // сертификат
  "Your work is now protected!": "Ваша работа защищена!",
  "Protected. Provable. Permanent.": "Защищено. Доказуемо. Навсегда.",
  // экран «готово» (20.10, окно «Приложения»): две фразы под заголовком и ссылка на публичную страницу
  "Four cryptographic layers active — including a co-signature only you can produce.":
    "Активны четыре криптографических слоя — включая со-подпись, которую можете создать только вы.",
  "Three cryptographic layers active — content hash, HMAC, and Shamir-split Ed25519.":
    "Активны три криптографических слоя — хеш содержимого, HMAC и Ed25519 с разделением по Шамиру.",
  "Open the public page of this record →": "Открыть публичную страницу записи →",
  // блок сертификата на экране «готово» (20.10, окно «Приложения»; замер прода: 122 англ. слова при ru)
  "AUTHOR": "АВТОР",
  "Not specified": "Не указано",
  // тексты авторской доли приходят с бэка (routes/pipeline.ts) — ключ = точная строка бэка
  "Save this shard offline (downloads, USB, password manager) — AEVION never keeps a copy. With your shard plus either the AEVION vault or the public Witness Shard you can reconstruct the proof independently of AEVION. Without it, recovery falls back to the AEVION vault + public Witness — which works, but requires us to be online.": "Сохраните эту долю офлайн (загрузки, USB, менеджер паролей) — AEVION копию не хранит. С вашей долей плюс хранилищем AEVION или публичной долей-свидетелем вы восстановите доказательство независимо от AEVION. Без неё восстановление возможно только из хранилища AEVION и публичной доли (2 из 3).",
  "Your Author Shard + AEVION vault — offline recovery, only AEVION needed for one shard": "Ваша авторская доля + хранилище AEVION — офлайн-восстановление, от AEVION нужна лишь одна доля",
  "Your Author Shard + public Witness Shard — full recovery without AEVION at all": "Ваша авторская доля + публичная доля-свидетель — полное восстановление без участия AEVION",
  "AEVION vault + public Witness Shard — fallback if you lose your Author Shard": "Хранилище AEVION + публичная доля-свидетель — запасной путь, если потеряете авторскую долю",
  "TYPE": "ТИП",
  "Content Hash (SHA-256)": "Хеш содержимого (SHA-256)",
  "HMAC Signature": "Подпись HMAC",
  "Ed25519 Signature": "Подпись Ed25519",
  "Quantum Shield ID": "Идентификатор Quantum Shield",
  "Certificate ID": "ID сертификата",
  "4-layer protection active:": "Активна 4-слойная защита:",
  "3-layer protection active:": "Активна 3-слойная защита:",
  "SHA-256 hash + HMAC-SHA256 signature + Ed25519 with Shamir's Secret Sharing": "хеш SHA-256 + подпись HMAC-SHA256 + Ed25519 с разделением секрета по Шамиру",
  "shards, threshold": "долей, порог",
  " + author co-signature": " + со-подпись автора",
  "Each layer detects a different attack. The author co-signature is the strongest: even if AEVION is breached and all platform keys leak, attackers still cannot forge new certificates in your name without your browser-held private key.": "Каждый слой ловит свою атаку. Со-подпись автора — самая сильная: даже если AEVION взломают и все ключи платформы утекут, злоумышленник не сможет создать новые сертификаты от вашего имени — ключ автора есть только у вас.",
  "Each layer detects a different attack: hash catches content tampering, HMAC catches certificate-field tampering, Shamir-Ed25519 makes forgery impossible without 2 of 3 distributed shards.": "Каждый слой ловит свою атаку: хеш — подмену содержимого, HMAC — подмену полей сертификата, Shamir-Ed25519 делает подделку невозможной без 2 из 3 распределённых долей.",
  "AEVION Protection Certificate": "Сертификат защиты AEVION",
  "✓ PROTECTED": "✓ ЗАЩИЩЕНО",
  "PROTECTED AT": "ЗАЩИЩЕНО",
  "LOCATION": "МЕСТО",
  "Copy": "Копировать",
  "Co-signed by your author key": "Со-подписано вашим авторским ключом",
  "Author key fingerprint:": "Отпечаток авторского ключа:",
  "Your Author Shard — Save It Now": "Ваша Доля автора — сохраните сейчас",
  "Shard 1 of 3 · AEVION does NOT keep a copy · Without it you depend on AEVION": "Доля 1 из 3 · AEVION копию НЕ хранит · без неё вы зависите от AEVION",
  "Any 2 of 3 reconstructs your proof:": "Любые 2 из 3 восстанавливают доказательство:",
  "Author shard downloaded — store it safely!": "Доля автора скачана — храните надёжно!",
  "⬇ Download Author Shard (.json)": "⬇ Скачать Долю автора (.json)",
  "Copy JSON": "Копировать JSON",
  "Public Witness Shard (shard 3 of 3)": "Публичная Доля свидетеля (доля 3 из 3)",
  "Content-addressed: anyone can fetch this shard and verify the bytes match the CID. Pair it with your Author Shard to recover without AEVION.":
    "Адресуется содержимым: любой может получить эту долю и сверить байты с CID. Вместе с вашей Долей автора она восстанавливает доказательство без AEVION.",
  // что дальше
  "What to do next": "Что делать дальше",
  "Download the Verification Bundle": "Скачайте Пакет проверки",
  "— a single": "— один файл",
  "file containing every cryptographic proof. Drop it into": "со всеми криптографическими доказательствами. Положите его в",
  "on any machine, any year, no AEVION required.": "на любой машине, в любом году, без AEVION.",
  "This is the proof that survives us.": "Это доказательство переживёт нас.",
  "Save your Author Shard": "Сохраните Долю автора",
  "(orange panel above) — store it offline alongside the bundle. AEVION holds at most 1 of 3 shards; without yours, no rogue platform action can forge a recovery.":
    "(оранжевая панель выше) — храните офлайн рядом с пакетом. У AEVION не больше 1 доли из 3; без вашей никакое действие платформы не подделает восстановление.",
  "Share the verify link": "Поделитесь ссылкой проверки",
  "— the public page shows every integrity check, the Bitcoin anchor status, and the legal basis.": "— публичная страница показывает все проверки целостности, статус якоря в Bitcoin и правовую основу.",
  "Print the PDF": "Распечатайте PDF",
  "for paper records — printable, with a QR code back to the live verify page.": "для бумажного архива — с QR-кодом на живую страницу проверки.",
  "Pin the Witness Shard": "Закрепите Долю свидетеля",
  "— its CID is content-addressed, so anyone can independently fetch and verify it. Combined with your Author Shard, that's 2 of 3 — recovery without AEVION.":
    "— её CID адресуется содержимым, так что любой может независимо получить и проверить её. Вместе с вашей Долей автора это 2 из 3 — восстановление без AEVION.",
  "📄 Download PDF Certificate": "📄 Скачать сертификат PDF",
  "A single .json with every proof — verifiable offline if AEVION ever disappears": "Один .json со всеми доказательствами — проверяется офлайн, даже если AEVION исчезнет",
  "🛡️ Download Verification Bundle": "🛡️ Скачать Пакет проверки",
  "✓ Verify Certificate": "✓ Проверить сертификат",
  "⭐ Upgrade to Verified": "⭐ Повысить до «Проверено»",
  "⏳ Verified upgrade — not available yet": "⏳ Повышение до «Проверено» — пока недоступно",
  "Upgrade to Verified — adds real-name attestation by AEVION Bureau": "Повышение до «Проверено» — заверение настоящего имени Бюро AEVION",
  "Get an embeddable trust badge for your site": "Получить встраиваемый значок доверия для сайта",
  "🔖 Embed Badge": "🔖 Встроить значок",
  "🛡️ Protect Another Work": "🛡️ Защитить ещё одну работу",
  "Shield Dashboard →": "Панель защиты →",
  "Export JSON": "Экспорт JSON",
  // реестр
  "Sign in to see your works": "Войдите, чтобы увидеть свои работы",
  "Search by title (≥ 2 chars)…": "Поиск по названию (от 2 знаков)…",
  "Filter loaded results by title…": "Отфильтровать загруженное по названию…",
  "Loading registry...": "Загружаем реестр...",
  "Top sources (30d)": "Источники (30 дней)",
  "Public page →": "Публичная страница →",
  "Get embed code →": "Код для встраивания →",
  "Policies →": "Правила →",
  "Revoke": "Отозвать",
  // выгрузка всех записей аккаунта (20.10, Продажи: «а если уйдём?»)
  "Download all my records": "Скачать все мои записи",
  "Preparing archive…": "Готовим архив…",
  "One .zip with every certificate bundle — verifiable without AEVION.":
    "Один .zip со всеми пакетами сертификатов — проверяется без AEVION.",
  "You have no records yet": "У вас пока нет записей",
  "Sign in to download your records": "Войдите, чтобы скачать свои записи",
  "More than 500 records — too many for one archive. Contact support for a full export.":
    "Больше 500 записей — для одного архива слишком много. Напишите в поддержку за полной выгрузкой.",
  "Could not download the archive — check your connection and try again":
    "Не удалось скачать архив — проверьте связь и попробуйте ещё раз",
  "Could not prepare the archive": "Не удалось подготовить архив",
  // подсказки полей (20.10, замер Продаж при ru-RU: 7 из 8 placeholder английские)
  "your@email.com": "вы@почта.kz",
  "Visible on the public revocation banner.": "Будет видно на публичном баннере отзыва.",
  "e.g. How does content hashing prove ownership?": "например: Как хеш содержимого доказывает авторство?",
};

/**
 * kk — пока только выгрузка записей (остальная страница при kk — английский
 * источник, как и до 20.10). Ключи — те же английские строки, что у RU.
 */
const KK: Record<string, string> = {
  // кнопка на экране «готово» (20.10, окно «Приложения»): «Verified» оставалось английским при ru/kk
  "⭐ Upgrade to Verified": "⭐ «Расталған» деңгейіне көтеру",
  "Download all my records": "Барлық жазбаларымды жүктеу",
  "Preparing archive…": "Мұрағат дайындалуда…",
  "One .zip with every certificate bundle — verifiable without AEVION.":
    "Барлық сертификат пакеттері бар бір .zip — AEVION-сыз тексеріледі.",
  "You have no records yet": "Сізде әзірге жазба жоқ",
  "Sign in to download your records": "Жазбаларыңызды жүктеу үшін кіріңіз",
  "More than 500 records — too many for one archive. Contact support for a full export.":
    "500-ден астам жазба — бір мұрағат үшін тым көп. Толық экспорт үшін қолдау қызметіне жазыңыз.",
  "Could not download the archive — check your connection and try again":
    "Мұрағатты жүктеу мүмкін болмады — байланысты тексеріп, қайта көріңіз",
  "Could not prepare the archive": "Мұрағатты дайындау мүмкін болмады",
  "your@email.com": "сіз@пошта.kz",
  "Visible on the public revocation banner.": "Жария кері шақыру баннерінде көрсетіледі.",
  "e.g. How does content hashing prove ownership?": "мысалы: Мазмұн хеші авторлықты қалай дәлелдейді?",
};

export const QRIGHT_DICT: Partial<Record<Lang, Record<string, string>>> = { ru: RU, kk: KK };

/** Перевод строки /qright; нет перевода — английский источник как есть. */
export function tq(lang: Lang | string | undefined, en: string): string {
  const d = lang ? QRIGHT_DICT[lang as Lang] : undefined;
  return (d && d[en]) || en;
}

/** Сколько ключей в словаре — знаменатель для сторожа и отчёта. */
export function qrightDictCoverage(): { ru: number } {
  return { ru: Object.keys(RU).length };
}
