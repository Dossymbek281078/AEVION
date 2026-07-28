/**
 * Сравнение модулей AEVION с аналогами — данные для страницы `/compare`.
 *
 * ПРАВИЛО ЭТОГО ФАЙЛА: ни одной цифры и ни одного утверждения «из головы».
 * Про нас — только измеренное (прогон, запрос к проду, счётчик по коду), про
 * чужих — только опубликованное, со ссылкой и датой сверки. Колонка «где мы
 * слабее» обязательна: сравнение без неё читается как реклама и не стоит
 * ничего. Если по модулю сравнения не делали — он идёт в `NOT_COMPARED`, а не
 * получает выдуманную строку.
 *
 * Двуязычно, потому что демо идёт на английском, а инвестор попадает сюда прямо
 * из него. Обе версии лежат рядом в одном объекте, а не в двух списках: два
 * списка неизбежно расходятся — строку добавят в один и забудут в другом.
 * Сторож требует, чтобы оба языка были заполнены.
 */

/** Текст в двух языках. `t()` — чтобы версии читались парой, а не врозь. */
export interface Txt {
  ru: string;
  en: string;
}

const t = (ru: string, en: string): Txt => ({ ru, en });

export type Verdict = "we-stronger" | "they-stronger" | "different-league";

export interface CompareRow {
  /** id модуля из реестра `data/projects.ts` */
  module: string;
  title: Txt;
  /** С кем сравниваем — публичные продукты, а не «рынок вообще». */
  rivals: string[];
  /** Одной строкой: как соотносимся. Без превосходных степеней. */
  headline: Txt;
  verdict: Verdict;
  /** Чем мы сильнее — только проверяемое. */
  strengths: Txt[];
  /** Чем слабее. Пусто быть не может. */
  weaknesses: Txt[];
  /** Чем и когда мерили нашу сторону. */
  measured: Txt;
  /** Источники по чужой стороне. */
  sources: { label: Txt; url: string }[];
  /**
   * Ставится ТОЛЬКО когда строка не утверждает про аналог ничего фактического
   * (все цифры — про нас). Без этого флага сторож требует источник: цифра про
   * чужой продукт без ссылки — это слух, а не сравнение.
   */
  noRivalClaims?: true;
}

export const COMPARE_UPDATED = "2026-07-28";

