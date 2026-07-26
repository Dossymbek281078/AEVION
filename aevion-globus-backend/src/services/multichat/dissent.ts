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

export type NumericClaim = { value: number; raw: string; context: string };

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
    out.push({ value: num, raw, context: sentenceAround(src, m.index, raw.length) });
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
      if (similarity(all[i].context, all[j].context) >= minContextSim) group.push(j);
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
  /** Куда смотреть человеку в первую очередь. */
  verdict: "consensus" | "split" | "insufficient";
  note: string;
};

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

  const conflicts = numericConflicts(list);
  const hedged = hedges(list);

  // Меньше двух содержательных ответов — сравнивать не с чем. Отдавать
  // «консенсус» в этом случае значило бы подтвердить непроверенное.
  const verdict: DissentMap["verdict"] =
    good.length < 2 ? "insufficient" : agreement != null && agreement >= AGREEMENT_THRESHOLD && !conflicts.length ? "consensus" : "split";

  const note =
    verdict === "insufficient"
      ? `Содержательных ответов ${good.length} — сравнивать не с чем.`
      : verdict === "consensus"
        ? `Агенты сходятся (${agreement}). Совпадение не доказывает правоту: модели ошибаются похоже.`
        : `Расхождение${conflicts.length ? `, включая ${conflicts.length} числовых` : ""}. Смотреть в первую очередь сюда.`;

  return {
    agents: list.length,
    answered: good.length,
    agreement,
    pairs,
    outlier,
    numericConflicts: conflicts,
    hedges: hedged,
    verdict,
    note,
  };
}
