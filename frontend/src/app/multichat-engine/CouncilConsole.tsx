"use client";

// Консилиум — рабочая консоль мультичата.
//
// Зачем отдельным компонентом: способность «один промт → N агентов отвечают
// параллельно» жила только в API (POST /api/multichat/conversations/:id/dispatch)
// и не вызывалась из интерфейса ни разу. Модуль выглядел витриной, хотя ядро
// было готово.
//
// Отличие от рынка — не сам веер, он есть у всех, а то, что мы НЕ причёсываем
// ответы в один. Все продукты синтезируют спор в консенсус и выбрасывают
// разногласие; здесь оно показано ПЕРВЫМ, потому что именно там, где модели
// разошлись, и надо смотреть человеку. Согласие моделей ничего не доказывает:
// они учились на пересекающихся данных и ошибаются одинаково.
//
// Карта разногласий приходит с бэкенда посчитанной из уже полученных ответов,
// без единого дополнительного вызова модели — она бесплатна и воспроизводима.
//
// Стиль инлайновый, цвета — только через токены ./theme (сырых значений в
// модуле нет: контраст проверяется тестом, а литерал проверка не видит).
// Страница переведена на светлый газетный эталон AEVION 2026-07-27.

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { getAuthHeaders, isAuthenticated } from "@/lib/auth";
import { T } from "./theme";
import { agentFailure, agentTitle, retryHint } from "./failureText";

type AgentResult = {
  agentId: string;
  role?: string;
  provider?: string;
  model?: string;
  ok: boolean;
  reply?: string;
  error?: string;
};

type Dissent = {
  agents: number;
  answered: number;
  agreement: number | null;
  outlier: { agentId: string; distance: number } | null;
  numericConflicts: Array<{
    context: string;
    values: Array<{ agentId: string; raw: string; value: number }>;
    spread: number;
  }>;
  /** Слово, которое одни агенты утверждают, а другие при нём же отрицают. */
  contradictions?: Array<{ word: string; affirms: string[]; denies: string[] }>;
  hedges: Array<{ agentId: string; kind: "failed" | "hedged"; note: string }>;
  verdict: "consensus" | "split" | "insufficient";
  note: string;
  /** Что пойти проверить. Порядок — по проверяемости, не по важности. */
  checks?: Array<{ kind: "number" | "outlier" | "hedge" | "failure" | "consensus"; text: string; agents: string[]; weight: 1 | 2 | 3 }>;
};

type SignedReceipt = {
  receipt: Record<string, unknown> & { askedAt: string; cost: { calls: number; answered: number; failed: number } };
  hash: string;
  signature: { algo: string; kid: string; value: string } | null;
  signatureNote: string | null;
};

// Три разные роли, а не одна модель трижды: модели одной семьи ошибаются
// согласованно, и «спор» между ними был бы декорацией.
const PANEL = [
  { id: "analyst", role: "Аналитик — только факты и цифры, без оценок" },
  { id: "skeptic", role: "Скептик — ищет, где рассуждение ломается" },
  { id: "practic", role: "Практик — что делать завтра при ограниченных ресурсах" },
];

// Пример для гостя. Ответы РЕАЛЬНЫЕ по форме: три роли расходятся так, как
// расходятся живые модели — совпадают по словам, но противоречат по числам и
// по выводу. Прогоняются через тот же публичный эндпоинт, что и настоящие,
// поэтому цифры на экране считает алгоритм, а не я. Нарисованные показатели
// разошлись бы с кодом при первой же правке порогов.
const EXAMPLE_PROMPT = "Стоит ли запускать платный тариф до первой продажи?";
const EXAMPLE_ANSWERS = [
  {
    agentId: "analyst",
    provider: "пример",
    ok: true,
    reply:
      "Платный тариф до первой продажи проверяет не спрос, а готовность платить у тех, кто уже пришёл. " +
      "На текущем трафике это примерно 40 посетителей в месяц — выборки не хватит, вывод будет шумом. " +
      "Сначала нужен канал, дающий хотя бы 300 визитов.",
  },
  {
    agentId: "skeptic",
    provider: "пример",
    ok: true,
    reply:
      "Вопрос поставлен неверно. Тариф — это не эксперимент, а обязательство: цену придётся защищать, " +
      "а менять её после запуска дороже, чем кажется. На текущем трафике это примерно 300 посетителей в месяц, " +
      "и всё равно решает не число, а то, за что именно берутся деньги.",
  },
  {
    agentId: "practic",
    provider: "пример",
    ok: true,
    reply:
      "Не уверен, что это вообще развилка сегодня. Запустите платёжную ссылку на один модуль и покажите её " +
      "десяти живым людям — узнаете больше, чем из любого тарифа. Тариф соберёте после первой оплаты.",
  },
];


