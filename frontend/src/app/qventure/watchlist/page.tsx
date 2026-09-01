"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { VERDICT_COLOR, VERDICT_LABEL, SECTION, H2, type Verdict } from "../_result";
import { getWatchlist, removeFromWatchlist, syncWatchlist, type WatchlistItem } from "../_watchlist";
import { isAuthenticated } from "@/lib/auth";

type SortKey = "composite" | "savedAt" | "name";

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [sort, setSort] = useState<SortKey>("composite");
  const [ready, setReady] = useState(false);
  const [synced, setSynced] = useState(isAuthenticated());

  const refresh = useCallback(() => setItems(getWatchlist()), []);

  useEffect(() => {
    refresh();
    setReady(true);
    // Pull the cross-device list and migrate any browser-only items up. On
    // sign-out or error this resolves to the local list and updates nothing new.
    void syncWatchlist().then((merged) => { setItems(merged); setSynced(isAuthenticated()); });
    const h = () => refresh();
    window.addEventListener("qventure:watchlist", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("qventure:watchlist", h);
      window.removeEventListener("storage", h);
    };
  }, [refresh]);

  const sorted = [...items].sort((a, b) => {
    if (sort === "composite") return b.composite - a.composite;
    if (sort === "name") return a.name.localeCompare(b.name);
    return b.savedAt.localeCompare(a.savedAt);
  });

  const remove = (id: string) => { removeFromWatchlist(id); refresh(); };

  const avg = items.length ? Math.round((items.reduce((s, x) => s + x.composite, 0) / items.length) * 10) / 10 : 0;
  const invest = items.filter((x) => x.verdict === "invest").length;

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal-deep, #075b53)", letterSpacing: 1, textTransform: "uppercase" }}>AEVION · QVenture</div>
            <h1 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 800, color: "var(--ink, #17181a)" }}>Список наблюдения</h1>
          </div>
          <Link href="/qventure" style={{ padding: "9px 18px", background: "var(--teal-deep, #075b53)", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
            + Analyze a deal
          </Link>
        </div>

        {!ready ? null : items.length === 0 ? (
          <div style={{ ...SECTION, textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>☆</div>
            <h2 style={{ ...H2, marginBottom: 6 }}>Пока ничего не сохранено</h2>
            <p style={{ color: "var(--ink-faint, #74767c)", margin: "0 0 16px" }}>Запустите разбор и нажмите <strong>Сохранить в список</strong> — сделка появится здесь.</p>
            <Link href="/qventure" style={{ display: "inline-block", padding: "10px 22px", background: "var(--teal-deep, #075b53)", color: "#fff", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}>
              Разобрать первую сделку →
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {[
                { k: "Сделок в наблюдении", v: String(items.length) },
                { k: "Средняя оценка", v: String(avg) },
                { k: "С вердиктом «инвестируем»", v: String(invest) },
              ].map((s) => (
                <div key={s.k} style={{ flex: "1 1 140px", background: "var(--paper-2, #efeee8)", border: "1px solid var(--rule, #d4d3cc)", borderRadius: 12, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: "var(--ink-faint, #74767c)", textTransform: "uppercase", letterSpacing: 0.5 }}>{s.k}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink, #17181a)" }}>{s.v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: "var(--ink-faint, #74767c)" }}>Сортировать по</span>
              {(["composite", "savedAt", "name"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setSort(k)} style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: "1px solid " + (sort === k ? "var(--teal-deep, #075b53)" : "var(--rule, #d4d3cc)"),
                  background: sort === k ? "#f5f3ff" : "#fff",
                  color: sort === k ? "var(--teal-deep, #075b53)" : "var(--ink-faint, #74767c)",
                }}>
                  {k === "composite" ? "Score" : k === "savedAt" ? "Недавно сохранённые" : "Name"}
                </button>
              ))}
            </div>

            <div style={{ ...SECTION, padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 620 }}>
                  <thead>
                    <tr style={{ background: "var(--paper-2, #efeee8)", textAlign: "left", color: "var(--ink-faint, #74767c)", fontSize: 12 }}>
                      <th style={{ padding: "10px 14px" }}>Компания</th>
                      <th style={{ padding: "10px 14px" }}>Отрасль</th>
                      <th style={{ padding: "10px 14px" }}>Стадия</th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>Оценка</th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>Вердикт</th>
                      <th style={{ padding: "10px 14px" }}>Сохранено</th>
                      <th style={{ padding: "10px 14px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((it) => (
                      <tr key={it.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--ink, #17181a)" }}>
                          <Link href={`/qventure/a/${it.id}`} style={{ color: "var(--ink, #17181a)", textDecoration: "none" }}>{it.name}</Link>
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--ink-soft, #45474c)" }}>{it.sector}</td>
                        <td style={{ padding: "10px 14px", color: "var(--ink-soft, #45474c)" }}>{it.stage}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: "var(--ink, #17181a)" }}>{it.composite}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 999, background: VERDICT_COLOR[it.verdict as Verdict] ?? "var(--ink-faint, #74767c)", color: "#fff", fontWeight: 800, fontSize: 11 }}>
                            {VERDICT_LABEL[it.verdict as Verdict] ?? it.verdict.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "var(--ink-faint, #74767c)", fontSize: 12.5 }}>{it.savedAt.slice(0, 10)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <Link href={`/qventure/a/${it.id}`} style={{ color: "var(--teal-deep, #075b53)", fontWeight: 700, textDecoration: "none", marginRight: 12, fontSize: 12.5 }}>Открыть →</Link>
                          <button type="button" onClick={() => remove(it.id)} style={{ border: "none", background: "none", color: "var(--ink-faint, #74767c)", cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>Убрать</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--ink-faint, #74767c)", marginTop: 12 }}>
              {synced
                ? "Your watchlist is saved to your account and synced across devices. Open links share the public report for each deal."
                : "Your watchlist is stored privately in this browser. Sign in to sync it across devices. Open links share the public report for each deal."}
            </p>
          </>
        )}
      </ProductPageShell>
    </>
  );
}
