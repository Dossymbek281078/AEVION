/**
 * Competitive landscape — what AEVION modules are actually up against.
 *
 * The rule this file exists to enforce: a comparison that wins every row is a
 * comparison nobody believes. An investor who opens a competitor's pricing page
 * and finds we described it wrong stops reading the rest.
 *
 * So the schema is asymmetric on purpose:
 *
 *  - OUR side carries `measured` — how the number was obtained. If it did not
 *    come from a run, a dashboard or a checked-in harness, it does not go here.
 *  - THEIR side carries `source` — a URL. A competitor claim without one has to
 *    be marked `unverified`, and the UI shows that mark to the reader.
 *  - `verdict` may be "theirs". Rows where a competitor is simply better are
 *    the rows that make the rest credible.
 *  - `different-jobs` is used where the comparison is a category error, which
 *    is more often than a pitch deck likes to admit.
 *
 * Modules with no researched landscape are listed in PENDING rather than given
 * an invented one.
 */

export type CompetitorCell = {
  value: string;
  /** URL backing this claim. Required unless `unverified` is set. */
  source?: string;
  /** Set when the claim could not be checked against a primary source. */
  unverified?: true;
};

export type ComparisonRow = {
  /** What is being compared. */
  axis: string;
  /** Why a buyer should care — an axis nobody buys on is filler. */
  why: string;
  ours: {
    value: string;
    /** How we know. Empty means the claim is qualitative, not a number. */
    measured?: string;
  };
  /** Keyed by competitor id. */
  theirs: Record<string, CompetitorCell>;
  verdict: "ours" | "theirs" | "different-jobs";
};

export type Competitor = { id: string; name: string; url: string };

export type Landscape = {
  moduleId: string;
  module: string;
  category: string;
  /** The sentence that stops the table being a lie by omission. */
  framing: string;
  competitors: Competitor[];
  rows: ComparisonRow[];
  /** ISO date the competitor claims were checked. */
  researchedAt: string;
};

// ── QVenture ───────────────────────────────────────────────────────────────

