// Мультичат — карта разногласий.
//
// Зачем: все продукты с несколькими агентами синтезируют ответы в один и
// ВЫБРАСЫВАЮТ разногласие. А оно — самый ценный сигнал: там, где модели
// разошлись, и надо смотреть человеку. Согласие нескольких моделей ничего не
// доказывает (они учились на пересекающихся данных и ошибаются одинаково), а
// вот расхождение всегда указывает на место, где ответ ненадёжен.
//
// Принцип реализации: НИ ОДНОГО дополнительного вызова модели. Карта считается
// детерминированно из уже полученных ответов, поэтому она бесплатна и
// воспроизводима. Судья-модель поверх спора стоил бы ещё один вызов на каждый
// вопрос и добавил бы собственную ошибку — здесь это не нужно.

import { mentionsUnnegated, mentionsOnlyNegated } from "../../lib/textNegation";

export type AgentAnswer = {
  agentId: string;
  role?: string;
  provider?: string;
  model?: string;
  ok: boolean;
  reply?: string;
  error?: string;
};

/* ── Лексика ──────────────────────────────────────────────────────────── */

/**
 * Служебные слова, не несущие содержания.
 *
 * Первый вариант списка состоял почти целиком из слов короче трёх букв — а их
 * и так убирает фильтр `length > 2` в `tokens()`. То есть список фактически не
 * работал: проверено пословно 27.07 — из 28 частых русских служебных слов
 * («который», «также», «есть», «может», «нужно», «стоит», «будет», «однако»,
 * «если», «очень» …) не отсекалось НИ ОДНО, из 15 английских — тоже.
 *
 * Цена была измерена: два ответа, противоположных по смыслу, но с одинаковым
 * обрамлением («это будет очень НЕЭФФЕКТИВНО, потому что…» против «это будет
 * очень ВЫГОДНО, потому что…») давали схожесть 0.714 при пороге консенсуса
 * 0.45 — карта объявляла согласие там, где агенты прямо спорят. Это опаснее
 * обратной ошибки: человек не идёт проверять именно то, за чем пришёл.
 *
 * Границы списка: только слова, которые в ЛЮБОМ содержательном ответе служат
 * связками. Оценочные слова («достаточно», «рано», «выгодно») сюда НЕ входят —
 * в них и живёт разногласие.
 */

const STOP = new Set([
  // англ. — артикли, предлоги, связки, модальные
  "the", "a", "an", "and", "or", "but", "with", "of", "in", "on", "at", "to",
  "for", "from", "is", "are", "be", "as", "by", "that", "this", "it", "its",
  "was", "were", "been", "being", "have", "has", "had", "will", "would",
  "could", "should", "can", "may", "might", "must", "there", "their", "them",
  "they", "we", "you", "your", "our", "because", "which", "when", "while",
  "about", "into", "than", "then", "also", "very", "just", "however",
  "therefore", "these", "those", "some", "any", "such", "not", "does", "did",
  // рус. — предлоги, союзы, частицы, местоимения, связочные глаголы
  "и", "в", "на", "с", "у", "по", "из", "не", "что", "это", "как", "для",
  "то", "же", "бы", "или", "а", "но", "их", "его", "её", "они", "мы", "вы",
  "который", "которая", "которое", "которые", "также", "более", "менее",
  "есть", "быть", "будет", "будут", "было", "были", "может", "могут",
  "нужно", "надо", "стоит", "этот", "эта", "эти", "того", "при", "чем",
  "чтобы", "потому", "поэтому", "однако", "если", "так", "там", "тут",
  "где", "когда", "очень", "уже", "ещё", "еще", "всё", "все", "весь",
  "тоже", "либо", "ведь", "лишь", "даже", "просто", "именно", "нас", "них",
  "себя", "свой", "своё", "свои", "чём", "чего", "кроме", "около", "после",
  "перед", "между", "через", "перед", "сейчас", "затем", "иначе",
]);

export function tokens(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.,%-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.,]+|[.,]+$/g, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Схожесть двух ответов: доля общих значимых слов от более короткого.
 *  Берём min, а не объединение: развёрнутый ответ и краткий о том же не должны
 *  считаться расходящимися только из-за разной длины. */
