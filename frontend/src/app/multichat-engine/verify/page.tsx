"use client";

// Публичная проверка чека мультичата.
//
// Зачем страница: чек, который нельзя проверить, — украшение. Получатель
// артефакта не обязан иметь у нас аккаунт, поэтому ручка проверки публичная, а
// страница открывается без входа.
//
// Честная оговорка, вынесенная в интерфейс: наш ответ «сходится» — это удобство,
// а не доказательство. Доказательство в том, что спецификация открыта
// (RFC8785 + sha256 + ed25519), и любой пересчитает хеш чужой реализацией, не
// доверяя нам вовсе. Мы это прямо и пишем — иначе проверка превращается в
// «поверьте нашей кнопке».

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { T } from "../theme";

type VerifyResult = {
  /** null — хеш к чеку не приложили. Это НЕ то же самое, что «не сходится». */
  hashMatches: boolean | null;
  computedHash: string;
  signature: "valid" | "invalid" | "absent" | "unverifiable";
  signatureNote: string | null;
  spec: { canonicalization: string; digest: string; signature: string };
};


export default function VerifyReceiptPage() {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check(text: string) {
    setBusy(true);
    setError(null);
    setRes(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Это не JSON — вставьте содержимое скачанного файла чека целиком.");
      }
      const r = await fetch(apiUrl("/api/multichat/receipt/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || d?.error || `сервер ответил ${r.status}`);
      setRes(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "проверка не прошла");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    const text = await f.text();
    setRaw(text);
    void check(text);
  }

  // Три состояния, а не два: «сходится», «не сходится» и «сравнивать не с чем».
  // Раньше третье показывалось как второе — человеку с подлинным чеком без
  // приложенного хеша страница заявляла, что содержимое изменено.
  const verdictColor = !res
    ? T.textMute
    : res.hashMatches === null
      ? T.warn
      : res.hashMatches
        ? T.accent
        : T.bad;

  return (
    <main style={{ background: T.canvas, minHeight: "100vh", padding: "48px 20px", color: T.text }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 30, margin: "0 0 8px", fontWeight: 600 }}>Проверка чека</h1>
        <p style={{ fontSize: 15, color: T.textMute, lineHeight: 1.65, margin: "0 0 6px" }}>
          Каждый ответ консилиума AEVION сопровождается чеком: состав панели, хеши ответов,
          карта разногласий и стоимость. Уроните сюда скачанный файл — и увидите, соответствует
          ли содержимое своему хешу.
        </p>
        <p style={{ fontSize: 13, color: T.textFaded, lineHeight: 1.6, margin: "0 0 22px" }}>
          Наш ответ «сходится» — это удобство, а не доказательство. Доказательство в том, что
          спецификация открыта: канонизация RFC8785, дайджест sha256, подпись ed25519. Пересчитайте
          хеш любой сторонней реализацией и не доверяйте этой кнопке.
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onFile(e.dataTransfer.files?.[0]);
          }}
          style={{ border: `1px dashed ${T.lineSoft}`, borderRadius: 12, padding: 14, background: T.surface }}
        >
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            aria-label="Содержимое чека" placeholder="Перетащите файл чека сюда или вставьте его содержимое"
            style={{
              width: "100%", background: "transparent", border: "none", outline: "none",
              color: T.textDim, fontSize: 13, fontFamily: "ui-monospace, monospace", lineHeight: 1.5, resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 12 }}>
          <button
            onClick={() => void check(raw)}
            disabled={busy || raw.trim().length < 10}
            style={{
              background: busy || raw.trim().length < 10 ? T.btnDisabledBg : T.btnAccentBg,
              color: busy || raw.trim().length < 10 ? T.textMute : T.onAccentDeep,
              border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 14, fontWeight: 600,
              cursor: busy || raw.trim().length < 10 ? "default" : "pointer",
            }}
          >
            {busy ? "Считаю…" : "Проверить"}
          </button>
          <label style={{ fontSize: 13, color: T.textFaded, cursor: "pointer" }}>
            <input type="file" accept="application/json,.json" style={{ display: "none" }}
              onChange={(e) => void onFile(e.target.files?.[0] || undefined)} />
            …или выберите файл
          </label>
        </div>

        {error && <p style={{ color: T.bad, fontSize: 14, marginTop: 14 }}>{error}</p>}

        {res && (
          <div style={{ marginTop: 22, background: T.surface, border: `1px solid ${T.lineSoft}`, borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontSize: 20, margin: 0, color: verdictColor }}>
              {res.hashMatches === null
                ? "Хеш не приложен — сравнивать не с чем"
                : res.hashMatches
                  ? "Хеш сходится — содержимое не изменено"
                  : "Хеш НЕ сходится — содержимое изменено"}
            </h2>
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: T.textFaded, margin: "10px 0 0", wordBreak: "break-all" }}>
              пересчитано: {res.computedHash}
            </p>

            <p style={{ fontSize: 14, color: T.textDim, margin: "14px 0 0" }}>
              <span style={{ color: T.textFaded }}>Подпись: </span>
              <span style={{ color: res.signature === "valid" ? T.accent : res.signature === "invalid" ? T.bad : T.warn }}>
                {res.signature === "valid" ? "действительна"
                  : res.signature === "invalid" ? "НЕ действительна"
                    : res.signature === "absent" ? "отсутствует"
                      : "не проверена"}
              </span>
              {res.signatureNote && <span style={{ color: T.textFaded, fontSize: 13 }}> — {res.signatureNote}</span>}
            </p>

            <p style={{ fontSize: 12, color: T.textFaded, margin: "14px 0 0" }}>
              Спецификация: канонизация {res.spec.canonicalization}, дайджест {res.spec.digest},
              подпись {res.spec.signature}.
            </p>

            {res.hashMatches === false && (
              <p style={{ fontSize: 13, color: T.warn, margin: "12px 0 0", lineHeight: 1.6 }}>
                Расхождение означает одно из двух: файл отредактировали после выдачи, либо это чек
                другого ответа. Сравните поле <code>hash</code> в файле с пересчитанным выше.
              </p>
            )}

            {res.hashMatches === null && (
              <p style={{ fontSize: 13, color: T.textDim, margin: "12px 0 0", lineHeight: 1.6 }}>
                Вы принесли сам чек, но без поля <code>hash</code> — это нормальный формат, просто
                сверять нам не с чем. Хеш выше пересчитан по содержимому: сравните его с тем, что
                указан у отправителя. Целиком скачанный файл (<code>receipt</code>, <code>hash</code>,{" "}
                <code>signature</code>) страница сверит сама.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