const QVENTURE: Landscape = {
  moduleId: "qventure",
  module: "QVenture",
  category: "Оценка инвестиционных заявок",
  framing:
    "PitchBook и Harmonic — не конкуренты в той же категории. Они ищут компании: у PitchBook около 3 млн профилей, у Harmonic — 35 млн. У QVenture ноль. Мы решаем следующую задачу: прочитать конкретный план или отчётность и объяснить оценку по пунктам. Сравнивать нас по охвату базы бессмысленно, сравнивать по объяснимости оценки — осмысленно.",
  competitors: [
    { id: "pitchbook", name: "PitchBook", url: "https://pitchbook.com" },
    { id: "harmonic", name: "Harmonic.ai", url: "https://harmonic.ai" },
    { id: "specter", name: "Specter", url: "https://www.tryspecter.com" },
  ],
  researchedAt: "2026-07-28",
  rows: [
    {
      axis: "База компаний для поиска сделок",
      why: "Если задача — найти, кого смотреть, размер базы решает всё.",
      ours: { value: "Нет базы. Модуль не ищет компании." },
      theirs: {
        pitchbook: {
          value: "~3 млн компаний",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        harmonic: {
          value: "35 млн компаний, 195 млн людей",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        specter: {
          value: "Сигналы роста: трафик, найм, продукт",
          source: "https://www.vcbacked.co/blog/best-vc-deal-sourcing-platforms",
        },
      },
      verdict: "theirs",
    },
    {
      axis: "Как получается оценка",
      why: "Оценку, которую нельзя разобрать по пунктам, нельзя защитить перед инвесткомитетом.",
      ours: {
        value:
          "Детерминированная рубрика: 8 факторов с весами, каждый с пометкой «из плана» или «отраслевое среднее». Числа не приходят от языковой модели.",
        measured: "src/lib/qventure/engine.ts, версия рубрики v6; 1140 тестов",
      },
      theirs: {
        pitchbook: {
          value: "В 2025 добавлен ИИ-поиск на естественном языке; открытой рубрики оценки не публикует",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        harmonic: {
          value: "ИИ-агент Scout: поиск и скоринг роста; методика скора не опубликована",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        specter: { value: "Скоринг по сигналам роста", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Чтение поданной отчётности",
      why: "Инвестор чаще получает документ, чем строку в базе. Цифру из документа надо прочитать верно.",
      ours: {
        value:
          "100 цифр из 32 реальных подач в SEC (S-1, 20-F, 6-K) — прочитаны все. 31 валюта, включая рупии, тенге, лиры.",
        measured: "scripts/qventure-disclosed.ts, прогон 28.07.2026",
      },
      theirs: {
        pitchbook: { value: "Данные из подач вносятся в профиль компании; парсер произвольного документа не заявлен", unverified: true },
        harmonic: { value: "Не заявлен разбор загруженного документа", unverified: true },
        specter: { value: "Не заявлен разбор загруженного документа", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Что делает с недостающими данными",
      why: "Молчаливая подстановка отраслевого среднего вместо цифры плана — самый дорогой класс ошибок.",
      ours: {
        value:
          "Показывает долю оценки, подкреплённую цифрами плана (у пустого плана — 0%), и называет каждое допущение отдельной строкой.",
        measured: "поле signalCoverage; список assumptions на странице результата",
      },
      theirs: {
        pitchbook: { value: "Не проверено", unverified: true },
        harmonic: { value: "Не проверено", unverified: true },
        specter: { value: "Не проверено", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Цена входа",
      why: "Определяет, кому инструмент вообще доступен.",
      ours: { value: "Внутри платформы AEVION; отдельной подписки нет" },
      theirs: {
        pitchbook: {
          value: "от ~$20 000/год за одно место",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        harmonic: {
          value: "от ~$12 000/год, до $50 000",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        specter: { value: "Средний сегмент", source: "https://www.vcbacked.co/blog/best-vc-deal-sourcing-platforms" },
      },
      verdict: "different-jobs",
    },
    {
      axis: "Предсказание успеха",
      why: "Здесь принято обещать больше, чем кто-либо умеет.",
      ours: {
        value:
          "Не предсказываем. На корпусе с известными исходами разделение всего 6.6 балла, и 8 провалов из 15 набирают больше слабейшего успеха — это записано в документации как ограничение.",
        measured: "docs/benchmarks/qventure-rubric.md, раздел «The claim we are not willing to make»",
      },
      theirs: {
        pitchbook: { value: "Публичной метрики предсказательной силы не найдено", unverified: true },
        harmonic: { value: "Публичной метрики предсказательной силы не найдено", unverified: true },
        specter: { value: "Публичной метрики предсказательной силы не найдено", unverified: true },
      },
      verdict: "different-jobs",
    },
  ],
};

// ── DevHub ─────────────────────────────────────────────────────────────────

const DEVHUB: Landscape = {
  moduleId: "qbuild",
  module: "DevHub / QBuild",
  category: "ИИ-сборка приложений по описанию",
  framing:
    "Самая плотная категория из всех, где работает AEVION: у Lovable, Bolt и Replit годы работы и большие команды. По качеству вёрстки Lovable объективно сильнее. Наше отличие лежит не в генерации, а в том, что считается успешным деплоем.",
  competitors: [
    { id: "lovable", name: "Lovable", url: "https://lovable.dev" },
    { id: "bolt", name: "Bolt.new", url: "https://bolt.new" },
    { id: "replit", name: "Replit Agent", url: "https://replit.com" },
    { id: "v0", name: "v0", url: "https://v0.dev" },
  ],
  researchedAt: "2026-07-28",
  rows: [
    {
      axis: "Качество вёрстки из коробки",
      why: "Первое, что видит человек.",
      ours: { value: "Светлая газетная тема AEVION; отдельного замера против конкурентов нет" },
      theirs: {
        lovable: {
          value: "Признан лучшим: React + Tailwind, аккуратные отступы, адаптив",
          source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent",
        },
        bolt: {
          value: "Зависит от детальности промта; без неё — функционально, но просто",
          source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent",
        },
        replit: {
          value: "Упор на работоспособность, не на внешний вид",
          source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent",
        },
        v0: { value: "Сильна в UI, полный стек новее конкурентов", source: "https://altar.io/lovable-vs-bolt-vs-v0-vs-replit-vs-base44/" },
      },
      verdict: "theirs",
    },
    {
      axis: "Что считается успешным деплоем",
      why: "Деплой, отмеченный «успешным», но отдающий 500, дороже упавшего: о нём никто не узнаёт.",
      ours: {
        value:
          "Ни один путь не помечает деплой живым, пока URL реально не отдал 2xx — 5 попыток по 5 секунд, иначе статус failed с причиной в логе сборки.",
        measured: "verifyDeploymentServes() в src/routes/devhub.ts; правило в CLAUDE.md проекта",
      },
      theirs: {
        lovable: { value: "Не проверено", unverified: true },
        bolt: { value: "Не проверено", unverified: true },
        replit: { value: "Не проверено", unverified: true },
        v0: { value: "Не проверено", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Настоящий бэкенд",
      why: "Без сервера, БД и фоновых задач получается витрина, а не продукт.",
      ours: { value: "Express + Prisma + PostgreSQL внутри платформы" },
      theirs: {
        replit: {
          value: "Python, Node, Go; PostgreSQL из коробки; cron, воркеры, WebSocket",
          source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent",
        },
        lovable: { value: "Аутентификация, БД, платежи по описанию", source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent" },
        bolt: { value: "Быстрое демо", source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent" },
        v0: { value: "Полный стек есть, но обкатан меньше", source: "https://altar.io/lovable-vs-bolt-vs-v0-vs-replit-vs-base44/" },
      },
      verdict: "theirs",
    },
    {
      axis: "Цена",
      why: "",
      ours: { value: "Внутри платформы AEVION" },
      theirs: {
        lovable: { value: "$20/мес", source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent" },
        bolt: { value: "$20/мес, команда $50/мес фиксировано", source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent" },
        replit: { value: "$25/мес с хостингом; Pro ~$100/мес", source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent" },
        v0: { value: "Не проверено", unverified: true },
      },
      verdict: "theirs",
    },
  ],
};

// ── CyberChess ─────────────────────────────────────────────────────────────

const CYBERCHESS: Landscape = {
  moduleId: "cyberchess",
  module: "CyberChess",
  category: "Шахматная платформа",
  framing:
    "Здесь мы уступаем по всему, что измеряется масштабом, и это надо говорить первым. У Chess.com 150 млн аккаунтов, у Lichess 4 млн пазлов против наших 500 тысяч и полностью бесплатный движок без ограничений. Единственное, где мы можем отличаться, — разбор партии тренером-ИИ, который у Chess.com платный, а у Lichess его нет.",
  competitors: [
    { id: "chesscom", name: "Chess.com", url: "https://www.chess.com" },
    { id: "lichess", name: "Lichess", url: "https://lichess.org" },
  ],
  researchedAt: "2026-07-28",
  rows: [
    {
      axis: "Размер аудитории",
      why: "Определяет, найдётся ли соперник вашего уровня в любую минуту.",
      ours: { value: "Малая, внутри платформы" },
      theirs: {
        chesscom: { value: "150+ млн аккаунтов", source: "https://cassandrachess.com/learn/chess-com-alternatives" },
        lichess: { value: "Крупная, открытая", source: "https://chess.lc/blog/lichess-vs-chess-com" },
      },
      verdict: "theirs",
    },
    {
      axis: "Пул задач",
      why: "Основа ежедневной тренировки.",
      ours: {
        value: "500 000 позиций из открытого дампа Lichess (CC0)",
        measured: "PR #636, прод",
      },
      theirs: {
        lichess: { value: "4+ млн позиций, крупнейшая открытая база", source: "https://oldschoolchess.com/compare/chess-com-vs-lichess" },
        chesscom: { value: "Бесплатно около 5 задач в день", source: "https://oldschoolchess.com/compare/chess-com-vs-lichess" },
      },
      verdict: "theirs",
    },
    {
      axis: "Анализ движком",
      why: "Без разбора партии тренировка не превращается в рост.",
      ours: { value: "Есть, без платной стены" },
      theirs: {
        lichess: { value: "Stockfish на полную глубину, бесплатно и без лимита", source: "https://oldschoolchess.com/compare/chess-com-vs-lichess" },
        chesscom: { value: "Глубокий анализ — в Diamond, $29/мес или $119/год", source: "https://oldschoolchess.com/compare/chess-com-vs-lichess" },
      },
      verdict: "theirs",
    },
    {
      axis: "Разбор партии тренером-ИИ",
      why: "Движок говорит, где ошибка. Тренер объясняет, почему вы её сделали.",
      ours: {
        value: "Пост-матчевый разбор, адаптирующийся под уровень игрока; в бесплатном доступе",
        measured: "PR #643, #657, #664",
      },
      theirs: {
        chesscom: { value: "Обучающий контент в основном за платной подпиской", source: "https://cassandrachess.com/learn/chess-com-alternatives" },
        lichess: { value: "Тренера на языковой модели не заявлено", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Цена",
      why: "",
      ours: { value: "Внутри платформы AEVION" },
      theirs: {
        lichess: { value: "Всё бесплатно, без рекламы", source: "https://oldschoolchess.com/compare/chess-com-vs-lichess" },
        chesscom: { value: "Diamond $29/мес", source: "https://oldschoolchess.com/compare/chess-com-vs-lichess" },
      },
      verdict: "theirs",
    },
  ],
};

// ── Смета-тренажёр ─────────────────────────────────────────────────────────

const SMETA: Landscape = {
  moduleId: "smeta-trainer",
  module: "Смета-тренажёр РК",
  category: "Обучение сметному делу",
  framing:
    "АВС-4, Смета РК и Сана — это рабочие программы для составления смет, и мы с ними не конкурируем. Наш модуль учит методике на узком учебном корпусе: студент тренирует руку на типовых ошибках, а не сдаёт по нему реальную смету на бюджетный объект. Ближайший аналог — не программа, а курс сметчика.",
  competitors: [
    { id: "kursy", name: "Курсы сметчиков РК", url: "https://upgrade-uk.kz/kursy/kursy-po-tekhnicheskim-napravleniyam/polzovatel-programmy-abc-4" },
    { id: "abc4", name: "АВС-4 / АВС-KZ", url: "https://cad.kz/catalog/avs/the_software_package_avs_4/" },
  ],
  researchedAt: "2026-07-28",
  rows: [
    {
      axis: "Что это вообще",
      why: "Половина сравнений в этой нише — категориальная ошибка.",
      ours: { value: "Тренажёр: учебные объекты, ВОР, дефектные акты, разбор ошибок" },
      theirs: {
        abc4: {
          value: "Рабочая программа для сметной и ресурсной документации",
          source: "https://cad.kz/catalog/avs/the_software_package_avs_4/",
        },
        kursy: { value: "Очные и онлайн-курсы по АВС-4, SANA, ресурсному методу", source: "https://upgrade-uk.kz/kursy/kursy-po-tekhnicheskim-napravleniyam/polzovatel-programmy-abc-4" },
      },
      verdict: "different-jobs",
    },
    {
      axis: "Цена обучения одного человека",
      why: "Определяет, кому доступно войти в профессию.",
      ours: { value: "Внутри платформы AEVION" },
      theirs: {
        kursy: {
          value: "Курсы 90 000–130 000 ₸; индивидуально по АВС-4 — 70 000 ₸; онлайн 30 000–60 000 ₸",
          source: "https://upgrade-uk.kz/kursy/kursy-po-tekhnicheskim-napravleniyam/polzovatel-programmy-abc-4",
        },
        abc4: { value: "Лицензия + сопровождение 12 месяцев", source: "https://pro.cad.kz/abc4" },
      },
      verdict: "ours",
    },
    {
      axis: "Обратная связь по ошибке",
      why: "Курс объясняет один раз; тренажёр ловит ошибку в момент, когда её делают.",
      ours: { value: "ИИ-советник на типовых ошибках: непосчитанные проёмы, двойной счёт, забытый коэффициент" },
      theirs: {
        kursy: { value: "Разбор преподавателем в рамках курса", unverified: true },
        abc4: { value: "Программа считает, но не учит", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Пригодность для реальной сметы на бюджетный объект",
      why: "Здесь важно не обещать лишнего: допуск к бюджетным объектам — вопрос реестра, а не качества.",
      ours: { value: "Не предназначен. В реестр допущенных средств не входит и не подаётся." },
      theirs: {
        abc4: { value: "Профессиональный комплекс для участников инвестиционного процесса", source: "https://cad.kz/catalog/avs/the_software_package_avs_4/" },
        kursy: { value: "—", unverified: true },
      },
      verdict: "theirs",
    },
  ],
};

// ── QReal Studio ───────────────────────────────────────────────────────────

/**
 * The awkward landscape, and the reason it is written last.
 *
 * Higgsfield is not our competitor — it is our engine. `projects.ts` says so:
 * the pipeline ends in "движок (Higgsfield/Veo)". Everything we add sits above
 * someone else's model, so any row about generation quality is a row about
 * their model, not ours.
 *
 * There is also a standing instruction on this: no claim that QReal beats
 * Higgsfield until a measurable benchmark exists (ten briefs, blind QC scoring).
 * That benchmark has not been run. So the one row we would like to win says
 * "замера нет" in the measured field, which is the only honest thing to put
 * there, and the marking row goes to Google outright.
 */
const QREAL: Landscape = {
  moduleId: "qreal",
  module: "QReal Studio",
  category: "ИИ-видео",
  framing:
    "Higgsfield и Veo — это наш движок, а не конкурент: генерирует кадр их модель. Наш слой — раскадровка по брифу, директивы реализма в промтах, QC-петля из 14 критериев с авто-перегенерацией и обязательная ИИ-маркировка каждого кадра. Поэтому строки про качество генерации выиграть нельзя — это чужая модель. Строку про маркировку мы тоже проигрываем Google, и ниже сказано почему. Цены конкурентов взяты из сторонних обзоров, а не с их собственных страниц, — они помечены соответственно.",
  competitors: [
    { id: "higgsfield", name: "Higgsfield", url: "https://higgsfield.ai" },
    { id: "runway", name: "Runway", url: "https://runwayml.com" },
    { id: "veo", name: "Google Veo", url: "https://deepmind.google/models/veo/" },
  ],
  researchedAt: "2026-07-28",
  rows: [
    {
      axis: "Своя модель генерации",
      why: "Кто владеет моделью, тот определяет качество, цену и доступность. Всё остальное — надстройка.",
      ours: { value: "Своей модели нет. Кадр генерирует Higgsfield или Veo — мы их вызываем." },
      theirs: {
        higgsfield: {
          value: "Агрегирует 15+ моделей под одной подпиской: Sora 2, Veo 3.1, Kling 3.0, Seedance 2.0",
          source: "https://higgsfield.ai/blog/higgsfield-vs-runway-2026",
        },
        runway: {
          value: "Собственные кинематографические модели плюс лицензированные интеграции",
          source: "https://higgsfield.ai/blog/higgsfield-vs-runway-2026",
        },
        veo: { value: "Собственная модель Google DeepMind", source: "https://deepmind.google/models/veo/" },
      },
      verdict: "theirs",
    },
    {
      axis: "Машиночитаемая ИИ-маркировка, переживающая перекодирование",
      why: "Ст. 50 EU AI Act требует машиночитаемой пометки синтетического контента с 2 августа 2026; для систем, уже бывших на рынке, срок сдвинут на 2 декабря 2026.",
      ours: {
        value:
          "Манифест в стиле C2PA плюс sha256 на каждом кадре. Честное ограничение: такие манифесты снимаются простым перекодированием и выгрузкой в соцсеть — против стойкого водяного знака это слабее.",
        measured: "неотключаемая маркировка в пайплайне /api/qreal; стойкость к перекодированию не замерялась",
      },
      theirs: {
        higgsfield: { value: "Собственной схемы маркировки не заявлено; наследует пометки моделей под капотом", unverified: true },
        runway: { value: "Отдельные детекторы читают C2PA у Runway-видео; своей публичной схемы не нашли", source: "https://www.eyesift.com/video-analysis/", unverified: true },
        veo: {
          value: "SynthID — невидимый знак, встроенный в саму модель; переживает перекомпрессию и скриншот",
          source: "https://internet-pros.com/blog/ai-content-provenance-watermarking-c2pa-2026/",
        },
      },
      verdict: "theirs",
    },
    {
      axis: "Автоматическая отбраковка неудачных кадров",
      why: "В ИИ-видео брак — норма, а не исключение: руки, моргание, склейки. Вопрос в том, кто его ловит — машина или человек.",
      ours: {
        value:
          "QC-петля из 14 взвешенных критериев реализма (микромимика, моргание, SSS кожи, руки, room tone) с авто-перегенерацией кадра.",
        measured: "🔴 замера нет. Слепого сравнения с ручной отбраковкой не проводили, и до него утверждать превосходство нельзя.",
      },
      theirs: {
        higgsfield: { value: "Слой консистентности по платформе; автоматической отбраковки по критериям не заявлено", source: "https://higgsfield.ai/blog/higgsfield-vs-runway-2026", unverified: true },
        runway: { value: "Сильная среда монтажа — отбор кадров делает человек", source: "https://higgsfield.ai/blog/higgsfield-vs-runway-2026", unverified: true },
        veo: { value: "Отбраковки на стороне модели не заявлено", unverified: true },
      },
      verdict: "different-jobs",
    },
    {
      axis: "Цена входа",
      why: "При покадровой оплате цена решает, сколько дублей можно себе позволить, — а дублей нужно много.",
      ours: { value: "Внутри платформы AEVION; сверху ложится стоимость кадров у движка" },
      theirs: {
        higgsfield: {
          value: "$15 / $39 / $99 в месяц при годовой оплате",
          source: "https://www.gstory.ai/blog/higgsfield-ai/",
          unverified: true,
        },
        runway: {
          value: "Бесплатный тариф со 125 разовыми кредитами",
          source: "https://higgsfield.ai/blog/higgsfield-vs-runway-2026",
          unverified: true,
        },
        veo: { value: "Через подписку Google и API", unverified: true },
      },
      verdict: "theirs",
    },
    {
      axis: "Путь от брифа до готового ролика",
      why: "Одно дело — выдать красивый кадр, другое — собрать из брифа связную сцену со звуком.",
      ours: {
        value:
          "Один бриф → ИИ-раскадровка → промты с директивами реализма (24 fps, 180° затвор, фоли, room tone) → движок → QC → сборка. Люди, дети, животные, природа и звук без съёмки и без референс-видео.",
        measured: "демо «Утро в степи», /api/qreal",
      },
      theirs: {
        higgsfield: { value: "Есть студийные воркфлоу под шортсы и рекламу", source: "https://higgsfield.ai/blog/higgsfield-vs-runway-2026" },
        runway: { value: "Среда монтажа, сборку ведёт человек", source: "https://higgsfield.ai/blog/higgsfield-vs-runway-2026", unverified: true },
        veo: { value: "Модель отдаёт клип; раскадровки и сборки нет", unverified: true },
      },
      verdict: "ours",
    },
  ],
};

// ── QSkyway ────────────────────────────────────────────────────────────────

/**
 * Two competitors rather than three, on purpose.
 *
 * The research surfaced a strong claim about one company's solvency. It is not
 * in the table: an unsourced negative claim about a live business is the single
 * most damaging cell this file could carry, and being right about it would not
 * make it safe. Everything below is what a company says about itself on its own
 * pages, or what a regulator publishes.
 */
const QSKYWAY: Landscape = {
  moduleId: "qskyway",
  module: "QSkyway",
  category: "Городские воздушные коридоры",
  framing:
    "Altitude Angel и Aloft обслуживают малые беспилотники: разрешение на полёт, данные о воздушном пространстве, охват сотен стран. Мы делаем другое и в трёх городах: прокладываем коридор для аэротакси поверх трёхмерного двойника города и выдаём подписанный документ-обоснование для регулятора. По охвату мы проигрываем на два порядка, и это первое, что надо сказать. Отдельно: мы не сертифицированное авиационное ПО и им не притворяемся.",
  competitors: [
    { id: "altitude", name: "Altitude Angel", url: "https://www.altitudeangel.com/" },
    { id: "aloft", name: "Aloft", url: "https://www.aloft.ai/" },
  ],
  researchedAt: "2026-07-28",
  rows: [
    {
      axis: "Охват воздушного пространства",
      why: "Оператору нужен город, в котором он летает. Инструмент на три города бесполезен в четвёртом.",
      ours: { value: "Три города: Астана, Нью-Йорк, Токио.", measured: "твины из OpenStreetMap, /api/qskyway" },
      theirs: {
        altitude: {
          value: "Данные по воздушному пространству и наземным опасностям более чем в 155 странах через один интерфейс",
          source: "https://www.altitudeangel.com/solutions/guardianutm-cloud",
        },
        aloft: { value: "Поставщик LAANC в США; авторизация полётов в контролируемом пространстве", unverified: true },
      },
      verdict: "theirs",
    },
    {
      axis: "Для какого аппарата",
      why: "Правила для малого дрона и для аэротакси с людьми на борту — разные документы и разные ведомства.",
      ours: { value: "Аэротакси: коридоры с высотными полосами выше застройки, вертипорты, 4D-слоты." },
      theirs: {
        altitude: {
          value: "Управление трафиком беспилотников (UTM)",
          source: "https://www.altitudeangel.com/solutions/guardianutm-cloud",
        },
        aloft: { value: "Малые БВС по Part 107", unverified: true },
      },
      verdict: "different-jobs",
    },
    {
      axis: "Откуда берётся ограничение полёта",
      why: "Правило опубликовано в разной форме — фидом, растром, нормативным текстом. Инструмент, читающий только API, не увидит два из трёх.",
      ours: {
        value:
          "Из того, в чём правило опубликовано: сетка потолков FAA UASFM для Нью-Йорка, режим разрешений MLIT/JCAB для Токио, зона UAP28 из AIP Казахстана для Астаны. По Астане модуль прямо говорит, что полёты запрещены, а не согласуются.",
        measured: "три источника подписаны Ed25519, привязка к Bitcoin через OpenTimestamps, сверка с фидом каждые 12 ч",
      },
      theirs: {
        altitude: {
          value: "Более 100 категорий постоянных и временных ограничений, более 80 категорий наземных опасностей",
          source: "https://www.altitudeangel.com/solutions/guardianutm-cloud",
        },
        aloft: { value: "Данные FAA для авторизации LAANC", unverified: true },
      },
      verdict: "different-jobs",
    },
    {
      axis: "Что остаётся на руках после расчёта маршрута",
      why: "Регулятору нужен документ, который можно проверить через год, а не картинка в интерфейсе.",
      ours: {
        value:
          "Подписанный документ-обоснование маршрута: какое правило применено, из какого источника, с каким хешем и отметкой времени.",
        measured: "Ed25519-подпись твина + SHA-256 receipt на слот QRight",
      },
      theirs: {
        altitude: { value: "Одобрения и данные через API; отдельного подписанного обоснования не заявлено", unverified: true },
        aloft: { value: "Подтверждение авторизации LAANC", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Сертификация",
      why: "Летать по решению несертифицированного софта нельзя. Это граница между демонстрацией и продуктом.",
      ours: {
        value:
          "Не сертифицированное авиационное ПО, доказательство концепции. Точечные запретные зоны и рост ветра с высотой пока иллюстративны — это записано в описании модуля, а не спрятано.",
      },
      theirs: {
        altitude: { value: "Работает как поставщик услуг UTM в рамках национальных программ", unverified: true },
        aloft: {
          value: "Аэротакси регулируются FAA отдельным порядком — Advanced Air Mobility",
          source: "https://www.faa.gov/air-taxis",
        },
      },
      verdict: "theirs",
    },
  ],
};

export const LANDSCAPES: Landscape[] = [QVENTURE, DEVHUB, CYBERCHESS, SMETA, QREAL, QSKYWAY];

/**
 * Modules with obvious analogues that have NOT been researched yet.
 *
 * Listed rather than compared. An empty row is honest; an invented one is not,
 * and this list is what stops the table quietly implying the rest were checked.
 */
export const PENDING: Array<{ module: string; category: string; analogues: string[] }> = [
  { module: "QSign / IP Bureau", category: "Фиксация авторства", analogues: ["OriginStamp", "Bernstein", "OpenTimestamps"] },
  { module: "StartupX", category: "Биржа стартапов", analogues: ["AngelList", "Republic", "SeedInvest"] },
  { module: "QTrade", category: "Торговый симулятор", analogues: ["TradingView Paper", "Thinkorswim paperMoney"] },
  { module: "QCoreAI", category: "Мультиагентный совет", analogues: ["CrewAI", "AutoGen", "LangGraph"] },
];

/** Counts for the section header — derived, never typed in. */
export const LANDSCAPE_STATS = {
  researched: LANDSCAPES.length,
  pending: PENDING.length,
  rows: LANDSCAPES.reduce((n, l) => n + l.rows.length, 0),
  rowsWhereTheyWin: LANDSCAPES.reduce((n, l) => n + l.rows.filter((r) => r.verdict === "theirs").length, 0),
  sourcedClaims: LANDSCAPES.reduce(
    (n, l) => n + l.rows.reduce((m, r) => m + Object.values(r.theirs).filter((c) => c.source).length, 0),
    0,
  ),
  unverifiedClaims: LANDSCAPES.reduce(
    (n, l) => n + l.rows.reduce((m, r) => m + Object.values(r.theirs).filter((c) => c.unverified).length, 0),
    0,
  ),
};
