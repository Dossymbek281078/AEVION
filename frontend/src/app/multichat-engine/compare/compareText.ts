// Тексты SEO-страницы «ChatGPT vs Claude vs Gemini» (/multichat-engine/compare и /en, /kk).
// Зачем: люди из поиска сравнения моделей → 2 бесплатных вопроса консилиуму → касса «Планеты».
// Только то, что делает наш продукт (проверено по коду CouncilConsole.tsx и замерам прода 30–31.10.2026):
//  • совет из трёх агентов, у каждого свой ОСНОВНОЙ поставщик: Anthropic (Claude), Google (Gemini), открытая модель
//    через OpenRouter; при сбое агент уходит к запасному, в карточке ответа видно, кто ответил. Замер 31.10
//    (conv_0c124498…): Скептик ответил через Claude — Gemini был недоступен, поэтому «всегда три разных» не пишем;
//  • ChatGPT (OpenAI) в совете НЕТ — так и пишем, не выдаём чужое за своё;
//  • разногласия: прямые противоречия, расхождения в числах, кто стоит особняком, «что проверить»;
//  • чек ответа (RFC 8785 + SHA-256) с подписью Ed25519 (замер 31.10: kid qsign-ed25519-v1) и страница /multichat-engine/verify;
//  • 2 бесплатных вопроса в день без входа, дальше вход по почте; полный доступ — подписка «AEVION Планета».
// Ни одной оценки «какая модель лучше» и ни одного числа о качестве моделей.

export type Yazyk = "ru" | "en" | "kk";

export type CompareText = {
  h1: string;
  lead: string;
  honest: string;
  methodTitle: string;
  method: string[];
  howTitle: string;
  how: string[];
  examplesTitle: string;
  examplesLead: string;
  examples: { q: string; look: string }[];
  askThis: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  cta: string;
  ctaNote: string;
  pricing: string;
};

