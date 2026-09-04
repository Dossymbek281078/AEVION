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

const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "with", "of", "in", "on", "at", "to",
  "for", "from", "is", "are", "be", "as", "by", "that", "this", "it", "its",
  "и", "в", "на", "с", "у", "по", "из", "не", "что", "это", "как", "для",
  "то", "же", "бы", "или", "а", "но", "их", "его", "её", "они", "мы", "вы",
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

export type NumericClaim = { value: number; raw: string; context: string; unit: string | null };

/**
 * Единица измерения рядом с числом — валюта, срок, доля, штуки.
 *
 * Зачем. Без неё «12000 долларов» и «6 недель» из одного предложения попадали в
 * ОДИН конфликт с разбросом 11994, и человек видел «сверить число: 12000 против 6».
 * Сравнивать деньги со сроком бессмысленно, а такой разброс ещё и ставил шум на
 * первое место в сортировке. Замер на проде 19.08.2026 — ровно этот случай.
 *
 * Нормализация грубая и намеренно такая: ключ нужен только чтобы СГРУППИРОВАТЬ
 * сравнимое, а не чтобы понять смысл. Незнакомое слово даёт ключ из своей основы,
 * поэтому «попугаев» сравнится с «попугаями», но не с долларами.
 */
const UNIT_ALIASES: Array<[RegExp, string]> = [
  [/^(доллар|usd|бакс)/i, "usd"],
  [/^(евро|eur)/i, "eur"],
  [/^(тенге|тг|kzt)/i, "kzt"],
  [/^(рубл|руб|rub)/i, "rub"],
  [/^(процент|proc|pct)/i, "pct"],
  [/^(недел|week)/i, "week"],
  [/^(месяц|мес(?![а-яё])|month)/i, "month"],
  [/^(дн|день|дня|дней|сут|day)/i, "day"],
  [/^(час|hour)/i, "hour"],
  [/^(год|лет|года|year)/i, "year"],
  [/^(человек|людей|сотрудник|people|person)/i, "people"],
  [/^(штук|шт(?![а-яё])|piece|item)/i, "piece"],
];

export function normalizeUnit(word: string | null | undefined): string | null {
  const w = String(word || "").trim().toLowerCase();
  if (!w) return null;
  if (w === "%" ) return "pct";
  if (w === "$") return "usd";
  if (w === "€") return "eur";
  if (w === "₸") return "kzt";
  for (const [re, key] of UNIT_ALIASES) if (re.test(w)) return key;
  // Незнакомое слово: берём основу, чтобы падежи сошлись. Латиницу не режем —
  // там окончаний нет, и обрезка склеила бы разные слова.
  return /^[a-z]+$/.test(w) ? w : w.slice(0, 5);
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
/**
 * Число из текста ответа модели — с разбором разделителя тысяч.
 *
 * Раньше здесь стояло `.replace(",", ".")`, то есть запятая ВСЕГДА считалась
 * десятичной. «$1,200» превращалось в 1.2, и два агента, назвавшие одну и ту же
 * сумму разной записью, попадали в карту разногласий с разбросом 1198.8. Ложный
 * конфликт вреднее пропущенного: он отправляет человека проверять то, чего нет.
 * «$1,234,567» и вовсе выпадало — Number("1.234,567") даёт NaN, и число молча
 * не участвовало в сравнении.
 *
 * Разбор по структуре, а не по локали (в одном ответе модель мешает обе):
 *   1 234 / 1,234,567 / 1.234.567 — группы по три цифры → разделитель тысяч;
 *   1 234,56 / 1,234.56 — последний одиночный разделитель → десятичный;
 *   2,5 / 1.5 — одиночный разделитель с 1-2 цифрами → десятичный.
 *
 * Остаётся неоднозначность «2,500»: три цифры после запятой читаются как
 * тысячи. В русском тексте десятичную долю пишут одной-двумя цифрами («2,5»),
 * поэтому такой выбор ошибается реже обратного.
 */
export function parseNumeric(raw: string): number {
  // Валюта, проценты и пробелы-разделители тысяч к значению не относятся.
  const body = raw.replace(/[^\d.,]/g, "");
  if (!body) return NaN;

  const groups = /^\d{1,3}([.,]\d{3})+$/;
  if (groups.test(body)) return Number(body.replace(/[.,]/g, ""));

  // Смешанная запись: последний разделитель — десятичный, остальные — тысячи.
  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decAt = Math.max(lastDot, lastComma);
    const intPart = body.slice(0, decAt).replace(/[.,]/g, "");
    return Number(`${intPart}.${body.slice(decAt + 1)}`);
  }

  const sep = lastDot >= 0 ? lastDot : lastComma;
  if (sep < 0) return Number(body);
  const tail = body.slice(sep + 1);
  // Ровно три цифры после одиночного разделителя — разделитель тысяч.
  if (tail.length === 3 && /^\d{3}$/.test(tail)) return Number(body.slice(0, sep) + tail);
  return Number(`${body.slice(0, sep)}.${tail}`);
}

