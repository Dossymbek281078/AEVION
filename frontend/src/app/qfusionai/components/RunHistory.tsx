"use client";

import { useCallback, useEffect, useState } from "react";
import { fusionClientId } from "./fusionClient";

interface RunPreviewRow {
  id: string;
  prompt: string;
  strategy: string | null;
  provider: string | null;
  provider_name: string | null;
  model: string | null;
  reply_preview: string | null;
  reply_len: number;
  latency_ms: number | null;
  tokens_estimate: number | null;
  decision_reason: string | null;
  created_at: string;
}

interface RunFull extends Omit<RunPreviewRow, "reply_preview" | "reply_len"> {
  reply: string;
}

/** Persisted fusion run history for this anonymous client. Reads
 *  GET /runs?clientId=…; expands a row to fetch the full reply via /runs/:id. */
export default function RunHistory({ refreshTick }: { refreshTick: number }) {
  const [runs, setRuns] = useState<RunPreviewRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [full, setFull] = useState<Record<string, RunFull>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const cid = fusionClientId();
    if (!cid) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api-backend/api/qfusionai/runs?clientId=${encodeURIComponent(cid)}&limit=20`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setRuns(Array.isArray(j.runs) ? j.runs : []);
      }
    } catch { /* keep prior list */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load, refreshTick]);

  async function toggle(id: string) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!full[id]) {
      const cid = fusionClientId();
      try {
        const r = await fetch(`/api-backend/api/qfusionai/runs/${encodeURIComponent(id)}?clientId=${encodeURIComponent(cid)}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (j.run) setFull((prev) => ({ ...prev, [id]: j.run as RunFull }));
        }
      } catch { /* ignore */ }
    }
  }

  return (
    <div style={{ background: "#030a03", border: "1px solid #1a2a1a", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ color: "#88cc88", fontSize: 15, fontWeight: 700, margin: 0 }}>
          История прогонов
        </h3>
        <button onClick={() => void load()}
          style={{ background: "none", border: "1px solid #1a2a1a", borderRadius: 6, color: "#446644", fontSize: 11, cursor: "pointer", padding: "3px 10px", fontFamily: "monospace" }}>
          ⟳ Обновить
        </button>
      </div>
      <p style={{ color: "#334433", fontSize: 11, margin: "0 0 12px", fontFamily: "monospace" }}>
        Только твои запросы (анонимный client-id в этом браузере). GET <code style={{ color: "#446644" }}>/api/qfusionai/runs</code>
      </p>

      {loading && runs.length === 0 ? (
        <div style={{ color: "#334433", fontSize: 12, fontFamily: "monospace" }}>Загрузка…</div>
      ) : runs.length === 0 ? (
        <div style={{ color: "#334433", fontSize: 12, fontFamily: "monospace" }}>
          Пока нет сохранённых прогонов. Запусти запрос выше — он появится здесь.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {runs.map((run) => {
            const isOpen = openId === run.id;
            const f = full[run.id];
            return (
              <div key={run.id} style={{ background: "#020602", border: "1px solid #12210f", borderRadius: 8, overflow: "hidden" }}>
                <button
                  onClick={() => void toggle(run.id)}
                  style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}
                >
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ color: "#00ff88", fontSize: 10, fontFamily: "monospace", border: "1px solid #00ff8833", borderRadius: 4, padding: "1px 6px" }}>
                      {run.provider_name ?? run.provider ?? "—"}
                    </span>
                    <span style={{ color: "#cc88ff", fontSize: 10, fontFamily: "monospace", border: "1px solid #cc88ff33", borderRadius: 4, padding: "1px 6px" }}>
                      {run.strategy}
                    </span>
                    <span style={{ color: "#aaaa44", fontSize: 10, fontFamily: "monospace" }}>{run.latency_ms}ms</span>
                    <span style={{ color: "#334433", fontSize: 10, fontFamily: "monospace", marginLeft: "auto" }}>
                      {new Date(run.created_at).toLocaleString("ru")}
                    </span>
                  </div>
                  <div style={{ color: "#88cc88", fontSize: 12, fontFamily: "monospace", lineHeight: 1.4 }}>
                    {run.prompt.length > 120 ? run.prompt.slice(0, 120) + "…" : run.prompt}
                  </div>
                  {!isOpen && (
                    <div style={{ color: "#557755", fontSize: 11, fontFamily: "monospace", lineHeight: 1.5 }}>
                      {run.reply_preview}{run.reply_len > (run.reply_preview?.length ?? 0) ? "…" : ""}
                    </div>
                  )}
                </button>
                {isOpen && (
                  <div style={{ borderTop: "1px solid #12210f", padding: "10px 12px", background: "#010401" }}>
                    {run.decision_reason && (
                      <div style={{ color: "#446644", fontSize: 10, fontFamily: "monospace", fontStyle: "italic", marginBottom: 8 }}>
                        Decision: {run.decision_reason}
                      </div>
                    )}
                    <div style={{ color: "#aaccaa", fontSize: 13, fontFamily: "monospace", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {f ? f.reply : "Загрузка полного ответа…"}
                    </div>
                    <div style={{ color: "#334433", fontSize: 10, fontFamily: "monospace", marginTop: 8 }}>
                      {run.model} · ~{run.tokens_estimate} tokens
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