export const COMPARE_TEXT: Record<Yazyk, CompareText> = {
  en: {
    h1: "ChatGPT vs Claude vs Gemini: how to ask several AIs at once and compare the answers",
    lead: "Asking one chatbot gives you one confident answer. Asking several models the same question shows you where they disagree — and that is exactly the part you should check before you act.",
    honest: "In AEVION Multichat a council of three agents answers your question. Their main providers are Claude (Anthropic), Gemini (Google) and an open model via OpenRouter; if one is unavailable, the agent switches to a spare, and the answer card shows who replied. ChatGPT is not part of the council today. The method below works with any set of models.",
    methodTitle: "How to compare AI answers properly",
    method: [
      "Ask every model the same question, word for word. A different wording gives you a different question, not a second opinion.",
      "Let the models answer independently. If one sees the other's answer first, you get agreement, not a check.",
      "Read the disagreements first: a direct contradiction, different numbers, one answer far from the rest.",
      "Check the disputed points against a source you trust. Where all models agree, you still verify — but you start where they don't.",
    ],
    howTitle: "How it works in AEVION Multichat",
    how: [
      "You type one question. Three agents with different roles — Analyst, Skeptic, Practitioner — answer it independently, each through its own model provider.",
      "If a provider fails, the agent switches to a spare one, and the answer card shows which provider actually replied.",
      "The server compares the answers: direct contradictions, number mismatches, the answer that stands apart, and a list of what to check — ordered from what you can settle in a minute.",
      "Every answer comes with a receipt signed with Ed25519 (RFC 8785 canonicalization, SHA-256 digest). On the verify page anyone can recompute the hash and see that the text was not changed.",
    ],
    examplesTitle: "Three questions to try",
    examplesLead: "Open one of them in Multichat — the question is already filled in, you only press the button.",
    examples: [
      { q: "Should a two-person startup hire a salesperson before or after the first paying customer?", look: "Watch whether the agents agree on the order of steps or only on the wording." },
      { q: "Our landing page converts 1% of visitors. Which three things should we test first, and why?", look: "Look at which advice appears in only one answer — that is the one to question." },
      { q: "Is it worth moving a small Node.js API from Express to Fastify? Give arguments for and against.", look: "Compare the numbers: if the agents quote different speed gains, check the source before you believe any of them." },
    ],
    askThis: "Ask this in Multichat →",
    faqTitle: "Questions and answers",
    faq: [
      { q: "Is it free?", a: "Without signing in you get 2 free questions a day. After that you sign in by email and continue. Full access is part of the AEVION Planet subscription — prices are on the pricing page." },
      { q: "Which models answer?", a: "Each agent has a main provider: Anthropic (Claude), Google (Gemini) or an open model via OpenRouter. If a provider is down, the agent switches to a spare one. Each answer card shows which provider actually replied." },
      { q: "Is ChatGPT included?", a: "No, not today. We name the providers that actually answer instead of listing every popular model." },
      { q: "Will it tell me which AI is best?", a: "No. Multichat does not rank models. It shows where the answers agree and where they diverge, so you know what to check." },
      { q: "How do I know the answer was not edited later?", a: "Download the signed receipt and open the verify page: it recomputes the SHA-256 hash of the answer and checks the signature. The specification is open." },
    ],
    cta: "Ask the council for free →",
    ctaNote: "2 free questions a day without signing in.",
    pricing: "Pricing",
  },
  ru: {
    h1: "ChatGPT, Claude или Gemini: как спросить несколько нейросетей сразу и сравнить ответы",
    lead: "Один чат-бот даёт один уверенный ответ. Если задать тот же вопрос нескольким моделям, видно, где они расходятся, — именно это и нужно проверить, прежде чем действовать.",
    honest: "В Мультичате AEVION на вопрос отвечает совет из трёх агентов. Их основные поставщики — Claude (Anthropic), Gemini (Google) и открытая модель через OpenRouter; если поставщик недоступен, агент переходит на запасного, и в карточке ответа видно, кто ответил. ChatGPT сейчас в совет не входит. Способ ниже подходит для любого набора моделей.",
    methodTitle: "Как правильно сравнивать ответы нейросетей",
    method: [
      "Задайте всем моделям один и тот же вопрос, слово в слово. Другая формулировка — это другой вопрос, а не второе мнение.",
      "Пусть модели отвечают независимо. Если одна видит ответ другой, вы получаете согласие, а не проверку.",
      "Сначала читайте расхождения: прямое противоречие, разные числа, ответ, далёкий от остальных.",
      "Спорные места сверяйте с источником, которому доверяете. Где модели согласны, тоже проверяйте, но начинайте с того, где нет.",
    ],
    howTitle: "Как это устроено в Мультичате AEVION",
    how: [
      "Вы пишете один вопрос. Три агента с разными ролями — Аналитик, Скептик, Практик — отвечают на него независимо, каждый через своего поставщика модели.",
      "Если поставщик не ответил, агент переходит на запасного, и в карточке ответа видно, кто ответил на самом деле.",
      "Сервер сравнивает ответы: прямые противоречия, расхождения в числах, ответ, который стоит особняком, и список «что проверить» — сверху то, что закрывается за минуту.",
      "К каждому ответу выдаётся чек с подписью Ed25519 (канонизация RFC 8785, дайджест SHA-256). На странице проверки любой может пересчитать хеш и убедиться, что текст не меняли.",
    ],
    examplesTitle: "Три вопроса, чтобы попробовать",
    examplesLead: "Откройте любой в Мультичате — вопрос уже вписан, остаётся нажать кнопку.",
    examples: [
      { q: "Нанимать продавца в стартап из двух человек до первого платящего клиента или после?", look: "Смотрите, согласны ли агенты в порядке шагов или только в словах." },
      { q: "Наша посадочная страница превращает в заявки 1% посетителей. Какие три вещи проверить первыми и почему?", look: "Обратите внимание на совет, который есть только в одном ответе, — его и стоит перепроверить." },
      { q: "Стоит ли переводить небольшой API на Node.js с Express на Fastify? Аргументы за и против.", look: "Сравните числа: если агенты называют разный прирост скорости, проверьте источник, прежде чем верить любому из них." },
    ],
    askThis: "Спросить это в Мультичате →",
    faqTitle: "Вопросы и ответы",
    faq: [
      { q: "Это бесплатно?", a: "Без входа — 2 бесплатных вопроса в день. Дальше вход по почте, и работа продолжается. Полный доступ входит в подписку «AEVION Планета» — цены на странице тарифов." },
      { q: "Какие модели отвечают?", a: "У каждого агента свой основной поставщик: Anthropic (Claude), Google (Gemini) или открытая модель через OpenRouter. Если поставщик недоступен, агент переходит на запасного. В карточке каждого ответа видно, кто ответил на самом деле." },
      { q: "ChatGPT там есть?", a: "Сейчас нет. Мы называем поставщиков, которые действительно отвечают, а не перечисляем все известные модели." },
      { q: "Мультичат скажет, какая нейросеть лучше?", a: "Нет. Мультичат не ставит моделям оценки. Он показывает, где ответы сходятся и где расходятся, чтобы вы знали, что проверить." },
      { q: "Как убедиться, что ответ потом не изменили?", a: "Скачайте подписанный чек и откройте страницу проверки: она пересчитает хеш SHA-256 ответа и проверит подпись. Спецификация открыта." },
    ],
    cta: "Спросить консилиум бесплатно →",
    ctaNote: "2 бесплатных вопроса в день без входа.",
    pricing: "Тарифы",
  },
  kk: {
    h1: "ChatGPT, Claude әлде Gemini: бірнеше нейрожеліден бірден сұрап, жауаптарды қалай салыстыруға болады",
    lead: "Бір чат-бот бір сенімді жауап береді. Бір сұрақты бірнеше модельге қойсаңыз, олардың қай жерде алшақтайтыны көрінеді — әрекет етпес бұрын дәл соны тексеру керек.",
    honest: "AEVION Мультичатында сұраққа үш агенттен тұратын кеңес жауап береді. Олардың негізгі провайдерлері — Claude (Anthropic), Gemini (Google) және OpenRouter арқылы ашық модель; провайдер қолжетімсіз болса, агент қосалқысына ауысады, ал жауап карточкасында кім жауап бергені көрінеді. ChatGPT қазір кеңеске кірмейді. Төмендегі әдіс кез келген модельдер жиынына жарайды.",
    methodTitle: "Нейрожелі жауаптарын қалай дұрыс салыстыру керек",
    method: [
      "Барлық модельге бір сұрақты сөзбе-сөз қойыңыз. Басқа тұжырым — екінші пікір емес, басқа сұрақ.",
      "Модельдер бір-бірінен тәуелсіз жауап берсін. Біреуі екіншісінің жауабын көрсе, сіз тексеру емес, келісім аласыз.",
      "Алдымен алшақтықтарды оқыңыз: тікелей қайшылық, әртүрлі сандар, басқалардан алыс жауап.",
      "Даулы тұстарды өзіңіз сенетін дереккөзбен салыстырыңыз. Модельдер келіскен жерді де тексеріңіз, бірақ келіспеген жерден бастаңыз.",
    ],
    howTitle: "AEVION Мультичатында бұл қалай жұмыс істейді",
    how: [
      "Сіз бір сұрақ жазасыз. Әртүрлі рөлдегі үш агент — Талдаушы, Күмәншіл, Практик — оған тәуелсіз жауап береді, әрқайсысы өз модель провайдері арқылы.",
      "Провайдер жауап бермесе, агент қосалқы провайдерге ауысады, ал жауап карточкасында кім шын жауап бергені көрінеді.",
      "Сервер жауаптарды салыстырады: тікелей қайшылықтар, сандардағы алшақтық, бөлек тұрған жауап және «не тексеру керек» тізімі — жоғарыда бір минутта анықталатыны.",
      "Әр жауапқа Ed25519 қолтаңбасы бар чек беріледі (RFC 8785 канонизациясы, SHA-256 дайджесі). Тексеру бетінде кез келген адам хешті қайта есептеп, мәтіннің өзгермегеніне көз жеткізе алады.",
    ],
    examplesTitle: "Байқап көруге үш сұрақ",
    examplesLead: "Кез келгенін Мультичатта ашыңыз — сұрақ жазылып тұр, тек батырманы басу қалады.",
    examples: [
      { q: "Екі адамдық стартапқа сатушыны алғашқы төлейтін клиентке дейін алу керек пе, әлде кейін бе?", look: "Агенттер қадамдар ретінде келісе ме, әлде тек сөздерде ме — соны қараңыз." },
      { q: "Біздің бет келушілердің 1%-ын өтінімге айналдырады. Алдымен қандай үш нәрсені тексеру керек және неге?", look: "Тек бір жауапта ғана бар кеңеске назар аударыңыз — соны қайта тексерген жөн." },
      { q: "Node.js-тегі шағын API-ді Express-тен Fastify-ға көшірген жөн бе? Жақтайтын және қарсы дәлелдер.", look: "Сандарды салыстырыңыз: агенттер жылдамдықтың әртүрлі өсімін атаса, кез келгеніне сенбес бұрын дереккөзді тексеріңіз." },
    ],
    askThis: "Мұны Мультичатта сұрау →",
    faqTitle: "Сұрақтар мен жауаптар",
    faq: [
      { q: "Бұл тегін бе?", a: "Кірусіз күніне 2 тегін сұрақ. Әрі қарай пошта арқылы кіресіз, жұмыс жалғасады. Толық қолжетімділік «AEVION Планета» жазылымына кіреді — бағалар тарифтер бетінде." },
      { q: "Қандай модельдер жауап береді?", a: "Әр агенттің негізгі провайдері бар: Anthropic (Claude), Google (Gemini) немесе OpenRouter арқылы ашық модель. Провайдер қолжетімсіз болса, агент қосалқысына ауысады. Әр жауап карточкасында шын жауап берген провайдер көрінеді." },
      { q: "ChatGPT бар ма?", a: "Қазір жоқ. Біз барлық белгілі модельдерді тізбелемей, шын жауап беретін провайдерлерді атаймыз." },
      { q: "Мультичат қай нейрожелі жақсы екенін айта ма?", a: "Жоқ. Мультичат модельдерге баға қоймайды. Ол жауаптардың қай жерде сәйкес келетінін және қай жерде алшақтайтынын көрсетеді, сонда не тексеру керегін білесіз." },
      { q: "Жауап кейін өзгертілмегеніне қалай көз жеткізуге болады?", a: "Қол қойылған чекті жүктеп, тексеру бетін ашыңыз: ол жауаптың SHA-256 хешін қайта есептеп, қолтаңбаны тексереді. Спецификация ашық." },
    ],
    cta: "Кеңестен тегін сұрау →",
    ctaNote: "Кірусіз күніне 2 тегін сұрақ.",
    pricing: "Тарифтер",
  },
};

/** Вход в Мультичат: язык страницы (?lang=), метка канала и, если задан, вопрос для поля (?q=). */
export function askHref(lang: Yazyk, q?: string): string {
  const params = new URLSearchParams();
  if (lang !== "ru") params.set("lang", lang);
  params.set("c", "seo-compare");
  if (q) params.set("q", q);
  return `/multichat-engine?${params.toString()}`;
}

/** Тарифы «Планеты» — туда же ведёт «Купить» посадочной Мультичата. */
export function pricingHref(lang: Yazyk): string {
  return lang === "ru" ? "/pricing?c=seo-compare#planet-buy" : `/pricing?lang=${lang}&c=seo-compare#planet-buy`;
}