export function numericClaims(text: string): NumericClaim[] {
  const out: NumericClaim[] = [];
  const src = String(text || "");
  // Числа с необязательным денежным/процентным маркером; годы отбрасываем ниже.
  const re = /([$€₸]?\s?\d[\d\s.,]*\d|\d)\s?(%|USD|usd|\$|₸|тг)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const raw = m[0].trim();
    const num = parseNumeric(raw);
    if (!Number.isFinite(num)) continue;
    // Годы и порядковые номера шумят и почти никогда не являются предметом спора.
    if (num >= 1900 && num <= 2100 && !/[$€₸%]/.test(raw)) continue;
    // Единицу ищем сразу за числом: маркер из самой регулярки (%, $, USD) или
    // следующее слово («долларов», «недель»). Русские слова регулярка не ловит —
    // именно поэтому деньги и сроки раньше оказывались в одной группе.
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 24);
    const word = /^\s*([\p{L}%$€₸]+)/u.exec(after);
    const unit = normalizeUnit(m[2] || (word ? word[1] : null));
    out.push({ value: num, raw, context: sentenceAround(src, m.index, raw.length), unit });
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

  // Один агент — одно значение в группе. Прежде проверка «тот же агент» сравнивала
  // кандидата только с ЗАТРАВКОЙ, поэтому два разных числа одного агента спокойно
  // попадали в одну группу: замер на проде 19.08.2026 дал «analyst: 12000 против
  // writer: 12000 против writer: 6» — то есть согласие двух агентов, выданное за
  // спор, и срок, сравнённый с деньгами.
  const pickOnePerAgent = (idx: number[]): number[] => {
    const seen = new Set<string>();
    const out: number[] = [];
    for (const k of idx) {
      if (seen.has(all[k].agentId)) continue;
      seen.add(all[k].agentId);
      out.push(k);
    }
    return out;
  };

  const build = (idx: number[], context: string): NumericConflict | null => {
    const chosen = pickOnePerAgent(idx);
    if (chosen.length < 2) return null;
    const values = chosen.map((k) => ({ agentId: all[k].agentId, raw: all[k].raw, value: all[k].value }));
    const nums = values.map((v) => v.value);
    const spread = Math.max(...nums) - Math.min(...nums);
    if (spread === 0) return null; // сошлись — это согласие, а не конфликт
    return { context, values, spread };
  };

  const used = new Set<number>();
  const conflicts: NumericConflict[] = [];

  // 1. Сначала по ЕДИНИЦЕ измерения. Несогласный агент формулирует иначе, поэтому
  //    сходство предложений у него низкое — и настоящее расхождение раньше просто
  //    не находилось: «12000 долларов» и «реально 30000 долларов» не сгруппировались.
  //    Одинаковая единица — куда более надёжный признак сравнимости, чем общие слова.
  const byUnit = new Map<string, number[]>();
  all.forEach((c, k) => {
    if (!c.unit) return;
    const list = byUnit.get(c.unit);
    if (list) list.push(k); else byUnit.set(c.unit, [k]);
  });
  for (const [, idx] of byUnit) {
    const fresh = idx.filter((k) => !used.has(k));
    const conflict = build(fresh, all[fresh[0] ?? idx[0]].context);
    if (!conflict) continue;
    // Помечаем использованными только те, что реально вошли в конфликт.
    for (const k of pickOnePerAgent(fresh)) used.add(k);
    conflicts.push(conflict);
  }

  // 2. Остальные — прежним путём, по сходству предложений: у числа без узнаваемой
  //    единицы («выросло до 40») сравнить не с чем, кроме контекста.
  for (let i = 0; i < all.length; i++) {
    if (used.has(i) || all[i].unit) continue;
    const group = [i];
    for (let j = i + 1; j < all.length; j++) {
      if (used.has(j) || all[j].unit) continue;
      if (all[i].agentId === all[j].agentId) continue;
      if (similarity(all[i].context, all[j].context) >= minContextSim) group.push(j);
    }
    const conflict = build(group, all[i].context);
    if (!conflict) continue;
    for (const k of pickOnePerAgent(group)) used.add(k);
    conflicts.push(conflict);
  }

  // Сортировка по ОТНОСИТЕЛЬНОМУ разбросу: абсолютный несравним между единицами —
  // 6 недель против 12 важнее, чем 12000 долларов против 12100, хотя абсолютный
  // разброс в тысячу раз меньше.
  const rel = (c: NumericConflict) => {
    const max = Math.max(...c.values.map((v) => Math.abs(v.value)), 1);
    return c.spread / max;
  };
  return conflicts.sort((a, b) => rel(b) - rel(a) || b.spread - a.spread);
}


