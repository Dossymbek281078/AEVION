"use client";

import { useState } from "react";
import type { Claim, CompetitorSet, Verdict } from "@/lib/competitors";
import { unverifiedCount } from "@/lib/competitors";

// Таблица сравнения с аналогами. Единственное, ради чего она устроена именно так:
// зритель должен по виду ячейки понимать, ЧЕМ она подкреплена, не читая
// пояснений. Измеренное у нас — со ссылкой на живую ручку. Непроверенное чужое —
// приглушённое и с оговоркой. Если это стереть, таблица станет обычной
// маркетинговой, а такие в питче не работают дважды.

const SRC_STYLE: Record<Claim["source"], { color: string; label: string; title: string }> = {
  measured: {
    color: "#2dd4bf",
    label: "замерено",
    title: "Наше число из фактического прогона. Ссылка ведёт на ручку, которой его можно перепроверить прямо сейчас.",
  },
  public: {
    color: "#93a4bd",
    label: "публичный факт",
    title: "Бесспорный публичный факт: чем компания является, что говорит регламент. Не оценка продукта.",
  },
  unverified: {
    color: "#c8964f",
    label: "не проверяли",
    title: "Мы этого НЕ проверяли. Показано как незакрытый вопрос, а не как факт о чужом продукте.",
  },
};

const VERDICT: Record<Verdict, { mark: string; color: string; text: string }> = {
  ours: { mark: "▲", color: "#2dd4bf", text: "сильнее у нас" },
  theirs: { mark: "▼", color: "#fb7185", text: "сильнее у них" },
  different: { mark: "≠", color: "#93a4bd", text: "сравнивать некорректно" },
};

function Cell({ claim }: { claim: Claim }) {
  const s = SRC_STYLE[claim.source];
  const dim = claim.source === "unverified";
  return (
    <div style={{ opacity: dim ? 0.72 : 1 }}>
      <div style={{ color: dim ? "#93a4bd" : "#dbe6f3", fontStyle: dim ? "italic" : "normal", lineHeight: 1.45 }}>
        {claim.text}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: s.color }} title={s.title}>
        {claim.href ? (
          <a href={claim.href} target="_blank" rel="noreferrer" style={{ color: s.color, textDecoration: "underline dotted" }}>
            {s.label} · проверить
          </a>
        ) : (
          <span style={{ textDecoration: "underline dotted", cursor: "help" }}>{s.label}</span>
        )}
      </div>
    </div>
  );
}

export function CompetitorMatrix({ set }: { set: CompetitorSet }) {
  const [open, setOpen] = useState(true);
  const unverified = unverifiedCount(set);

  return (
    <section style={{ background: "#0d1420", border: "1px solid #1e2836", borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer",
          padding: "14px 16px", color: "#dbe6f3", fontSize: 15, fontWeight: 600,
        }}
      >
        {open ? "▾" : "▸"} {set.title}
        <span style={{ color: "#93a4bd", fontWeight: 400, fontSize: 13 }}>
          {" "}— чем отличаемся и где слабее
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ color: "#93a4bd", fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
            С кем сравниваем:{" "}
            {set.peers.map((p, i) => (
              <span key={p.name}>
                <b style={{ color: "#dbe6f3" }}>{p.name}</b> — {p.kind}
                {i < set.peers.length - 1 ? "; " : "."}
              </span>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#93a4bd", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px 8px 0", fontWeight: 500, width: "22%" }}>Ось</th>
                  <th style={{ padding: "8px 10px", fontWeight: 500, width: "34%" }}>AEVION</th>
                  <th style={{ padding: "8px 10px", fontWeight: 500, width: "34%" }}>Аналоги</th>
                  <th style={{ padding: "8px 0 8px 10px", fontWeight: 500, width: "10%" }}>Итог</th>
                </tr>
              </thead>
              <tbody>
                {set.rows.map((r) => {
                  const v = VERDICT[r.verdict];
                  return (
                    <tr key={r.axis} style={{ borderTop: "1px solid #1e2836", verticalAlign: "top" }}>
                      <td style={{ padding: "12px 10px 12px 0", color: "#dbe6f3" }}>
                        {r.axis}
                        {r.why && (
                          <div style={{ color: "#93a4bd", fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{r.why}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 10px" }}><Cell claim={r.ours} /></td>
                      <td style={{ padding: "12px 10px" }}><Cell claim={r.theirs} /></td>
                      <td style={{ padding: "12px 0 12px 10px", color: v.color, whiteSpace: "nowrap" }} title={v.text}>
                        {v.mark} <span style={{ fontSize: 11 }}>{v.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: "#131c2a", borderLeft: "3px solid #fb7185", borderRadius: 4 }}>
            <div style={{ color: "#fb7185", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Где мы объективно слабее
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#c3d0e0", fontSize: 13, lineHeight: 1.6 }}>
              {set.weaknesses.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>

          <div style={{ marginTop: 12, color: "#93a4bd", fontSize: 11, lineHeight: 1.5 }}>
            Про себя мы утверждаем конкретно — каждое число открыто ручкой и перепроверяется. Про чужой
            продукт утверждаем только то, что он публично о себе говорит, и никогда не заявляем, что у
            него чего-то нет: отсутствие функции проверить нельзя.
            {unverified > 0 && (
              <>
                {" "}Незакрытых ячеек: <b style={{ color: "#c8964f" }}>{unverified}</b> — помечены «не проверяли».
              </>
            )}
            {set.todo?.length ? (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {set.todo.map((t) => <li key={t}>{t}</li>)}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