export function similarity(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

/* ── Числа: самая проверяемая форма разногласия ───────────────────────── */

export type NumericClaim = {
  value: number;
  raw: string;
  context: string;
  /**
   * Что именно измеряется — 1–2 значимых слова сразу после числа, огрублённых
   * до основы («посетителей в месяц» → «посетител месяц»).
   *
   * Нужно потому, что схожести предложений мало. Замерено 27.07: независимые
   * агенты формулируют по-разному, и «На текущем трафике это примерно 40
   * посетителей в месяц, выборки не хватит» против «Трафика около 300
   * посетителей в месяц, этого достаточно» давало similarity ниже порога —
   * расхождение 40 против 300 НЕ находилось. В демо-примере ответы написаны в
   * одном стиле, поэтому фича выглядела работающей: классический зелёный тест
   * на синтетике.
   */
  unit: string;
};

/**
 * Огрубление до основы: сравниваем «посетителей» и «посетители» как одно.
 * Полноценный стеммер тут не нужен и вреден — достаточно снять хвост, который
 * несёт падеж и число. Слова короче 6 букв не трогаем: там хвост — часть корня
 * («месяц», «тонна»).
 */
function stem(word: string): string {
  return word.length >= 6 ? word.slice(0, Math.max(5, word.length - 2)) : word;
}

/** 1–2 значимых слова после числа, огрублённые. Пусто — если их нет. */
function unitAfter(src: string, at: number, len: number): string {
  const tail = src.slice(at + len, at + len + 40);
  const words = tokens(tail).slice(0, 2).map(stem);
  return words.join(" ");
}

const MAX_CONTEXT = 180;

/** Предложение, внутри которого стоит число.
 *
 *  Раньше бралось окно ±40 символов — оно начиналось с середины слова и им же
 *  заканчивалось («…пришёл. На текущем трафике 40 посетителей — выборки не
 *  хвати»). Контекст должен отвечать на вопрос «о чём вообще это число», а
 *  обрывок на него не отвечает; человек видит его первым, когда открывает
 *  расхождение. Заодно предложение — более честная единица для группировки:
 *  два агента, говорящие об одном, чаще совпадают предложением, чем случайно
 *  выровненным окном.
 *
 *  Точка считается концом предложения, только если за ней пробел или конец
 *  строки — иначе «1.5» и «v2.0» разрывались бы посередине. */
function sentenceAround(src: string, at: number, len: number): string {
  const isEnd = (i: number) =>
    /[.!?…\n]/.test(src[i]) && (i + 1 >= src.length || /[\s]/.test(src[i + 1]));

  let from = 0;
  for (let i = at - 1; i >= 0; i--) {
    if (isEnd(i)) { from = i + 1; break; }
  }
  let to = src.length;
  for (let i = at + len; i < src.length; i++) {
    if (isEnd(i)) { to = i + 1; break; }
  }

  let out = src.slice(from, to).replace(/\s+/g, " ").trim();
  if (out.length > MAX_CONTEXT) {
    // Обрезаем по границе слова, а не по букве: усечённое слово читается как опечатка.
    const cut = out.slice(0, MAX_CONTEXT);
    const lastSpace = cut.lastIndexOf(" ");
    out = (lastSpace > MAX_CONTEXT / 2 ? cut.slice(0, lastSpace) : cut).trim() + "…";
  }
  return out;
}

/** Числа с их окружением. Если один агент говорит «$36», а другой «$50» про то
 *  же — это конкретное расхождение, которое человек проверит за минуту, в
 *  отличие от расхождения в тоне или формулировке. */
export function numericClaims(text: string): NumericClaim[] {
  const out: NumericClaim[] = [];
  const src = String(text || "");
  // Числа с необязательным денежным/процентным маркером; годы отбрасываем ниже.
  const re = /([$€₸]?\s?\d[\d\s.,]*\d|\d)\s?(%|USD|usd|\$|₸|тг)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const raw = m[0].trim();
    const num = Number(raw.replace(/[^\d.,-]/g, "").replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(num)) continue;
    // Годы и порядковые номера шумят и почти никогда не являются предметом спора.
    if (num >= 1900 && num <= 2100 && !/[$€₸%]/.test(raw)) continue;
    out.push({
      value: num,
      raw,
      context: sentenceAround(src, m.index, raw.length),
      unit: unitAfter(src, m.index, m[0].length),
    });
  }
  return out;
}