/* ── Отказы и хеджи ───────────────────────────────────────────────────── */

// Границы через \p{L}, а НЕ через \b: в JS \b определён по [A-Za-z0-9_], поэтому
// перед кириллицей он не срабатывает и «не уверен» молча не находится. Для
// русскоязычного продукта это означало бы детектор, работающий только на
// английском (поймано тестом 2026-07-26).
const HEDGE =
  /(^|[^\p{L}])(не могу|не уверен|не берусь|возможно|вероятно|скорее всего|может быть|недостаточно данных|can't|cannot|not sure|unable to|as an AI|not able)([^\p{L}]|$)/iu;

/** Агент, который отказался или ушёл в осторожность, — тоже сигнал: часто он
 *  единственный заметил, что вопрос некорректен или данных не хватает. */
export function hedges(answers: AgentAnswer[]): Array<{ agentId: string; kind: "failed" | "hedged"; note: string }> {
  const out: Array<{ agentId: string; kind: "failed" | "hedged"; note: string }> = [];
  for (const a of answers) {
    if (!a.ok) { out.push({ agentId: a.agentId, kind: "failed", note: a.error || "вызов не удался" }); continue; }
    const m = a.reply && HEDGE.exec(a.reply);
    // m[2] — сама формулировка без захваченных границ.
    if (m) out.push({ agentId: a.agentId, kind: "hedged", note: m[2] });
  }
  return out;
}

/* ── Прямое отрицание ─────────────────────────────────────────────────── */

// Схожесть считается по общим значимым словам, а «не» стоит в STOP — то есть
// слово, переворачивающее смысл, выбрасывалось ДО сравнения. «Стоит запускать»
// и «не стоит запускать» давали схожесть 1.0 и вердикт «агенты сошлись».
// Для продукта, вся ценность которого в показе разногласия, это худший из
// возможных отказов: на самом ярком разногласии он молчал.
//
// Чинится не расширением словаря схожести (тогда любое «не» в длинном ответе
// начнёт растаскивать похожие тексты), а отдельным сигналом: ищем слово,
// которое один агент утверждает, а другой при нём же отрицает.

const NEGATORS = new Set(["не", "нет", "ни", "not", "no", "never", "dont", "doesnt", "don't", "doesn't", "cannot"]);

// Пары «утверждение — запрет», где отрицание вшито в само слово и маркера перед
// ним нет. Список короткий и намеренно узкий: это самые частые слова решения, а
// не попытка разобрать антонимы вообще.
const ANTONYMS: Array<[string, string]> = [
  ["можно", "нельзя"],
  ["стоит", "нестоит"],
  ["следует", "неследует"],
];

// Обороты, в которых «не» усиливает, а не отрицает. «Не только в цене» не
// спорит с «только цена и решает», «не менее 300» не отрицает «менее 300» —
// это конструкции «X и сверх того» и «не ниже границы». Без этого списка
// детектор противоречий сам становится источником ложных конфликтов, то есть
// ровно того шума, ради устранения которого он и заведён.
const NEGATION_CANCELS = new Set([
  "только", "просто", "лишь", "менее", "более",
  "only", "just", "merely", "less", "fewer",
]);

// Отрицание проходит СКВОЗЬ служебные слова и усилители к тому слову, о котором
// на самом деле спорят: «не очень удачная» — об «удачной», «No, you should not
// launch» — о «launch», а не о «you». Стоп-слова берём те же, что и в мере
// схожести: список значимых слов в модуле должен быть один.
const NEGATION_PASSES_THROUGH = new Set([
  "очень", "слишком", "совсем", "вовсе", "столь", "настолько",
  "very", "too", "quite", "really",
  "you", "we", "they", "she", "one",
]);

/** Слова, которые в этом ответе отрицаются: «не стоит» → «стоит». */
export function negatedWords(text: string): Set<string> {
  const raw = String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    if (!NEGATORS.has(raw[i])) continue;
    // Отрицание относится к ближайшему значимому слову справа: «не стоит»,
    // «не рекомендуем», «нет, не стоит». Окно на слово шире усилителей, чтобы
    // «не очень удачная» дошло до «удачной».
    for (let j = i + 1; j < Math.min(raw.length, i + 4); j++) {
      const w = raw[j];
      if (NEGATORS.has(w) || w.length <= 2) continue;
      if (NEGATION_CANCELS.has(w)) break; // «не только», «не менее» — не отрицание
      if (NEGATION_PASSES_THROUGH.has(w) || STOP.has(w)) continue; // «не очень X» → отрицается X
      out.add(w);
      break;
    }
  }
  for (const [yes, no] of ANTONYMS) {
    if (raw.includes(no)) out.add(yes);
  }
  return out;
}