export const COMPARE_ROWS: CompareRow[] = [
  {
    module: "cyberchess",
    title: t("CyberChess — шахматы с разбором", "CyberChess — chess with post-game coaching"),
    rivals: ["Lichess", "Chess.com"],
    headline: t(
      "По размеру базы задач мы на уровне Chess.com образца 2023 года и вдвенадцатеро меньше Lichess. Разбор партии по уровню игрока — то, чего у них в таком виде нет.",
      "Our puzzle pool matches Chess.com's 2023 figure and is about twelve times smaller than Lichess. Coaching pitched at the player's strength is the part they do not have in this form.",
    ),
    verdict: "they-stronger",
    strengths: [
      t(
        "AI-разбор сыгранной партии: не только «ход плохой», а объяснение уровнем игрока — от новичка до КМС.",
        "AI review of the finished game: not just «bad move», but an explanation pitched at the player's level, from beginner to candidate master.",
      ),
      t(
        "Пазлы и AI-разбор доступны без подписки и без счёта задач в день.",
        "Puzzles and AI review need no subscription and no daily puzzle quota.",
      ),
    ],
    weaknesses: [
      t(
        "База задач 502 584 против 6 057 356 у Lichess — примерно в двенадцать раз меньше.",
        "502,584 puzzles against 6,057,356 on Lichess — roughly twelve times fewer.",
      ),
      t(
        "Нет живой аудитории: соперника ждать не с кем, тогда как у обоих аналогов миллионы партий в сутки.",
        "No live audience: there is nobody to be matched against, while both rivals run millions of games a day.",
      ),
      t(
        "Нет рейтинга, признаваемого сообществом, и нет турнирной истории.",
        "No community-recognised rating and no tournament history.",
      ),
    ],
    measured: t(
      "Наша база — запрос к проду `/api/puzzles/count` 27.07.2026: `total: 502584`. Пазлы взяты из открытого дампа Lichess (CC0), поэтому сравнение корректно по одной методике.",
      "Our side — production call to `/api/puzzles/count` on 2026-07-27: `total: 502584`. Puzzles come from the open Lichess dump (CC0), so both numbers are counted the same way.",
    ),
    sources: [
      {
        label: t("Открытая база Lichess (6 057 356 задач, обновлено 05.07.2026)", "Lichess open database (6,057,356 puzzles, updated 2026-07-05)"),
        url: "https://database.lichess.org/",
      },
      {
        label: t("Chess.com о своей базе (свыше 570 000 задач)", "Chess.com on its own puzzle database (over 570,000)"),
        url: "https://www.chess.com/blog/CHESScom/how-we-built-a-puzzle-database-with-half-a-million-puzzles",
      },
    ],
  },
  {
    module: "qsign",
    title: t("QSign и IP-бюро — подпись и фиксация авторства", "QSign and IP Bureau — signing and authorship proof"),
    rivals: ["DocuSign", "Dropbox Sign"],
    headline: t(
      "Мы дешевле и без лимита на документы, но у нас нет юридического статуса электронной подписи. Это разные вещи, и подменять одно другим нельзя.",
      "We are cheaper and cap nothing, but we carry no legal status as an electronic signature. These are different things and must not be sold as one.",
    ),
    verdict: "different-league",
    strengths: [
      t(
        "Нет платы за пользователя и нет потолка по числу документов: у DocuSign тарифы Standard и Business Pro ограничены 100 конвертами на пользователя в год.",
        "No per-seat fee and no document cap: DocuSign's Standard and Business Pro plans are limited to 100 envelopes per user per year.",
      ),
      t(
        "Фиксация авторства через хеш и метку времени — задача, которой у DocuSign нет вовсе: он подписывает договор, а не доказывает, что файл существовал в такую-то дату.",
        "Authorship proof by hash and timestamp — a job DocuSign does not do at all: it signs an agreement, it does not prove a file existed on a given date.",
      ),
    ],
    weaknesses: [
      t(
        "Наша подпись НЕ является квалифицированной электронной подписью: в суде она не заменяет ЭЦП. DocuSign соответствует ESIGN, eIDAS и подобным режимам — мы нет.",
        "Our signature is NOT a qualified electronic signature and does not stand in for one in court. DocuSign complies with ESIGN, eIDAS and similar regimes; we do not.",
      ),
      t(
        "Нет проверки личности подписанта. У DocuSign это отдельная платная услуга, но она есть.",
        "No signer identity verification. DocuSign charges extra for it — but it exists.",
      ),
      t(
        "Пост-квантовая подпись ML-DSA включается ключом, которого на проде нет: прод отвечает `activeKeys: {hmac, ed25519}`. Пока это заявка, а не работающая функция.",
        "The post-quantum ML-DSA signature is key-activated and the key is not set in production: prod answers `activeKeys: {hmac, ed25519}`. For now it is a claim, not a working feature.",
      ),
    ],
    measured: t(
      "Наша сторона — прод-ответ `/api/qsign/v2/keys` и реестр ключей, сверено 27.07.2026. Ограничение по конвертам и цены DocuSign — по публичным тарифам, сверено 28.07.2026.",
      "Our side — production response of `/api/qsign/v2/keys` and the key registry, checked 2026-07-27. DocuSign envelope caps and prices — published plans, checked 2026-07-28.",
    ),
    sources: [
      { label: t("Разбор тарифов DocuSign 2026 (PandaDoc)", "DocuSign 2026 pricing breakdown (PandaDoc)"), url: "https://www.pandadoc.com/blog/docusign-pricing/" },
      { label: t("Тарифы DocuSign: от бесплатного до $40 за пользователя", "DocuSign plans: free to $40 per user"), url: "https://costbench.com/software/e-signature/docusign/" },
    ],
  },
  {
    module: "qcontract",
    title: t("QContract — документ по защищённой ссылке", "QContract — documents behind a guarded link"),
    rivals: ["PandaDoc", "DocuSign"],
    headline: t(
      "Мы решаем другую задачу: не согласование договора, а безопасную выдачу документа — пароль, счётчик просмотров, срок и отзыв. Зато всего, ради чего покупают PandaDoc, у нас нет.",
      "We solve a different problem: not agreement workflow but guarded delivery — password, view counter, expiry, revocation. Everything people actually buy PandaDoc for, we lack.",
    ),
    verdict: "different-league",
    strengths: [
      t(
        "Ссылка с паролем, лимитом просмотров, сроком жизни и отзывом: посмотрели трижды — доступ закрылся. У PandaDoc ссылка на документ так не ограничивается.",
        "A link with a password, a view limit, an expiry and revocation: viewed three times and access closes. PandaDoc does not restrict a document link this way.",
      ),
      t(
        "Списание просмотра атомарное: одновременные открытия не пробивают лимит (исправлено 27.07.2026).",
        "The view is claimed atomically: concurrent opens cannot punch through the limit (fixed 2026-07-27).",
      ),
      t(
        "Бесплатно и без оплаты за пользователя: у PandaDoc Starter стоит $19 за пользователя в месяц при годовой оплате, Business — $49.",
        "Free and with no per-seat fee: PandaDoc Starter is $19 per user per month billed annually, Business is $49.",
      ),
    ],
    weaknesses: [
      t(
        "На проде ровно 2 документа. Это не продукт с пользователями, а работающий механизм.",
        "Exactly 2 documents in production. This is a working mechanism, not a product with users.",
      ),
      t(
        "Нет ничего из того, ради чего покупают PandaDoc: шаблонов, согласований, интеграций с CRM, библиотеки контента, оплаты внутри документа.",
        "None of what PandaDoc is bought for: templates, approval workflows, CRM integrations, a content library, in-document payment.",
      ),
      t(
        "Юридической силы подписи нет: квалифицированная подпись у PandaDoc — отдельная услуга, у нас её нет вовсе.",
        "No legal signing force: a qualified signature is a paid add-on at PandaDoc and absent here entirely.",
      ),
    ],
    measured: t(
      "Наша сторона — прод-запрос `/api/qcontract/health` 28.07.2026: `documents: 2`; пароль, лимит просмотров, срок и отзыв — по коду роутера. Тарифы PandaDoc — публичные, сверено 28.07.2026.",
      "Our side — production call to `/api/qcontract/health` on 2026-07-28: `documents: 2`; password, view limit, expiry and revocation read from the router code. PandaDoc prices — published, checked 2026-07-28.",
    ),
    sources: [
      { label: t("Тарифы PandaDoc 2026: $19–$49 за пользователя в месяц", "PandaDoc 2026 pricing: $19–$49 per user per month"), url: "https://costbench.com/software/contract-management/pandadoc/" },
      { label: t("Разбор планов PandaDoc 2026", "PandaDoc 2026 plan breakdown"), url: "https://www.docupilot.com/blog/pandadoc-pricing" },
    ],
  },
  {
    module: "qpaynet-embedded",
    title: t("Платёжный API — QPayNet", "Payments API — QPayNet"),
    rivals: ["Stripe", "Paddle"],
    headline: t(
      "Честно: это API-демонстрация, а не платёжный провайдер. Мы не проводим деньги вообще, поэтому сравнивать нас со Stripe по комиссии некорректно.",
      "Plainly: this is an API-shaped demo, not a payment provider. We move no money at all, so comparing us to Stripe on fees would be dishonest.",
    ),
    verdict: "they-stronger",
    strengths: [
      t(
        "Форма API повторяет привычную: ключи `sk_test_…`, заголовок `Idempotency-Key`, подписанные вебхуки с повторами. Разработчику, знающему Stripe, ничего не надо учить заново.",
        "The API shape is the familiar one: `sk_test_…` keys, an `Idempotency-Key` header, signed webhooks with retries. A developer who knows Stripe learns nothing new.",
      ),
      t(
        "Песочница бесплатна и не требует регистрации юридического лица — попробовать интеграцию можно за минуты.",
        "The sandbox is free and needs no legal entity — an integration can be tried in minutes.",
      ),
    ],
    weaknesses: [
      t(
        "Эквайринга нет. Ни одной реальной транзакции провести нельзя — деньги не двигаются.",
        "There is no acquiring. Not one real transaction can be made — money does not move.",
      ),
      t(
        "Нет лицензии, нет договора с банком, нет PCI DSS. Stripe берёт 2,9% + $0,30 за операцию именно за то, чего у нас нет.",
        "No licence, no bank agreement, no PCI DSS. Stripe charges 2.9% + $0.30 per transaction for exactly what we do not have.",
      ),
      t(
        "Данные песочницы живут в памяти процесса: при передеплое ссылки и возвраты обнуляются.",
        "Sandbox data lives in process memory: links and refunds reset on every redeploy.",
      ),
    ],
    measured: t(
      "Наша сторона — чтение кода и прогон 27–28.07.2026: ключи проходят по маске `sk_test_`, хранилище — Map в памяти при незаданном KV. Комиссии Stripe — по публичным тарифам, сверено 28.07.2026.",
      "Our side — code reading and runs on 2026-07-27/28: keys pass an `sk_test_` mask, storage is an in-memory Map when KV is unset. Stripe fees — published pricing, checked 2026-07-28.",
    ),
    sources: [
      { label: t("Тарифы Stripe 2026: 2,9% + $0,30 за онлайн-платёж", "Stripe 2026 fees: 2.9% + $0.30 per online payment"), url: "https://checkoutpage.com/blog/stripe-processing-fees" },
      { label: t("Разбор тарифов Stripe 2026 (Flexprice)", "Stripe 2026 pricing breakdown (Flexprice)"), url: "https://flexprice.io/blog/stripe-pricing-breakdown-2026" },
    ],
  },
  {
    module: "qstore",
    title: t("QStore — продажа цифровых товаров", "QStore — selling digital products"),
    rivals: ["Gumroad", "Lemon Squeezy"],
    headline: t(
      "Мы не берём комиссию, потому что и денег не принимаем. Пока это витрина, а не магазин: продавец не получит выплату.",
      "We charge no commission because we take no money. For now this is a storefront, not a shop: a seller gets no payout.",
    ),
    verdict: "they-stronger",
    strengths: [
      t(
        "Нет платформенной комиссии: Gumroad берёт 10% + $0,50 с продажи, Lemon Squeezy — от 5% + $0,50.",
        "No platform fee: Gumroad takes 10% + $0.50 per sale, Lemon Squeezy from 5% + $0.50.",
      ),
      t(
        "Товар живёт внутри платформы и виден поиску и соседним модулям, а не только на отдельной странице продавца.",
        "A product lives inside the platform and is visible to search and neighbouring modules, not only on a standalone seller page.",
      ),
    ],
    weaknesses: [
      t(
        "Мы не merchant of record. Gumroad и Lemon Squeezy берут на себя НДС и налоговую отчётность по всему миру — это и есть главное, за что им платят.",
        "We are not a merchant of record. Gumroad and Lemon Squeezy carry worldwide VAT and tax reporting — which is the main thing they are paid for.",
      ),
      t("Выплат продавцу нет: деньги через нас не проходят.", "There are no seller payouts: money does not pass through us."),
      t(
        "На проде 21 товар и нет своей аудитории; у Gumroad есть витрина Discover, которая приводит покупателей — за 30% с такой продажи.",
        "21 products in production and no audience of our own; Gumroad has the Discover marketplace that brings buyers — for 30% of such a sale.",
      ),
    ],
    measured: t(
      "Наша сторона — прод-запрос `/api/qstore/products?limit=100` 28.07.2026: 21 товар; отсутствие выплат — по коду. Комиссии аналогов — публичные, сверено 28.07.2026.",
      "Our side — production call to `/api/qstore/products?limit=100` on 2026-07-28: 21 products; absence of payouts read from the code. Rival fees — published, checked 2026-07-28.",
    ),
    sources: [
      { label: t("Комиссии Gumroad 2026: 10% + $0,50, Discover 30%", "Gumroad 2026 fees: 10% + $0.50, Discover 30%"), url: "https://www.swell.is/content/gumroad-pricing" },
      { label: t("Lemon Squeezy против Gumroad: арифметика комиссий", "Lemon Squeezy vs Gumroad: the real fee math"), url: "https://www.getly.store/blog/gumroad-vs-lemon-squeezy" },
    ],
  },
  {
    module: "qbuild",
    title: t("QBuild / DevHub — сборка приложения по описанию", "QBuild / DevHub — building an app from a prompt"),
    rivals: ["Lovable", "Bolt.new", "v0"],
    headline: t(
      "У них зрелее инфраструктура и живые тысячи пользователей. Наше отличие — не «лучше генерирует», а что результат попадает внутрь платформы с готовыми модулями.",
      "Their infrastructure is more mature and they have thousands of live users. Our difference is not «generates better» — it is that the result lands inside a platform with ready modules.",
    ),
    verdict: "they-stronger",
    strengths: [
      t(
        "Сгенерированное приложение сразу видит соседние модули AEVION — вход, подпись, платёжную песочницу — и не требует подключать их отдельно.",
        "The generated app immediately sees neighbouring AEVION modules — auth, signing, the payments sandbox — with nothing to wire up separately.",
      ),
      t(
        "Нет отдельной подписки: у Lovable и Bolt.new тариф Pro стоит $25 в месяц.",
        "No separate subscription: Lovable and Bolt.new both charge $25 a month for Pro.",
      ),
    ],
    weaknesses: [
      t(
        "У Lovable из коробки полноценный бэкенд через Supabase — вход, база, файлы, реалтайм. У нас этого набора нет.",
        "Lovable ships a full backend through Supabase out of the box — auth, database, storage, realtime. We have no such set.",
      ),
      t(
        "У Bolt.new — дерево файлов, терминал и выбор модели; у нас редактирование результата беднее.",
        "Bolt.new offers a file tree, a terminal and a choice of models; our editing of the result is poorer.",
      ),
      t(
        "У них годы работы с живыми пользователями и отлаженный деплой; у нас деплой-путь чинился 21.07.2026 после того, как месяцами отдавал «успех» на страницы, которые не открывались.",
        "They have years of live usage and a settled deploy path; ours was repaired on 2026-07-21 after months of reporting «success» for pages that never opened.",
      ),
    ],
    measured: t(
      "Наша сторона — по записям рабочих сессий 22–23.07.2026 (сквозной прогон флоу) и по коду деплой-пути; отдельного замера скорости против аналогов не делали. Чужая сторона — публичные обзоры, сверено 28.07.2026.",
      "Our side — from work-session records of 2026-07-22/23 (an end-to-end flow run) and from the deploy-path code; no head-to-head speed measurement was made. Their side — published reviews, checked 2026-07-28.",
    ),
    sources: [
      { label: t("Сравнение Lovable и Bolt.new 2026 (NxCode)", "Lovable vs Bolt.new 2026 (NxCode)"), url: "https://www.nxcode.io/resources/news/lovable-vs-bolt-new-2026-ai-app-builder-comparison" },
      { label: t("Обзор лучших AI-сборщиков приложений 2026 (Layout)", "Best AI app builders 2026 (Layout)"), url: "https://layout.dev/blog/best-ai-app-builders-2026-comparison" },
    ],
  },
  {
    module: "qreal",
    title: t("QReal Studio — генерация видео", "QReal Studio — video generation"),
    rivals: ["Higgsfield", "Runway", "Kling"],
    headline: t(
      "Мы не обучаем моделей и не конкурируем с ними по качеству картинки: QReal — оболочка поверх чужих генераторов. Выигрыш возможен только в сценарии и цене, и он не измерен.",
      "We train no models and do not compete on picture quality: QReal is a shell over other people's generators. Any advantage can only be in workflow and price, and it is unmeasured.",
    ),
    verdict: "they-stronger",
    strengths: [
      t(
        "Один сценарий вместо ручной склейки: бриф → раскадровка → озвучка → сборка, без переноса файлов между сервисами.",
        "One workflow instead of manual stitching: brief → storyboard → voice → assembly, with no carrying files between services.",
      ),
      t(
        "Не завязаны на одного поставщика: модель можно сменить, не меняя сценарий.",
        "Not tied to one vendor: the model can be swapped without changing the workflow.",
      ),
    ],
    weaknesses: [
      t(
        "Своей модели нет. Качество ролика — это качество Kling, Veo или Sora, а не наше.",
        "There is no model of our own. Clip quality is Kling's, Veo's or Sora's — not ours.",
      ),
      t(
        "У Higgsfield тарифы от $15 до $99 в месяц и понятная экономика по кредитам; у нас цена за ролик не посчитана вовсе.",
        "Higgsfield runs $15 to $99 a month with clear credit economics; our cost per clip has not been calculated at all.",
      ),
      t(
        "Слепого сравнения качества против Higgsfield мы не проводили — и до тех пор не вправе утверждать, что лучше.",
        "We have run no blind quality comparison against Higgsfield — and until we do, we may not claim to be better.",
      ),
    ],
    measured: t(
      "Наша сторона — состав пайплайна по коду, 28.07.2026. Замера качества и стоимости ролика нет: решение основателя от 21.07.2026 — не публиковать сравнение до слепого бенчмарка на 10 брифах.",
      "Our side — pipeline composition read from code, 2026-07-28. No quality or cost measurement exists: the founder's 2026-07-21 decision is to publish no comparison before a blind 10-brief benchmark.",
    ),
    sources: [
      { label: t("Тарифы Higgsfield 2026: $15 / $39 / $99", "Higgsfield 2026 pricing: $15 / $39 / $99"), url: "https://www.layer3labs.io/guides/higgsfield-ai-pricing" },
      { label: t("Higgsfield против Runway: сравнение планов", "Higgsfield vs Runway: plans compared"), url: "https://higgsfield.ai/blog/higgsfield-vs-runway-2026" },
    ],
  },
  {
    module: "qchaingov",
    title: t("QChainGov — голосования сообщества", "QChainGov — community governance"),
    rivals: ["Snapshot", "Aragon"],
    headline: t(
      "Строку пишу против себя: у Snapshot 35 000 сообществ и бесплатное голосование без комиссии сети, а у нас на проде 15 предложений, и все пятнадцать — смоук-тесты.",
      "This row is written against ourselves: Snapshot serves 35,000 communities with free gasless voting, while our production holds 15 proposals — all fifteen of them smoke tests.",
    ),
    verdict: "they-stronger",
    strengths: [
      t(
        "Голосование привязано к входу в платформу, а не к кошельку: участнику не нужен ни кошелёк, ни токен.",
        "Voting is tied to the platform login rather than a wallet: a participant needs neither wallet nor token.",
      ),
      t(
        "Под каждым решением — подпись QSign, то есть запись остаётся проверяемой без блокчейна.",
        "Every decision carries a QSign signature, so the record stays verifiable without a blockchain.",
      ),
    ],
    weaknesses: [
      t(
        "На проде 15 предложений, и все 15 созданы смоук-тестами. Реального использования нет.",
        "Production holds 15 proposals, all 15 created by smoke tests. There is no real usage.",
      ),
      t(
        "Квадратичного голосования и дерева делегирования у нас нет — в роутере ноль упоминаний. У Snapshot это готовые стратегии, включая делегирование по модели Compound и Uniswap.",
        "We have no quadratic voting and no delegation tree — zero mentions in the router. On Snapshot these are ready-made strategies, including Compound- and Uniswap-style delegation.",
      ),
      t(
        "Snapshot бесплатен и обслуживает более 35 000 сообществ; нам предъявить нечего.",
        "Snapshot is free and serves over 35,000 communities; we have nothing to set against that.",
      ),
    ],
    measured: t(
      "Наша сторона — прод-запрос `/api/qchaingov/proposals?limit=100` 28.07.2026: 15 записей, у всех 15 в заголовке Smoke/Test; отсутствие квадратичного голосования — счётчик по роутеру 27.07.2026. Данные Snapshot — публичные, сверено 28.07.2026.",
      "Our side — production call to `/api/qchaingov/proposals?limit=100` on 2026-07-28: 15 records, all 15 with Smoke/Test in the title; absence of quadratic voting from a router-wide count on 2026-07-27. Snapshot figures — published, checked 2026-07-28.",
    ),
    sources: [
      { label: t("Snapshot: бесплатное голосование без газа, 35 000+ сообществ", "Snapshot: free gasless voting, 35,000+ communities"), url: "https://www.dextools.io/tutorials/what-is-snapshot-dao-governance-voting-guide-2026" },
      { label: t("Стратегии Snapshot: квадратичное голосование и делегирование", "Snapshot strategies: quadratic voting and delegation"), url: "https://chainscorelabs.com/en/glossary/smart-contracts/dao-governance-contracts/snapshot-voting" },
    ],
  },
  {
    module: "healthai",
    title: t("HealthAI — отслеживание биомаркеров", "HealthAI — biomarker tracking"),
    rivals: ["Function Health", "InsideTracker"],
    headline: t(
      "Мы не берём анализы и не смотрим кровь. Это трекер с правилами поверх ваших же результатов, а не лаборатория — и разница здесь принципиальная, а не в цене.",
      "We draw no blood and run no labs. This is a tracker with rules on top of results you already have — the difference is in kind, not in price.",
    ),
    verdict: "different-league",
    strengths: [
      t(
        "Бесплатно и без забора крови: свои показатели можно вести хоть из бумажной выписки поликлиники.",
        "Free and with no blood draw: values can be entered straight from a paper lab report.",
      ),
      t(
        "Данные лежат в Postgres и переживают передеплой — в отличие от нашего же QMedia в этой таблице.",
        "Data sits in Postgres and survives redeploys — unlike our own QMedia elsewhere in this table.",
      ),
    ],
    weaknesses: [
      t(
        "Анализов мы не делаем вовсе. Function Health за $365 в год даёт два забора крови и более 100 показателей с проверкой врачом — у нас ни забора, ни врача.",
        "We do no testing at all. Function Health gives two blood draws and 100+ biomarkers with clinician review for $365 a year — we have neither draw nor clinician.",
      ),
      t(
        "Правил всего 10. Это подсказки по типовым отклонениям, а не персональная программа.",
        "There are only 10 rules. These are hints on typical deviations, not a personal programme.",
      ),
      t(
        "На проде 64 профиля, и происхождение их мы не проверяли — считать это аудиторией нельзя.",
        "64 profiles in production, and we have not checked where they came from — this cannot be counted as an audience.",
      ),
      t(
        "Нет ни биологического возраста, ни генетики, ни истории по годам — того, ради чего платят $149 членства InsideTracker.",
        "No biological age, no genetics, no multi-year history — the things InsideTracker's $149 membership is paid for.",
      ),
    ],
    measured: t(
      "Наша сторона — прод-запрос `/api/healthai/health` 28.07.2026: `persistence: postgres`, `profilesCount: 64`, `rulesCount: 10`. Цены и состав аналогов — публичные, сверено 28.07.2026.",
      "Our side — production call to `/api/healthai/health` on 2026-07-28: `persistence: postgres`, `profilesCount: 64`, `rulesCount: 10`. Rival prices and scope — published, checked 2026-07-28.",
    ),
    sources: [
      { label: t("Function Health 2026: $365 в год, два забора, 100+ показателей", "Function Health 2026: $365/year, two draws, 100+ biomarkers"), url: "https://www.bloodtestcomparison.com/function-health" },
      { label: t("InsideTracker против Function Health: цены и состав", "InsideTracker vs Function Health: price and scope"), url: "https://finvsfin.com/function-health-vs-superpower-vs-insidetracker-vs-lifeforce/" },
    ],
  },
  {
    module: "smeta-trainer",
    title: t("Тренажёр сметного дела РК", "Construction estimating trainer (Kazakhstan)"),
    rivals: ["АВС-4 (АВС-KZ)", "Смета РК", "Сана"],
    headline: t(
      "Мы не конкурируем с АВС-4 и не пытаемся: он делает сметы для сдачи, мы учим методике. Сметчику для работы нужен он, а не мы.",
      "We do not compete with АВС-4 and do not try to: it produces estimates for submission, we teach the method. For actual work an estimator needs it, not us.",
    ),
    verdict: "different-league",
    strengths: [
      t(
        "Бесплатно и в браузере, без установки: лицензия АВС-4 в Казахстане стоит от 330 000 ₸, обновление — 280 000 ₸, курсы по программе — около 60 000 ₸.",
        "Free and in the browser, nothing to install: an АВС-4 licence in Kazakhstan starts at ₸330,000, an update costs ₸280,000, and courses run about ₸60,000.",
      ),
      t(
        "AI-советник ловит типовые ошибки студента — не вычел проёмы, посчитал дважды, забыл коэффициент, — а не просто считает сумму.",
        "The AI advisor catches a student's typical mistakes — openings not deducted, double counting, a forgotten coefficient — rather than just adding numbers up.",
      ),
      t(
        "Учебный корпус завязан на реальный пример сметы РК (34 позиции из настоящего документа с уровнем цен II квартала 2026), а не на выдуманные цифры.",
        "The training corpus is tied to a real Kazakh estimate (34 line items from an actual document priced at Q2 2026), not to invented figures.",
      ),
    ],
    weaknesses: [
      t(
        "Это тренажёр, а не сметная программа. Документ, который примет экспертиза, в нём не сделать.",
        "This is a trainer, not estimating software. A document that state review would accept cannot be produced in it.",
      ),
      t(
        "Корпус учебный: 500 расценок и 3 индекса против полной нормативной базы РК, которую ведут в АВС-4 по подписке.",
        "The corpus is for teaching: 500 rates and 3 indices against the full Kazakh normative base maintained in АВС-4 by subscription.",
      ),
      t(
        "Нас нет в реестре программных средств, допущенных для бюджетных объектов, — и не планируется.",
        "We are not on the register of software admitted for publicly funded projects — and are not headed there.",
      ),
      t(
        "Прогресс ученика в базе не хранится: у модуля 23 ручки и ноль запросов к Postgres.",
        "Student progress is not stored in a database: the module has 23 endpoints and zero Postgres queries.",
      ),
    ],
    measured: t(
      "Наша сторона — счётчики по коду и корпусу 28.07.2026: `seed.json` — 500 расценок, 3 индекса, 2 объекта; `real-rates.json` — 34 позиции из примера сметы РК; роутер — 23 ручки, 0 совпадений `pool.query`. Цены на АВС-4 — публичные предложения продавцов в РК, сверено 28.07.2026.",
      "Our side — code and corpus counts on 2026-07-28: `seed.json` holds 500 rates, 3 indices, 2 objects; `real-rates.json` holds 34 line items from a real Kazakh estimate; the router has 23 endpoints and 0 `pool.query` matches. АВС-4 prices — public reseller listings in Kazakhstan, checked 2026-07-28.",
    ),
    sources: [
      { label: t("Лицензия АВС-4 в Казахстане: от 330 000 ₸", "АВС-4 licence in Kazakhstan: from ₸330,000"), url: "https://pro.cad.kz/abc4" },
      { label: t("Курсы по сметному делу в АВС — около 60 000 ₸", "Estimating courses for АВС — about ₸60,000"), url: "https://asdpro.kz/p47750389-kursy-avs-smetnye.html" },
    ],
  },
  {
    module: "qmedia",
    title: t("QMedia — музыка и видео пользователя", "QMedia — user music and video"),
    rivals: ["Spotify", "YouTube"],
    headline: t(
      "Сравнивать пока не с чем: модуль не хранит данные между передеплоями. Ставим строку не ради галочки, а чтобы это было видно.",
      "There is nothing to compare yet: the module keeps no data between redeploys. The row is here so that this is visible, not to tick a box.",
    ),
    verdict: "they-stronger",
    strengths: [
      t(
        "Ничего, что стоило бы предъявить против Spotify или YouTube. Честнее так, чем придумывать преимущество.",
        "Nothing worth setting against Spotify or YouTube. Saying so is more honest than inventing an advantage.",
      ),
    ],
    weaknesses: [
      t(
        "Модуль создаёт четыре таблицы Postgres и ни разу к ним не обращается: 31 ручка, 0 запросов к базе. Треки, плейлисты и лайки живут в памяти процесса и стираются при каждом передеплое.",
        "The module creates four Postgres tables and never queries them: 31 endpoints, 0 database calls. Tracks, playlists and likes live in process memory and are wiped on every redeploy.",
      ),
      t(
        "Нет ни каталога прав, ни лицензий с правообладателями — то есть законно раздавать чужую музыку нельзя в принципе.",
        "There is no rights catalogue and no licences with rightsholders — so distributing other people's music legally is impossible in principle.",
      ),
    ],
    measured: t(
      "Счётчик по коду 28.07.2026: 31 обращение к роутеру, 0 совпадений `pool.query`/`prisma.`. Найдено при пересверке июльского аудита 27.07.2026, `/health` исправлен и больше не выдаёт память за базу.",
      "Code count on 2026-07-28: 31 router endpoints, 0 matches for `pool.query`/`prisma.`. Found while re-checking the July audit on 2026-07-27; `/health` has been fixed and no longer passes memory off as a database.",
    ),
    sources: [],
    // Про Spotify и YouTube здесь не утверждается ничего фактического: все
    // цифры в строке — наши собственные.
    noRivalClaims: true,
  },
];

/**
 * Модули, у которых аналог очевиден, но сравнения по фактам мы НЕ делали.
 * Список нужен затем же, зачем колонка «где мы слабее»: показать границу
 * проверенного. Пустая строка в таблице лучше выдуманной.
 */
export const NOT_COMPARED: { module: string; rivals: string }[] = [
  { module: "qlearn", rivals: "Teachable, Udemy" },
  { module: "qskyway", rivals: "Aloft, AirMap" },
  { module: "veilnetx", rivals: "Blacklight, Privacy Badger" },
  { module: "startup-exchange", rivals: "AngelList, Republic" },
  { module: "qnews", rivals: "Feedly, Google News" },
];
