/**
 * Constitution blog — posts as typed TS structures.
 *
 * Lean alternative to MDX: posts carry plain prose + structured blocks
 * (paragraph, heading, quote, embed) that the renderer maps to React.
 * Adding a new post = appending an entry to POSTS.
 */

import type { Sliders } from "@/lib/constitution";

export type BlogBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "quote"; text: string; cite?: string }
  | { kind: "li"; items: string[] }
  | { kind: "embed-preset"; preset: string; label?: string }
  | { kind: "embed-country"; code: string }
  | { kind: "embed-sliders"; sliders: Sliders; label: string }
  | { kind: "regime"; id: string; note?: string };

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string; // ISO
  readMinutes: number;
  ogPreset?: string;
  blocks: BlogBlock[];
};

export const POSTS: BlogPost[] = [
  {
    slug: "why-norway-90-rule-of-law",
    title: "Why Norway scores 90 on rule-of-law and what that means",
    excerpt:
      "Норвежский ruleOfLaw калибруется на 90 из 100 не потому, что у них «больше законов», а потому что закон одинаково применяется к министру и к рыбаку. Что это значит для остальных параметров и почему это самая дорогая опора.",
    author: "AEVION research",
    publishedAt: "2026-05-22T09:00:00Z",
    readMinutes: 5,
    ogPreset: "Скандинавская",
    blocks: [
      { kind: "p", text: "Когда мы оцениваем страну по 8 ползункам, Норвегия получает 90 на ruleOfLaw — почти максимум. Это не означает «много законов». Это означает, что закон одинаково применяется к министру правительства и к рыбаку из деревни." },
      { kind: "embed-country", code: "no" },
      { kind: "h2", text: "Что делает закон «одинаковым»" },
      { kind: "p", text: "Три вещи: независимый суд, прозрачное расследование коррупции, презумпция применимости. Норвегия добилась всех трёх не за одно поколение, а за столетия." },
      { kind: "li", items: [
        "1814 — Конституция Эидсволла, разделение властей",
        "1880-е — введение независимой прокуратуры",
        "1969 — открытие нефти, появление Sovereign Wealth Fund с прозрачным управлением",
        "2014 — публикация всех зарплат госслужащих в открытом доступе",
      ] },
      { kind: "h2", text: "Цена" },
      { kind: "p", text: "Высокий ruleOfLaw — самая дорогая опора в смысле политических компромиссов. Олигарх не может «договориться» с прокуратурой, политик не может покрыть друга, корпорация не может купить решение суда. Когда обе стороны проигрывают по правилам, обе стороны проигрывают чаще, и обе — не катастрофически." },
      { kind: "quote", text: "Закон не любит сильных. Закон работает там, где сильные согласились его уважать.", cite: "Acemoglu & Robinson" },
      { kind: "h2", text: "Что не работает" },
      { kind: "p", text: "Высокий ruleOfLaw сам по себе не гарантирует высокий floor. Сингапур имеет ruleOfLaw 80, но floor только 65 — закон строг, но социальная защита средняя. UK имеет ruleOfLaw 80, но floor 50 — растущее неравенство несмотря на формальное равенство перед законом." },
      { kind: "p", text: "Чтобы получить «Скандинавскую модель», нужны обе опоры одновременно. Подвигайте в эмбеде ниже — увидите, как меняется регим:" },
      { kind: "embed-preset", preset: "Скандинавская", label: "Скандинавская модель (Норвегия baseline)" },
    ],
  },
  {
    slug: "magna-carta-to-open-access",
    title: "Magna Carta to Open Access in 8 charts",
    excerpt:
      "Восемь веков европейской политики через 8 ползунков. Какие именно параметры двигались на каждом историческом повороте — и почему промышленная революция оказалась важнее всех реформ предыдущих 500 лет.",
    author: "AEVION research",
    publishedAt: "2026-05-23T09:00:00Z",
    readMinutes: 7,
    ogPreset: "Open Access (идеал)",
    blocks: [
      { kind: "p", text: "Восемь веков. Восемь поворотов. На каждом сдвигались 1-3 ползунка из 8. Этот пост — карта эволюции, не сторонник идей." },
      { kind: "h2", text: "1215 — Magna Carta" },
      { kind: "p", text: "Король впервые письменно обязался жить по правилам. ruleOfLaw +15. Никто другой ползунок не двинулся — низ остался привязан к земле, экономика не росла, ротации не было. Но фундамент был заложен." },
      { kind: "h2", text: "1700 — голландская республика" },
      { kind: "p", text: "Регенты в Амстердаме показали, что государством можно управлять через ротирующиеся коллегии, не только через династию. rotation +10, transparency +10." },
      { kind: "h2", text: "1750-1850 — промышленная революция" },
      { kind: "p", text: "Самое важное событие модерна. Экономика впервые растёт быстрее населения. positiveSum +30. Появляется буржуа — новая ось статуса, не наследственная. multiStatus +15. Без этого сдвига всё последующее было бы политически невозможно." },
      { kind: "embed-preset", preset: "Open Access", label: "Конечная цель эволюции — Open Access Order" },
      { kind: "h2", text: "1900-1950 — всеобщее избирательное право" },
      { kind: "p", text: "Сначала мужчины без ценза, потом женщины. Афинский жребий возвращается как регулярные выборы. rotation +20." },
      { kind: "h2", text: "1945-1980 — социальное государство" },
      { kind: "p", text: "Бесплатное образование, всеобщая медицина, пенсии. floor +30 — самое дорогое и самое стабилизирующее изменение в истории." },
      { kind: "h2", text: "2000-сейчас — цифровая прозрачность" },
      { kind: "p", text: "Открытые декларации, доступ к данным, конкуренция юрисдикций. transparency +15, polycentricity +15. Все 4 опоры Open Access собраны." },
      { kind: "quote", text: "Прогресс не линейный. Каждый сдвиг открывает следующий, но не гарантирует.", cite: "North/Wallis/Weingast" },
      { kind: "p", text: "Хочешь сам пройти этот путь по шагам — открой /constitution и нажми «▶ Тур по эволюции» в шапке." },
    ],
  },
  {
    slug: "growing-pie-is-everything",
    title: "Why every successful country has a growing pie",
    excerpt:
      "positiveSum — самый недооценённый ползунок. Без растущего пирога ни одна реформа не держится дольше одного электорального цикла. Венесуэла, СССР-1980, феодализм — все рухнули по одной причине.",
    author: "AEVION research",
    publishedAt: "2026-05-24T09:00:00Z",
    readMinutes: 4,
    ogPreset: "Open Access (идеал)",
    blocks: [
      { kind: "p", text: "Если бы у меня был только один ползунок чтобы предсказать судьбу страны на 30 лет вперёд — я бы выбрал positiveSum." },
      { kind: "h2", text: "Феодализм держался 800 лет" },
      { kind: "p", text: "Не потому что был популярен. Потому что positiveSum был близок к нулю — экономика не росла, и если кто-то получал больше, кто-то получал меньше. Бунты были, но они меняли только лица сверху, не структуру." },
      { kind: "h2", text: "Венесуэла 2000-х" },
      { kind: "p", text: "Высокие нефтяные цены → щедрые социальные программы → floor вырос с 30 до 60. После обвала цен 2014 — positiveSum рухнул, floor не удержался, страна провалилась в hyperinflation за 5 лет." },
      { kind: "embed-country", code: "ve" },
      { kind: "h2", text: "СССР 1980" },
      { kind: "p", text: "Огромный floor (бесплатное образование, медицина, пенсии), но positiveSum был 35-40. Экономика росла медленнее, чем потребности. К концу 80-х противоречие стало неразрешимым." },
      { kind: "h2", text: "Что это значит для конституционного дизайна" },
      { kind: "p", text: "Любой ползунок, который ты хочешь подвинуть вверх, требует pre-existing положительной суммы. Хочешь высокий floor? Сначала pirog должен расти. Хочешь больше polycentricity? Локальные юрисдикции должны быть способны платить за свою независимость. Хочешь rotation? Уходящие должны иметь будущее за пределами власти — а это значит работающая экономика." },
      { kind: "quote", text: "Все хорошие конституции стоят на растущем пироге. Все плохие — на дележе фиксированного.", cite: "Acemoglu & Robinson, Why Nations Fail" },
      { kind: "embed-preset", preset: "Авторитарная", label: "Экстрактивный бум — растущий пирог при низких остальных" },
      { kind: "p", text: "Но и обратное верно. Растущий пирог без остальных опор → Экстрактивный бум, который взрывается на первой длинной просадке. Норвегия, Сингапур, Германия — все имеют positiveSum 65-85 ПЛЮС высокие floor/ruleOfLaw/transparency. Без этого комбо рост не конвертируется в стабильность." },
    ],
  },
];

export function findPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function listPosts(): BlogPost[] {
  return [...POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}