export type Contradiction = { word: string; affirms: string[]; denies: string[] };

/** Слова, которые одни агенты утверждают, а другие при них же отрицают.
 *
 *  Это не «разошлись по смыслу» вообще — на такое без вызова модели честного
 *  ответа нет. Это узкий и проверяемый случай: одно и то же слово решения у
 *  одних под отрицанием, у других нет. Зато случай самый дорогой: именно так
 *  выглядит «делать» против «не делать». */
export function contradictions(answers: AgentAnswer[]): Contradiction[] {
  const good = answers.filter((a) => a.ok && a.reply && a.reply.trim());
  if (good.length < 2) return [];

  const state = good.map((a) => ({
    agentId: a.agentId,
    words: new Set(tokens(a.reply as string)),
    negated: negatedWords(a.reply as string),
  }));

  const out: Contradiction[] = [];
  const seen = new Set<string>();
  for (const s of state) {
    for (const word of s.negated) {
      if (seen.has(word)) continue;
      const denies = state.filter((x) => x.negated.has(word)).map((x) => x.agentId);
      // Утверждает — тот, у кого слово есть, но НЕ под отрицанием. Слово из
      // ANTONYMS («нельзя» → «стоит») в наборе words может не встретиться,
      // поэтому проверяется и оно, и его антонимная пара.
      const affirms = state
        .filter((x) => !x.negated.has(word) && (x.words.has(word) || ANTONYMS.some(([y]) => y === word && x.words.has(y))))
        .map((x) => x.agentId);
      if (!affirms.length || !denies.length) continue;
      seen.add(word);
      out.push({ word, affirms, denies });
    }
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
  /** Слова, которые одни агенты утверждают, а другие отрицают. См. contradictions. */
  contradictions: Contradiction[];
  hedges: Array<{ agentId: string; kind: "failed" | "hedged"; note: string }>;
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
  kind: "number" | "contradiction" | "outlier" | "hedge" | "failure" | "consensus";
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
    // Значения СНАЧАЛА группируются, и только разные группы противопоставляются.
    // Прежде текст склеивал все значения через «против», и согласные агенты
    // выглядели спорящими: «analyst: 12000 против writer: 12000 против critic:
    // 30000». Человек читает это первым и видит бессмыслицу — 12000 против 12000.
    // Правильно показать, где раскол: «analyst и writer: 12000 против critic: 30000».
    const groups = new Map<string, string[]>();
    for (const v of c.values) {
      const key = v.raw;
      const list = groups.get(key);
      if (list) list.push(v.agentId); else groups.set(key, [v.agentId]);
    }
    const names = (ids: string[]) =>
      ids.length <= 1 ? ids.join("") : `${ids.slice(0, -1).join(", ")} и ${ids[ids.length - 1]}`;
    const spread = [...groups.entries()].map(([raw, ids]) => `${names(ids)}: ${raw}`).join(" против ");
    out.push({
      kind: "number",
      text: `Сверить число с источником — ${spread}. Контекст: «${c.context}»`,
      agents: c.values.map((v) => v.agentId),
      weight: 3,
    });
  }

  // Вес 3, наравне с числами: «делать» против «не делать» проверяется не
  // рассуждением, а одним взглядом на два ответа рядом — и решает всё.
  for (const c of map.contradictions) {
    out.push({
      kind: "contradiction",
      text: `Агенты прямо противоречат друг другу по «${c.word}»: ${c.affirms.join(", ")} утверждает, ${c.denies.join(", ")} отрицает. Прочитать оба ответа рядом.`,
      agents: [...c.affirms, ...c.denies],
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

  // При согласии список не пустой: согласие само по себе ничего не доказывает,
  // и молчаливый пустой блок читался бы как «всё в порядке».
  if (!out.length && map.verdict === "consensus") {
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
    const best = avg.reduce((b, x) => (x.mean > b.mean ? x : b), avg[0]);

    // Выброс существует, только если ОДИН агент действительно стоит в стороне.
    //
    // Прежде он назначался всегда, стоило набраться трём ответам. На трёх
    // ОДИНАКОВЫХ ответах карта выдавала `outlier: a, distance: 0` и советовала
    // человеку: «прочитать первым ответ агента a: он дальше всех от остальных» —
    // прямая ложь при полном согласии. На трёх взаимно разных выбирался первый по
    // порядку, то есть произвольный.
    //
    // Два условия. Первое: разброс средних схожестей должен быть заметен — иначе
    // все стоят одинаково и «дальше всех» не про кого. Второе: минимум должен быть
    // ОДИН; при ничьей называть кого-то — то же произвольное решение.
    const SPREAD_MIN = 0.05;
    const nearWorst = avg.filter((x) => x.mean <= worst.mean + SPREAD_MIN / 2).length;
    const distinguishable = best.mean - worst.mean >= SPREAD_MIN && nearWorst === 1;
    outlier = distinguishable
      ? { agentId: worst.agentId, distance: Number((1 - worst.mean).toFixed(3)) }
      : null;
  }

  const conflicts = numericConflicts(list);
  const opposed = contradictions(list);
  const hedged = hedges(list);

  // Меньше двух содержательных ответов — сравнивать не с чем. Отдавать
  // «консенсус» в этом случае значило бы подтвердить непроверенное.
  //
  // Прямое отрицание перевешивает схожесть: «стоит запускать» и «не стоит
  // запускать» состоят из одних и тех же слов, схожесть у них 1.0, и без этого
  // условия карта объявляла бы согласие на самом ярком разногласии.
  const verdict: DissentMap["verdict"] =
    good.length < 2
      ? "insufficient"
      : agreement != null && agreement >= AGREEMENT_THRESHOLD && !conflicts.length && !opposed.length
        ? "consensus"
        : "split";

  const parts = [
    conflicts.length ? `${conflicts.length} числовых` : "",
    opposed.length ? `прямое отрицание по «${opposed.map((c) => c.word).join("», «")}»` : "",
  ].filter(Boolean);

  const note =
    verdict === "insufficient"
      ? `Содержательных ответов ${good.length} — сравнивать не с чем.`
      : verdict === "consensus"
        ? `Агенты сходятся (${agreement}). Совпадение не доказывает правоту: модели ошибаются похоже.`
        : `Расхождение${parts.length ? `, включая ${parts.join(" и ")}` : ""}. Смотреть в первую очередь сюда.`;

  const base = {
    agents: list.length,
    answered: good.length,
    agreement,
    pairs,
    outlier,
    numericConflicts: conflicts,
    contradictions: opposed,
    hedges: hedged,
    verdict,
    note,
  };

  return { ...base, checks: buildChecklist(base) };
}