/* ── Противоположность: спор, который «доля общих слов» не видит ─────────── */

export type Opposition = {
  /** Слово, вокруг которого агенты расходятся (в исходной форме одного из них). */
  term: string;
  /** Кто утверждает и кто отрицает. */
  affirms: string;
  denies: string;
};

/**
 * Антонимичные пары по теме решения. Нужны там, где отрицания нет вовсе:
 * «запускать рано» против «запускать пора» — оба утвердительные.
 *
 * Список короткий намеренно. Он покрывает решения «делать / не делать», ради
 * которых консилиум и собирают; растить его до тезауруса значит уйти в
 * sentiment-анализ, а это уже вызов модели.
 */
const ANTONYMS: Array<[RegExp, RegExp]> = [
  [/(?<!\p{L})рано(?!\p{L})/iu, /(?<!\p{L})(пора|поздно|своевременно)(?!\p{L})/iu],
  [/(?<!\p{L})стоит(?!\p{L})/iu, /(?<!\p{L})не стоит(?!\p{L})/iu],
  [/(?<!\p{L})(достаточно|хватает|хватит)(?!\p{L})/iu, /(?<!\p{L})(не хватает|недостаточно|мало)(?!\p{L})/iu],
  [/(?<!\p{L})(выгодно|окупится|эффективно)(?!\p{L})/iu, /(?<!\p{L})(невыгодно|не окупится|неэффективно)(?!\p{L})/iu],
  [/(?<!\p{L})(запускать|включать)(?!\p{L})/iu, /(?<!\p{L})(отложить|подождать|остановить)(?!\p{L})/iu],
  [/(?<!\p{L})(safe|worth it|profitable)(?!\p{L})/iu, /(?<!\p{L})(risky|not worth|unprofitable)(?!\p{L})/iu],
];

/**
 * Прямые противоречия между ответами.
 *
 * Зачем отдельно от `similarity`: та считает долю общих слов, то есть измеряет
 * ТЕМУ, а не позицию. Замерено 27.07 — «Запускать рано: продукт не удерживает
 * пользователей» против «Запускать пора: удержание достаточное» даёт 0.500 и
 * вердикт `consensus`, потому что агенты отвечают на один вопрос и берут одну
 * лексику. Ложное согласие опаснее ложного расхождения: человек НЕ идёт
 * проверять именно то, за чем пришёл.
 *
 * Два дешёвых сигнала, оба без вызова модели:
 *  1) одно и то же слово один утверждает, другой отрицает (через общий
 *     `lib/textNegation` — он же чинит «no patents» в QVenture);
 *  2) антонимичная пара из списка выше.
 */