/** Скачивание одним способом на весь модуль: две реализации подряд разъезжаются
 *  на первой же правке имени файла или типа. */
function download(name: string, text: string, mime: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Читаемый отчёт по консилиуму.
 *
 *  Чек — артефакт машинный: его отдают на проверку, но не читают и не
 *  пересылают коллеге. Отчёт закрывает вторую половину задачи: что спросили,
 *  кто что ответил, где разошлись, что проверить — и хеш чека рядом, чтобы
 *  получатель мог сверить подлинность, не веря отчёту на слово.
 *
 *  Markdown, а не PDF: открывается везде, вставляется в задачу или письмо без
 *  конвертации, и его видно в diff, если положат в репозиторий. */
function buildReport(
  prompt: string,
  results: AgentResult[],
  dissent: Dissent | null,
  receipt: SignedReceipt | null,
  isExample: boolean
): string {
  const L: string[] = [];
  L.push("# Консилиум AEVION", "");
  if (isExample) L.push("> Это пример: ответы агентов заданы заранее, разногласия посчитаны настоящим алгоритмом.", "");
  L.push(`**Вопрос:** ${prompt}`, "");

  if (dissent) {
    const verdict =
      dissent.verdict === "consensus" ? "агенты сошлись"
        : dissent.verdict === "split" ? "агенты разошлись"
          : "сравнивать не с чем";
    L.push(`## Итог: ${verdict}`, "", dissent.note, "");
    if (dissent.agreement != null) L.push(`Схожесть ответов: ${dissent.agreement}`, "");
    if (dissent.outlier) L.push(`Дальше всех от остальных: **${dissent.outlier.agentId}**`, "");

    if (dissent.contradictions?.length) {
      L.push("### Прямое противоречие", "");
      for (const c of dissent.contradictions) {
        L.push(`- «${c.word}»: ${c.affirms.join(", ")} утверждает, ${c.denies.join(", ")} отрицает`);
      }
      L.push("");
    }

    if (dissent.numericConflicts.length) {
      L.push("### Расхождения в числах", "");
      for (const c of dissent.numericConflicts) {
        L.push(`- ${c.values.map((v) => `${v.agentId}: ${v.raw}`).join(" против ")} (разброс ${c.spread})`);
        L.push(`  - контекст: «${c.context}»`);
      }
      L.push("");
    }

    if (dissent.checks?.length) {
      L.push("### Что проверить", "", "Порядок — по проверяемости: сверху то, что закрывается за минуту.", "");
      dissent.checks.forEach((c, i) => L.push(`${i + 1}. ${c.text}`));
      L.push("");
    }
  }

  L.push("## Ответы агентов", "");
  for (const r of results) {
    // Роль и человеческая причина: отчёт уходит коллеге, и «rate_limit_exceeded
    // ... per IP» в нём читается как вина отправителя.
    L.push(`### ${agentTitle(r.role, r.agentId)}${r.provider ? ` · ${r.provider}` : ""}`, "");
    if (r.ok) {
      L.push(String(r.reply || "").trim(), "");
    } else {
      const f = agentFailure(r.error);
      L.push(`_Не ответил: ${f.human}_${f.technical ? ` (${f.technical})` : ""}`, "");
    }
  }

  if (receipt) {
    L.push("## Чек", "");
    L.push(`- sha256: \`${receipt.hash}\``);
    L.push(`- канонизация: RFC8785, дайджест sha256`);
    L.push(`- подпись: ${receipt.signature ? `${receipt.signature.algo}, ключ ${receipt.signature.kid}` : receipt.signatureNote || "отсутствует"}`);
    L.push(`- вызовов ${receipt.receipt.cost.calls}, ответили ${receipt.receipt.cost.answered}, не ответили ${receipt.receipt.cost.failed}`);
    L.push("");
    L.push("Отчёту верить не обязательно: скачайте чек и пересчитайте хеш — сами или сторонней реализацией. Спецификация открыта.", "");
  }

  return L.join("\n");
}

export function CouncilConsole({ seed }: { seed?: string | null } = {}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<AgentResult[] | null>(null);
  const [dissent, setDissent] = useState<Dissent | null>(null);
  const [receipt, setReceipt] = useState<SignedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [isExample, setIsExample] = useState(false);

  // isAuthenticated читает localStorage — на сервере его нет, поэтому состояние
  // определяем ПОСЛЕ монтирования: иначе разметка сервера и клиента разойдутся
  // и React выдаст ошибку гидрации. Именно эффект, а не вызов в рендере —
  // setState во время рендера работает, но остаётся источником тихих циклов.
  useEffect(() => setAuthed(isAuthenticated()), []);

  // Задание из витрины выше кладётся в поле здесь, а не уводит на другую
  // страницу. Затираем только пустое поле: если человек уже что-то написал,
  // его текст важнее выбранной карточки.
  useEffect(() => {
    if (!seed) return;
    setPrompt((cur) => (cur.trim() ? cur : seed));
  }, [seed]);

  const disabled = busy || prompt.trim().length < 5 || authed !== true;

  async function ask() {
    const q = prompt.trim();
    if (q.length < 5 || busy) return;
    setBusy(true);
    setError(null);
    setIsExample(false);
    // Прошлый результат снимаем ДО запроса, а не после успешного ответа.
    //
    // Иначе так: гость смотрит пример, входит, задаёт свой вопрос — пометка
    // «это пример» гаснет сразу, а ответы примера остаются висеть. Если
    // запрос не прошёл, он читает чужой заранее заданный текст как ответ на
    // свой вопрос: сверху полная карта разногласий, внизу мелкая строка
    // ошибки. То же между двумя своими вопросами — в поле новый, на экране
    // ответы на старый.
    setResults(null);
    setDissent(null);
    setReceipt(null);
    try {
      const conv = await fetch(apiUrl("/api/multichat/conversations"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ title: q.slice(0, 80) }),
      }).then((r) => r.json());
      if (!conv?.id) throw new Error(conv?.error || "не удалось создать беседу");

      const r = await fetch(apiUrl(`/api/multichat/conversations/${conv.id}/dispatch`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ prompt: q, agents: PANEL }),
      });
      const d = await r.json();
      if (!r.ok) {
        // retryAfterSec сервер присылает рядом с отказом — не показать его значит
        // заставить человека угадывать, когда пробовать снова.
        const f = agentFailure(d?.error || `upstream ${r.status}`);
        throw new Error(f.human + retryHint(d?.retryAfterSec));
      }
      setResults(d.results || []);
      setDissent(d.dissent || null);
      setReceipt(d.receipt || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "запрос не прошёл");
    } finally {
      setBusy(false);
    }
  }

  // Пример без входа. Ответы заранее заданы (иначе гость тратил бы наши токены),
  // но карта разногласий считается НА СЕРВЕРЕ тем же публичным эндпоинтом, что и
  // для настоящего консилиума. Поэтому гость видит работу настоящего алгоритма,
  // а не картинку: поменяются пороги — поменяются и цифры в примере.
  async function runExample() {
    if (busy) return;
    setBusy(true);
    setError(null);
    // Симметрично ask(): если пример не загрузится, на экране не должен
    // остаться прошлый настоящий прогон — он там уже без своего вопроса.
    setResults(null);
    setDissent(null);
    setReceipt(null);
    setIsExample(false);
    try {
      const r = await fetch(apiUrl("/api/multichat/dissent/preview"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: EXAMPLE_ANSWERS }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `сервер ответил ${r.status}`);
      setPrompt(EXAMPLE_PROMPT);
      setResults(EXAMPLE_ANSWERS);
      setDissent(d.dissent || null);
      setReceipt(null); // чека у примера нет: ответы не наши, платить и подписывать нечего
      setIsExample(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "пример не загрузился");
    } finally {
      setBusy(false);
    }
  }

  const verdictLabel =
    dissent?.verdict === "consensus"
      ? "Агенты сошлись"
      : dissent?.verdict === "split"
        ? "Агенты разошлись"
        : "Сравнивать не с чем";

  return (
    <section style={{ marginTop: 32, paddingTop: 28, borderTop: `1px solid ${T.surfaceSoft}` }}>
      <h2 style={{ fontSize: 24, color: T.text, margin: "0 0 6px", fontWeight: 600 }}>Консилиум</h2>
      <p style={{ fontSize: 15, color: T.textMute, lineHeight: 1.6, maxWidth: 720, margin: "0 0 18px" }}>
        Опишите задачу — три агента с разными ролями ответят независимо. Мы не сводим их в один
        причёсанный ответ: сначала показываем, <span style={{ color: T.accent }}>где они разошлись</span>, потому
        что именно там ответу нельзя верить на слово.
      </p>

      <textarea
        aria-label="Вопрос совету"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="Например: стоит ли запускать платный тариф до первой продажи?"
        style={{
          width: "100%", background: T.surface, border: `1px solid ${T.lineSoft}`, borderRadius: 10,
          padding: 12, fontSize: 14, lineHeight: 1.6, color: T.text, fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 10 }}>
        <button
          onClick={ask}
          disabled={disabled}
          style={{
            background: disabled ? T.btnDisabledBg : T.btnAccentBg,
            color: disabled ? T.textMute : T.onAccentDeep,
            border: "none", borderRadius: 10, padding: "9px 18px",
            fontSize: 14, fontWeight: 600, cursor: disabled ? "default" : "pointer",
          }}
        >
          {busy ? "Агенты отвечают…" : "Спросить консилиум"}
        </button>
        <button
          onClick={runExample}
          disabled={busy}
          style={{
            background: "transparent", color: busy ? T.textFaded : T.textDim,
            border: `1px solid ${T.lineSoft}`, borderRadius: 10, padding: "9px 16px",
            fontSize: 14, cursor: busy ? "default" : "pointer",
          }}
        >
          Показать на примере
        </button>
        <span style={{ fontSize: 12, color: T.textFaded }}>
          {authed === false
            ? "Свой запрос — после входа: консилиум расходует токены. Пример открыт всем"
            : "3 агента · 3 вызова · ответы независимы"}
        </span>
      </div>
      {error && <p style={{ fontSize: 12, color: T.bad, margin: "8px 0 0" }}>{error}</p>}

      {/* Пометка обязательна: принять пример за свой прогон — то же самое, что
          показать нарисованный результат. */}
      {isExample && (
        <p style={{ fontSize: 12, color: T.warn, margin: "12px 0 0", lineHeight: 1.6, maxWidth: 720 }}>
          Это пример: ответы трёх агентов заданы заранее, а разногласия ниже посчитаны
          на сервере тем же алгоритмом, что и для настоящего запроса. Свой вопрос —
          после входа.
        </p>
      )}

      {/* Карта разногласий стоит ПЕРЕД ответами — она и есть продукт. */}
      {dissent && (
        <div style={{ marginTop: 22, background: T.surface, border: `1px solid ${T.lineSoft}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
            <h3 style={{ fontSize: 18, margin: 0, color: dissent.verdict === "split" ? T.bad : T.accent }}>
              {verdictLabel}
            </h3>
            {dissent.agreement != null && (
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: T.textFaded }}>
                схожесть {dissent.agreement}
              </span>
            )}
            <span style={{ fontSize: 12, color: T.textMute }}>{dissent.note}</span>
          </div>

          {/* Прямое отрицание — выше чисел: «делать» против «не делать» решает
              больше, чем разница в цифре. И оно единственное разногласие, при
              котором схожесть остаётся высокой: ответы состоят из одних и тех
              же слов. Без этой строки человек читает «схожесть 1» и уходит. */}
          {dissent.contradictions && dissent.contradictions.length > 0 && (
            <>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: T.textFaded, margin: "14px 0 6px" }}>
                Прямое противоречие
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
                {dissent.contradictions.slice(0, 5).map((c, i) => (
                  <li key={i} style={{ borderBottom: `1px dotted ${T.lineSoft}`, padding: "5px 0", color: T.text }}>
                    <span style={{ color: T.bad, fontWeight: 600 }}>«{c.word}»</span>
                    <span style={{ color: T.textDim }}>
                      {" "}— {c.affirms.join(", ")} утверждает, {c.denies.join(", ")} отрицает
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {dissent.numericConflicts.length > 0 && (
            <>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: T.textFaded, margin: "14px 0 6px" }}>
                Расхождения в числах
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
                {dissent.numericConflicts.slice(0, 5).map((c, i) => (
                  <li key={i} style={{ borderBottom: `1px dotted ${T.lineSoft}`, padding: "5px 0" }}>
                    <span style={{ color: T.text }}>
                      {c.values.map((v) => `${v.agentId}: ${v.raw}`).join("  ·  ")}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: T.textFaded }}>«{c.context}»</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {dissent.outlier && (
            <p style={{ fontSize: 14, color: T.textDim, margin: "14px 0 0" }}>
              <span style={{ color: T.textFaded }}>Особняком: </span>
              <span style={{ color: T.warn }}>{dissent.outlier.agentId}</span>
              <span style={{ fontSize: 12, color: T.textFaded }}>
                {" "}— его ответ дальше всех от остальных. Это не «неправ», это «прочитать первым».
              </span>
            </p>
          )}

          {dissent.hedges.length > 0 && (
            <p style={{ fontSize: 14, color: T.textDim, margin: "8px 0 0" }}>
              <span style={{ color: T.textFaded }}>Осторожность и отказы: </span>
              {dissent.hedges.map((h) => `${h.agentId} (${h.kind === "failed" ? "не ответил" : h.note})`).join(", ")}
            </p>
          )}

          {/* Карта разногласий — диагноз; человеку нужен следующий шаг. Список
              стоит последним в блоке намеренно: сначала «где разошлись», потом
              «что с этим делать», иначе совет читается без основания. */}
          {dissent.checks && dissent.checks.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.lineSoft}` }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: T.textFaded, margin: "0 0 8px" }}>
                Что проверить
              </p>
              <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 7 }}>
                {dissent.checks.map((c, i) => (
                  <li key={i} style={{ fontSize: 14, color: T.textDim, lineHeight: 1.55 }}>
                    {c.text}
                  </li>
                ))}
              </ol>
              <p style={{ fontSize: 11, color: T.textFaded, margin: "10px 0 0" }}>
                Порядок — по проверяемости: сверху то, что закрывается за минуту.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Чек: происхождение ответа. Ответ без него — мнение; с ним — то, что
          можно предъявить. Хеш пересчитывается кем угодно из скачанного файла. */}
      {receipt && (
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, fontSize: 12, color: T.textFaded }}>
          <span>
            Чек · вызовов {receipt.receipt.cost.calls}, ответили {receipt.receipt.cost.answered}
            {receipt.receipt.cost.failed > 0 ? `, не ответили ${receipt.receipt.cost.failed}` : ""}
          </span>
          <span style={{ fontFamily: "ui-monospace, monospace" }}>sha256 {receipt.hash.slice(0, 16)}…</span>
          <span style={{ color: receipt.signature ? T.accent : T.warn }}>
            {receipt.signature ? `подписан (${receipt.signature.algo}, ${receipt.signature.kid})` : receipt.signatureNote}
          </span>
          <button
            onClick={() =>
              download(`aevion-receipt-${receipt.hash.slice(0, 12)}.json`, JSON.stringify(receipt, null, 2), "application/json")
            }
            style={{ background: "transparent", border: `1px solid ${T.lineSoft}`, borderRadius: 8, padding: "4px 10px", color: T.textDim, fontSize: 12, cursor: "pointer" }}
          >
            Скачать чек
          </button>
          <a href="/multichat-engine/verify" style={{ color: T.textMute, fontSize: 12, textDecoration: "underline" }}>
            проверить чек
          </a>
        </div>
      )}

      {/* Отчёт доступен и без чека — например, у примера для гостя: пересылать
          коллеге разбор осмысленно и тогда, когда подписывать нечего. */}
      {results && results.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() =>
              download(
                `aevion-consilium-${(receipt?.hash || "example").slice(0, 12)}.md`,
                buildReport(prompt, results, dissent, receipt, isExample),
                "text/markdown;charset=utf-8"
              )
            }
            style={{ background: "transparent", border: `1px solid ${T.lineSoft}`, borderRadius: 8, padding: "6px 12px", color: T.textDim, fontSize: 13, cursor: "pointer" }}
          >
            Скачать отчёт
          </button>
          <span style={{ fontSize: 12, color: T.textFaded, marginLeft: 10 }}>
            Markdown: вопрос, разногласия, что проверить, ответы и хеш чека
          </span>
        </div>
      )}

      {results && (
        <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {results.map((r) => (
            <article key={r.agentId} style={{ background: T.surface, border: `1px solid ${T.lineSoft}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `1px solid ${T.surfaceSoft}`, paddingBottom: 6 }}>
                {/* Роль, а не внутренний id: «analyst» в русском интерфейсе выглядит
                    утечкой кода, а роль сервер и так присылает в ответе. */}
                <h4 style={{ fontSize: 15, margin: 0, color: T.text }}>{agentTitle(r.role, r.agentId)}</h4>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: T.textFaded }}>
                  {r.provider || "—"}
                </span>
              </div>
              <p style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.65, color: T.textDim }}>
                {r.ok ? (
                  r.reply
                ) : (
                  // Причина по-русски, исходная строка сервера мелким рядом:
                  // прятать её нельзя, иначе отчёт человека об ошибке бесполезен.
                  <span style={{ color: T.bad }}>
                    {agentFailure(r.error).human}
                    {agentFailure(r.error).technical && (
                      <span style={{ display: "block", marginTop: 6, fontSize: 11, color: T.textFaded }}>
                        {agentFailure(r.error).technical}
                      </span>
                    )}
                  </span>
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
