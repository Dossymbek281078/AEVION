"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

/**
 * Сбор почты на /go.
 *
 * ЗАЧЕМ. До этого страница предлагала только два исхода: купить сейчас или уйти
 * навсегда. Первой карточкой на ней стоит бесплатный инструмент, поэтому
 * оплаченный клик с высокой вероятностью заканчивался вторым — человек забирал
 * бесплатное и исчезал, не оставив ни продажи, ни возможности написать позже.
 *
 * Это не мелочь удобства, а условие окупаемости. Для товаров за $10–20 прямая
 * продажа с холодного трафика почти не сходится: при отраслевых CPC $0.10–0.60
 * и конверсии 0.5–2% покупка стоит дороже маржи. Схема, которая исторически
 * сходится, — собрать контакт дёшево ($0.30–1.50) и продавать письмами
 * многократно и бесплатно.
 *
 * КАНАЛ ЕДЕТ ВМЕСТЕ С ПОЧТОЙ. `source` уходит как `go:instagram`, а не просто
 * `go`: подписчик без источника отвечает на вопрос «сколько их», но не на
 * вопрос «какой канал их привёл», ради которого метки и заводились.
 */
export function GoSubscribe({ channel }: { channel?: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setMessage(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/newsletter"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: channel ? `go:${channel}` : "go" }),
      });
      if (r.status === 429) {
        // Ограничение по частоте — не ошибка человека, и говорить надо так.
        setState("error");
        setMessage("Слишком много попыток. Попробуйте через несколько минут.");
        return;
      }
      if (r.status === 400) {
        setState("error");
        setMessage("Проверьте адрес — кажется, в нём опечатка.");
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setState("done");
    } catch {
      // Честно про неудачу, а не молчаливое «спасибо»: человек оставил адрес и
      // вправе знать, что он не дошёл.
      setState("error");
      setMessage("Не получилось отправить. Попробуйте ещё раз или напишите нам.");
    }
  }

  if (state === "done") {
    return (
      <div style={styles.done}>
        <div style={styles.doneTitle}>Готово — адрес записан</div>
        <p style={styles.doneText}>
          Пришлём разбор нового материала, когда он выйдет. Не чаще раза в неделю
          и без рекламы чужих продуктов.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={styles.wrap}>
      <div style={styles.kicker}>Бесплатно · письмо</div>
      <div style={styles.title}>Разборы по почте</div>
      <p style={styles.text}>
        Новые материалы о долголетии и привычках — с оценкой доказательности у
        каждого пункта, включая то, что переоценено.
      </p>
      <div style={styles.row}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ваша почта"
          aria-label="Электронная почта"
          style={styles.input}
          disabled={state === "sending"}
        />
        <button type="submit" style={styles.button} disabled={state === "sending"}>
          {state === "sending" ? "Отправляю…" : "Подписаться"}
        </button>
      </div>
      {message && (
        <p role="alert" style={styles.error}>
          {message}
        </p>
      )}
      <p style={styles.note}>Отписаться можно из любого письма.</p>
    </form>
  );
}

/* Тот же светлый газетный стиль, что у карточек на /go. */
const INK = "#16161a";
const MUTED = "#5d5f66";
const RULE = "#ddd9cf";
const GOLD = "#a9781a";

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    background: "#fffdf8",
    border: `1px solid ${RULE}`,
    borderRadius: 4,
    padding: "16px 18px",
    marginBottom: 12,
  },
  kicker: {
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: MUTED,
  },
  title: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.3,
    margin: "6px 0 0",
    color: INK,
  },
  text: { color: MUTED, fontSize: 13.5, lineHeight: 1.55, margin: "6px 0 12px" },
  // Колонкой на телефоне: поле и кнопка в ряд на 360px дают кнопку в два слова
  // и поле, куда не влезает адрес.
  row: { display: "flex", flexDirection: "column", gap: 8 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    fontSize: 16, // меньше 16px — iOS Safari зумит страницу при фокусе
    border: `1px solid ${RULE}`,
    borderRadius: 4,
    background: "#fff",
    color: INK,
  },
  button: {
    width: "100%",
    minHeight: 44, // палец, а не курсор
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "Georgia, serif",
    color: "#fff",
    background: INK,
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  error: { color: "#b5241b", fontSize: 13, lineHeight: 1.5, margin: "10px 0 0" },
  note: { color: MUTED, fontSize: 12, margin: "10px 0 0" },
  done: {
    background: "#fffdf8",
    border: `1px solid ${GOLD}`,
    borderRadius: 4,
    padding: "16px 18px",
    marginBottom: 12,
  },
  doneTitle: {
    fontFamily: "Georgia, serif",
    fontSize: 17,
    fontWeight: 700,
    color: INK,
  },
  doneText: { color: MUTED, fontSize: 13.5, lineHeight: 1.55, margin: "6px 0 0" },
};