export function oppositions(answers: AgentAnswer[]): Opposition[] {
  const good = (answers || []).filter((a) => a.ok && a.reply && a.reply.trim());
  const out: Opposition[] = [];
  const seen = new Set<string>();

  const push = (term: string, affirms: string, denies: string) => {
    const key = `${stem(term.toLowerCase())}|${affirms}|${denies}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ term, affirms, denies });
  };

  for (let i = 0; i < good.length; i++) {
    for (let j = i + 1; j < good.length; j++) {
      const a = good[i], b = good[j];
      const textA = a.reply as string, textB = b.reply as string;

      // (1) Общее слово: у одного утверждается, у другого отрицается.
      const sharedStems = new Map<string, string>();
      for (const w of tokens(textA)) sharedStems.set(stem(w), w);
      for (const w of tokens(textB)) {
        const original = sharedStems.get(stem(w));
        if (!original) continue;
        // Ищем по основе, чтобы падежи не мешали: «удержание» ↔ «удержания».
        const pattern = new RegExp(stem(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\p{L}*", "giu");
        const aSays = mentionsUnnegated(textA, pattern);
        const bSays = mentionsUnnegated(textB, pattern);
        const aDenies = mentionsOnlyNegated(textA, pattern);
        const bDenies = mentionsOnlyNegated(textB, pattern);
        if (aSays && bDenies) push(original, a.agentId, b.agentId);
        else if (bSays && aDenies) push(w, b.agentId, a.agentId);
      }

      // (2) Антонимичная пара — там, где отрицания нет вовсе.
      for (const [posRe, negRe] of ANTONYMS) {
        const aPos = posRe.test(textA), aNeg = negRe.test(textA);
        const bPos = posRe.test(textB), bNeg = negRe.test(textB);
        if (aPos && bNeg && !aNeg) push(String(textA.match(posRe)?.[0] ?? "").trim(), a.agentId, b.agentId);
        else if (bPos && aNeg && !bNeg) push(String(textB.match(posRe)?.[0] ?? "").trim(), b.agentId, a.agentId);
      }
    }
  }
  return out;
}

export type NumericConflict = {
  context: string;
  values: Array<{ agentId: string; raw: string; value: number }>;
  spread: number;
};

/** Числа, названные разными агентами в СХОЖЕМ контексте, но разные по значению.
 *  Схожесть контекста — по общим словам вокруг числа: без этого «5 пунктов» и
 *  «5 долларов» слиплись бы в конфликт на ровном месте. */
export function numericConflicts(answers: AgentAnswer[], minContextSim = 0.3): NumericConflict[] {
  const all: Array<{ agentId: string } & NumericClaim> = [];
  for (const a of answers) {
    if (!a.ok || !a.reply) continue;
    for (const c of numericClaims(a.reply)) all.push({ agentId: a.agentId, ...c });
  }
  const used = new Set<number>();
  const conflicts: NumericConflict[] = [];
  for (let i = 0; i < all.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < all.length; j++) {
      if (used.has(j)) continue;
      if (all[i].agentId === all[j].agentId) continue; // спорят агенты, не абзацы
      // Числа сравнимы, если измеряют ОДНО И ТО ЖЕ. Совпавшая единица —
      // сигнал сильнее схожести предложений: она устойчива к тому, что агенты
      // обрамляют цифру разными словами. Схожесть контекста оставлена как
      // второй путь — для чисел без явной единицы («вырастет до 300»).
      const sameUnit = !!all[i].unit && all[i].unit === all[j].unit;
      if (sameUnit || similarity(all[i].context, all[j].context) >= minContextSim) group.push(j);
    }
    if (group.length < 2) continue;
    const values = group.map((k) => ({ agentId: all[k].agentId, raw: all[k].raw, value: all[k].value }));
    const nums = values.map((v) => v.value);
    const spread = Math.max(...nums) - Math.min(...nums);
    if (spread === 0) continue; // сошлись — это согласие, а не конфликт
    group.forEach((k) => used.add(k));
    conflicts.push({ context: all[i].context, values, spread });
  }
  return conflicts.sort((a, b) => b.spread - a.spread);
}

/* ── Отказы и хеджи ───────────────────────────────────────────────────── */

// Границы через \p{L}, а НЕ через \b: в JS \b определён по [A-Za-z0-9_], поэтому
// перед кириллицей он не срабатывает и «не уверен» молча не находится. Для
// русскоязычного продукта это означало бы детектор, работающий только на
// английском (поймано тестом 2026-07-26).
// Список пополнен 27.07 после замера: он покрывал ровно те формулировки,
// которые встречались в демо-примере и тестах, а семь обычных способов сказать
// «не уверен» пропускал — «затрудняюсь сказать», «сложно судить»,
// «однозначного ответа нет», «требуется уточнение», «не стал бы утверждать»,
// «it depends», «hard to say». То есть на живых ответах блок «осторожность и
// отказы» молчал, и пункт «что проверить» с весом 2 не появлялся.
//
// Намеренно НЕ добавлено просто «зависит от»: в уверенном ответе это
// констатация («цена зависит от объёма»), а не осторожность. Ловим только
// связки, где неопределённость и есть содержание: «многое/всё зависит»,
// «однозначного ответа нет».
const HEDGE =
  /(^|[^\p{L}])(не могу|не уверен|не берусь|возможно|вероятно|скорее всего|недостаточно данных|затрудняюсь|сложно сказать|сложно судить|трудно сказать|оценить сложно|однозначного ответа нет|многое зависит|всё зависит|все зависит|нужны дополнительные данные|требуется уточнение|не стал бы утверждать|бы не стал утверждать|точно сказать нельзя|can't|cannot|not sure|unable to|as an AI|not able|it depends|hard to say|difficult to say|insufficient data|cannot be certain)([^\p{L}]|$)/iu;

/**
 * «Может быть» — хедж только как ВВОДНОЕ слово.
 *
 * В общем словаре оно давало ложь на живом тексте: «Цена может быть любой»
 * помечалось как неуверенность, и карта сообщала «агент сам отметил
 * неуверенность» про самого уверенного из панели (замерено 27.07 на
 * разностильном наборе). Вводное «может быть» стоит в начале предложения либо
 * обособлено запятыми — на этом и различаем.
 */
const HEDGE_MAYBE = /(^|[.!?…\n]\s*)может быть([^\p{L}]|$)|,\s*может быть\s*,/iu;

/** Агент, который отказался или ушёл в осторожность, — тоже сигнал: часто он
 *  единственный заметил, что вопрос некорректен или данных не хватает. */
export function hedges(answers: AgentAnswer[]): Array<{ agentId: string; kind: "failed" | "hedged"; note: string }> {
  const out: Array<{ agentId: string; kind: "failed" | "hedged"; note: string }> = [];
  for (const a of answers) {
    if (!a.ok) { out.push({ agentId: a.agentId, kind: "failed", note: a.error || "вызов не удался" }); continue; }
    const m = a.reply && HEDGE.exec(a.reply);
    const maybe = !m && a.reply && HEDGE_MAYBE.exec(a.reply);
    // m[2] — сама формулировка без захваченных границ.
    if (m) out.push({ agentId: a.agentId, kind: "hedged", note: m[2] });
    else if (maybe) out.push({ agentId: a.agentId, kind: "hedged", note: "может быть" });
  }
  return out;
}

/* ── Итоговая карта ───────────────────────────────────────────────────── */

export type DissentMap = {
  agents: number;
  answered: number;
  /** 0..1 — средняя попарная схожесть ответов. Низкая = агенты разошлись. */
  agreement: number | null;
  /** Пары с указанием схожести — чтобы UI мог показать, кто с кем совпал. */
  pairs: Array<{ a: string; b: string; similarity: number }>;
  /** Агент, чей ответ дальше всех от остальных. Не «неправ» — «стоит особняком». */
  outlier: { agentId: string; distance: number } | null;
  numericConflicts: NumericConflict[];
  hedges: Array<{ agentId: string; kind: "failed" | "hedged"; note: string }>;
  /**
   * Во сколько раз самый развёрнутый содержательный ответ длиннее самого
   * краткого (по значимым словам). 1 — сопоставимы.
   *
   * Нужно, чтобы не выдавать перекос за согласие. `similarity` делит общие
   * слова на длину БОЛЕЕ КОРОТКОГО ответа — сознательно, иначе краткий ответ
   * о том же считался бы расхождением. Побочный эффект замерен 27.07:
   * «Запускать платный тариф стоит.» против развёрнутого разбора с оговорками
   * («отдельно проверьте готовность поддержки и текст оферты») даёт
   * agreement 1.000 и вердикт consensus — все слова краткого входят в длинный.
   * Формально согласие, по сути краткий ответ просто НЕ КАСАЛСЯ оговорок.
   */
  lengthSkew: number;
  /**
   * Прямые противоречия: один агент утверждает то, что другой отрицает, либо
   * они используют антонимичную пару. Считается без вызова модели, на общем
   * `lib/textNegation`.
   */
  oppositions: Opposition[];
  /** Куда смотреть человеку в первую очередь. */
  verdict: "consensus" | "split" | "insufficient";
  note: string;
  /** Что именно пойти проверить. См. buildChecklist. */
  checks: Check[];
};

/** Один пункт «пойти и проверить».
 *
 *  kind — источник пункта, чтобы UI мог расставить акценты; weight — насколько
 *  пункт проверяем руками, от 1 (нужно суждение) до 3 (можно закрыть за минуту).
 */
export type Check = {
  kind: "number" | "opposition" | "outlier" | "hedge" | "failure" | "consensus";
  text: string;
  agents: string[];
  weight: 1 | 2 | 3;
};

const MAX_CHECKS = 5;

/** Карта разногласий отвечает «где агенты разошлись». Сама по себе это диагноз,
 *  а человеку нужен следующий шаг — «что пойти проверить».
 *
 *  Порядок не по важности, а по ПРОВЕРЯЕМОСТИ: сначала числа (расхождение
 *  закрывается одним запросом к источнику), потом отказы и неуверенность, и лишь
 *  затем расхождение по существу, где нужно читать и думать. Совет, который
 *  нельзя выполнить за минуту, на практике не выполняют вовсе.
 *
 *  Считается из уже готовой карты, без единого вызова модели — то есть остаётся
 *  бесплатным и воспроизводимым, как и она сама. */
export function buildChecklist(map: Omit<DissentMap, "checks">): Check[] {
  const out: Check[] = [];

  for (const c of map.numericConflicts) {
    const spread = c.values.map((v) => `${v.agentId}: ${v.raw}`).join(" против ");
    out.push({
      kind: "number",
      text: `Сверить число с источником — ${spread}. Контекст: «${c.context}»`,
      agents: c.values.map((v) => v.agentId),
      weight: 3,
    });
  }

  for (const h of map.hedges) {
    out.push(
      h.kind === "failed"
        ? {
            kind: "failure",
            text: `Агент ${h.agentId} не ответил — картина неполная. Перезапустить или исключить его из выводов.`,
            agents: [h.agentId],
            weight: 3,
          }
        : {
            kind: "hedge",
            text: `Агент ${h.agentId} сам отметил неуверенность («${h.note}») — не опирайтесь на эту часть без проверки.`,
            agents: [h.agentId],
            weight: 2,
          }
    );
  }

  if (map.outlier) {
    out.push({
      kind: "outlier",
      text: `Прочитать первым ответ агента ${map.outlier.agentId}: он дальше всех от остальных. Это не значит «неправ» — значит, он увидел что-то своё.`,
      agents: [map.outlier.agentId],
      weight: 1,
    });
  }

  // Прямое противоречие — самый проверяемый вид спора после чисел: достаточно
  // прочитать два названных ответа и решить, кто прав. Вес 3, как у чисел.
  for (const o of map.oppositions.slice(0, 2)) {
    out.push({
      kind: "opposition",
      text:
        `Агенты прямо расходятся про «${o.term}»: ${o.affirms} утверждает, ${o.denies} отрицает. ` +
        `Прочитайте эти два ответа рядом — согласия здесь нет, сколько бы общих слов они ни использовали.`,
      agents: [o.affirms, o.denies],
      weight: 3,
    });
  }

  // Согласие при сильно разных объёмах — ненадёжный сигнал: `similarity` делит
  // на длину более короткого ответа, поэтому краткое «Запускать стоит» внутри
  // развёрнутого разбора даёт 1.000. Краткий ответ не спорил с оговорками — он
  // их просто не касался, и человеку надо об этом сказать.
  if (map.verdict === "consensus" && map.lengthSkew >= 3) {
    out.push({
      kind: "consensus",
      text:
        `Ответы сильно разной длины (разница ${map.lengthSkew}×). Краткий не спорил с оговорками ` +
        `развёрнутого — он их не касался, поэтому «согласие» здесь слабее, чем выглядит. ` +
        `Прочитайте детали длинного ответа отдельно.`,
      agents: [],
      weight: 2,
    });
  }

  // При согласии список не пустой: согласие само по себе ничего не доказывает,
  // и молчаливый пустой блок читался бы как «всё в порядке».
  //
  // «Пусто» считается по пунктам О РАЗНОГЛАСИЯХ, а не по всему списку. Иначе
  // предупреждение о перекосе длин выше вытесняло базовый тезис — а они о
  // разном: первое про «здесь согласие ещё и артефакт длины», второе про
  // «согласие моделей в принципе ничего не доказывает, они ошибаются
  // одинаково». Второе — суть продукта, терять его нельзя.
  if (map.verdict === "consensus" && !out.some((c) => c.kind !== "consensus")) {
    out.push({
      kind: "consensus",
      text: "Агенты сошлись — проверьте общую посылку: модели учились на пересекающихся данных и ошибаются одинаково.",
      agents: [],
      weight: 1,
    });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, MAX_CHECKS);
}

/** Порог, ниже которого ответы считаем разошедшимися. 0.45 по доле общих слов:
 *  выше — агенты пересказывают одно и то же, ниже — говорят о разном. */
const AGREEMENT_THRESHOLD = 0.45;

export function buildDissentMap(answers: AgentAnswer[]): DissentMap {
  const list = answers || [];
  const good = list.filter((a) => a.ok && a.reply && a.reply.trim().length > 0);

  const pairs: Array<{ a: string; b: string; similarity: number }> = [];
  for (let i = 0; i < good.length; i++) {
    for (let j = i + 1; j < good.length; j++) {
      pairs.push({
        a: good[i].agentId,
        b: good[j].agentId,
        similarity: Number(similarity(good[i].reply as string, good[j].reply as string).toFixed(3)),
      });
    }
  }

  const agreement = pairs.length ? Number((pairs.reduce((s, p) => s + p.similarity, 0) / pairs.length).toFixed(3)) : null;

  // Аутлаер: у кого наименьшая средняя схожесть с остальными.
  let outlier: DissentMap["outlier"] = null;
  if (good.length >= 3) {
    const avg = good.map((a) => {
      const mine = pairs.filter((p) => p.a === a.agentId || p.b === a.agentId);
      const m = mine.reduce((s, p) => s + p.similarity, 0) / (mine.length || 1);
      return { agentId: a.agentId, mean: m };
    });
    const worst = avg.reduce((w, x) => (x.mean < w.mean ? x : w), avg[0]);
    outlier = { agentId: worst.agentId, distance: Number((1 - worst.mean).toFixed(3)) };
  }

  // Разброс объёмов: во сколько раз самый развёрнутый ответ длиннее самого
  // краткого. Считаем по значимым словам, а не по символам — тогда вежливые
  // обрамления не искажают картину.
  const wordCounts = good.map((a) => tokens(a.reply as string).length).filter((n) => n > 0);
  const lengthSkew = wordCounts.length >= 2
    ? Number((Math.max(...wordCounts) / Math.min(...wordCounts)).toFixed(2))
    : 1;

  const conflicts = numericConflicts(list);
  const hedged = hedges(list);

  // Меньше двух содержательных ответов — сравнивать не с чем. Отдавать
  // «консенсус» в этом случае значило бы подтвердить непроверенное.
  // Прямое противоречие снимает согласие так же, как расхождение в числах.
  // Схожесть по словам измеряет тему, а не позицию: «Запускать рано, продукт не
  // удерживает» против «Запускать пора, удержание достаточное» давало 0.500 и
  // вердикт consensus. Если один утверждает то, что другой отрицает, согласия
  // нет — сколько бы общих слов они ни использовали.
  const opposed = oppositions(list);

  const verdict: DissentMap["verdict"] =
    good.length < 2
      ? "insufficient"
      : agreement != null && agreement >= AGREEMENT_THRESHOLD && !conflicts.length && !opposed.length
        ? "consensus"
        : "split";

  const note =
    verdict === "insufficient"
      ? `Содержательных ответов ${good.length} — сравнивать не с чем.`
      : verdict === "consensus"
        ? `Агенты сходятся (${agreement}). Совпадение не доказывает правоту: модели ошибаются похоже.`
        : `Расхождение${conflicts.length ? `, включая ${conflicts.length} числовых` : ""}. Смотреть в первую очередь сюда.`;

  const base = {
    agents: list.length,
    answered: good.length,
    agreement,
    pairs,
    outlier,
    numericConflicts: conflicts,
    hedges: hedged,
    lengthSkew,
    oppositions: opposed,
    verdict,
    note,
  };

  return { ...base, checks: buildChecklist(base) };
}
