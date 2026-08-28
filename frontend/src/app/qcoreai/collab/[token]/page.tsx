"use client";

/**
 * Страница по ссылке совместного просмотра QCoreAI.
 *
 * До 28.08.2026 её НЕ СУЩЕСТВОВАЛО. Бэкенд выдавал владельцу ссылку вида
 * https://aevion.app/qcoreai/collab/<токен>, человек отправлял её коллеге, и
 * коллега получал страницу 404. Проверено на живом сайте: адрес отвечал 404,
 * тогда как /qcoreai отвечал 200 — то есть возможность была сломана на
 * последнем шаге, и сломана молча.
 *
 * Страница ПУБЛИЧНАЯ: у смотрящего нет ни аккаунта, ни токена. Всё, что она
 * показывает, приходит одной ручкой GET /api/qcoreai/collab/:token, и ручка
 * сама решает, что показывать постороннему.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

type Run = {
  id: string;
  userInput: string | null;
  status: string;
  createdAt: string | null;
};

type Snapshot = {
  session: { id: string; title: string | null; createdAt: string } | null;
  runs: Run[];
  viewers: number;
};

/** Три разных исхода, а не два: «не знаю» отличается и от данных, и от отказа. */
type State =
  | { kind: "loading" }
  | { kind: "ok"; data: Snapshot }
  | { kind: "gone" }
  | { kind: "error"; message: string };

const STATUS_LABEL: Record<string, string> = {
  done: "done",
  running: "running",
  error: "error",
  pending: "queued",
  stopped: "stopped",
};

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export default function CollabViewerPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? "");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/qcoreai/collab/${encodeURIComponent(token)}`), {
          cache: "no-store",
        });
        if (cancelled) return;
        // 404 здесь означает ровно одно и понятное: ссылки больше нет.
        // Отдельный экран, а не общая ошибка: человеку надо знать, что делать.
        if (res.status === 404) { setState({ kind: "gone" }); return; }
        if (!res.ok) {
          setState({ kind: "error", message: "We could not open this view right now. Please refresh the page." });
          return;
        }
        setState({ kind: "ok", data: (await res.json()) as Snapshot });
      } catch {
        if (!cancelled) {
          setState({ kind: "error", message: "No connection to the server. Check your internet and refresh." });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <ProductPageShell maxWidth={860}>
      <div style={{ padding: "32px 20px 64px" }}>
        <div style={{ marginBottom: 28 }}>
          <Link href="/qcoreai" style={{ color: "#0f766e", textDecoration: "none", fontSize: 14 }}>
            ← QCoreAI
          </Link>
        </div>

        <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: "0 0 8px", fontWeight: 700, color: "#0f172a" }}>
          {state.kind === "ok" && state.data.session?.title
            ? state.data.session.title
            : "Shared session"}
        </h1>
        <p style={{ margin: "0 0 32px", color: "#475569", fontSize: 15, lineHeight: 1.6 }}>
          You are viewing someone else’s session through a shared link. Read-only —
          nothing here can be changed, and no account is needed.
        </p>

        {state.kind === "loading" && (
          <p style={{ color: "#64748b", fontSize: 15 }}>Opening…</p>
        )}

        {state.kind === "gone" && (
          <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "24px 22px", background: "#fff" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 19, color: "#0f172a" }}>This link no longer works</h2>
            <p style={{ margin: "0 0 6px", color: "#475569", fontSize: 15, lineHeight: 1.65 }}>
              The owner revoked access, or the link expired — shared links last 24 hours.
            </p>
            <p style={{ margin: "0 0 18px", color: "#475569", fontSize: 15, lineHeight: 1.65 }}>
              Ask them for a new one: it takes a single click to create.
            </p>
            <Link
              href="/qcoreai"
              style={{
                display: "inline-block", padding: "10px 18px", borderRadius: 8,
                background: "#0f766e", color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 600,
              }}
            >
              Open QCoreAI
            </Link>
          </section>
        )}

        {state.kind === "error" && (
          <section style={{ border: "1px solid #fecaca", borderRadius: 12, padding: "20px 22px", background: "#fef2f2" }}>
            <p style={{ margin: 0, color: "#991b1b", fontSize: 15, lineHeight: 1.6 }}>{state.message}</p>
          </section>
        )}

        {state.kind === "ok" && (
          <>
            <div
              style={{
                display: "flex", flexWrap: "wrap", gap: 20, alignItems: "baseline",
                padding: "14px 0 20px", borderBottom: "1px solid #e2e8f0", marginBottom: 24,
              }}
            >
              {state.data.session?.createdAt && (
                <span style={{ color: "#64748b", fontSize: 14 }}>
                  Started {when(state.data.session.createdAt)}
                </span>
              )}
              <span style={{ color: "#64748b", fontSize: 14 }}>
                Views: <strong style={{ color: "#0f172a" }}>{state.data.viewers}</strong>
              </span>
            </div>

            {state.data.runs.length === 0 ? (
              // Пустота бывает законной: сессию открыли и ещё ничего не спросили.
              // Говорим об этом прямо, чтобы её не приняли за поломку.
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>
                This session has no requests yet. Check back later.
              </p>
            ) : (
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
                {state.data.runs.map((r) => (
                  <li
                    key={r.id}
                    style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", background: "#fff" }}
                  >
                    <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#64748b", fontSize: 13 }}>{when(r.createdAt)}</span>
                      <span style={{ color: "#0f766e", fontSize: 13, fontWeight: 600 }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0, color: "#0f172a", fontSize: 15, lineHeight: 1.65,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}
                    >
                      {r.userInput || "— request with no text —"}
                    </p>
                  </li>
                ))}
              </ol>
            )}

            <p style={{ marginTop: 28, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
              Показаны последние пять запросов сессии.
            </p>
          </>
        )}
      </div>
    </ProductPageShell>
  );
}
