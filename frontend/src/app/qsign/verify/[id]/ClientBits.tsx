"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "@/lib/auth";
import { useI18nOptional } from "@/lib/i18n";
import { tVerify } from "./i18n";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const lang = useI18nOptional()?.lang ?? "en";
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const click = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("ok");
      setTimeout(() => setState("idle"), 1200);
    } catch {
      setState("err");
      setTimeout(() => setState("idle"), 1200);
    }
  };
  return (
    <button
      onClick={click}
      style={{
        padding: "5px 10px",
        borderRadius: 6,
        border: "1px solid rgba(15,23,42,0.15)",
        background: state === "ok" ? "#d1fae5" : state === "err" ? "#fee2e2" : "#fff",
        fontSize: 11,
        fontWeight: 700,
        color: state === "ok" ? "#047857" : state === "err" ? "#b91c1c" : "#0f172a",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {state === "ok" ? tVerify(lang, "copy.copied") : state === "err" ? tVerify(lang, "copy.err") : label || tVerify(lang, "copy.copy")}
    </button>
  );
}

export function ShareButton({ url }: { url: string }) {
  const lang = useI18nOptional()?.lang ?? "en";
  const [state, setState] = useState<"idle" | "ok">("idle");
  const click = async () => {
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    if (nav?.share) {
      try {
        await nav.share({ url, title: tVerify(lang, "share.title") });
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("ok");
      setTimeout(() => setState("idle"), 1500);
    } catch {}
  };
  return (
    <button
      onClick={click}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        border: "1px solid rgba(15,23,42,0.15)",
        background: state === "ok" ? "#d1fae5" : "#fff",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {state === "ok" ? tVerify(lang, "share.copied") : tVerify(lang, "share.share")}
    </button>
  );
}

/**
 * Кнопка отзыва для автора подписи. Публичная ручка id издателя не отдаёт,
 * поэтому авторство спрашиваем у /audit?signatureId= с токеном: пусто — не
 * автор (или не вошёл), и кнопки нет. Решает всё равно бэк: /revoke/:id
 * пускает только издателя или админа.
 */
export function RevokeButton({ id }: { id: string }) {
  const lang = useI18nOptional()?.lang ?? "en";
  const router = useRouter();
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    let alive = true;
    fetch(apiUrl(`/api/qsign/v2/audit?event=sign&limit=1&signatureId=${encodeURIComponent(id)}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`audit ${r.status}`))))
      .then((j) => {
        if (alive) setMine(Array.isArray(j?.items) && j.items.some((x: any) => x?.signatureId === id));
      })
      .catch((e) => console.warn("[qsign] revoke: не удалось проверить авторство", e));
    return () => {
      alive = false;
    };
  }, [id]);

  if (!mine) return null;

  const submit = async () => {
    const r = reason.trim();
    if (!r) {
      setMsg({ ok: false, text: tVerify(lang, "revoke.needReason") });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(apiUrl(`/api/qsign/v2/revoke/${encodeURIComponent(id)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken() ?? ""}` },
        body: JSON.stringify({ reason: r }),
      });
      // 409 — уже отозвана (вторая вкладка): страница всё равно должна это показать.
      if (res.ok || res.status === 409) {
        setMsg({ ok: true, text: tVerify(lang, "revoke.done") });
        router.refresh();
        return;
      }
      const j = await res.json().catch(() => null);
      setMsg({ ok: false, text: tVerify(lang, "revoke.failed", { status: res.status, msg: j?.error ?? "—" }) });
    } catch (e: any) {
      setMsg({ ok: false, text: tVerify(lang, "revoke.failed", { status: 0, msg: e?.message ?? "network" }) });
    } finally {
      setBusy(false);
    }
  };

  const btn = (bg: string, fg: string, border: string) => ({
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: bg,
    color: fg,
    fontSize: 13,
    fontWeight: 700,
    cursor: busy ? "default" : "pointer",
    fontFamily: "inherit",
  });

  return (
    <div
      data-testid="qsign-revoke"
      style={{
        border: "1px solid rgba(180,83,9,0.25)",
        background: "rgba(254,243,199,0.35)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 18,
      }}
    >
      <div style={{ fontSize: 13, color: "#78350f", marginBottom: open ? 10 : 12 }}>{tVerify(lang, "revoke.lead")}</div>
      {open ? (
        <>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#78350f", marginBottom: 10 }}>
            {tVerify(lang, "revoke.reasonLabel")}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={tVerify(lang, "revoke.reasonPlaceholder")}
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                marginTop: 6,
                padding: 10,
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.2)",
                fontSize: 14,
                fontFamily: "inherit",
                fontWeight: 400,
              }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={submit} disabled={busy} style={btn("#b45309", "#fff", "#b45309")}>
              {busy ? tVerify(lang, "revoke.busy") : tVerify(lang, "revoke.confirm")}
            </button>
            <button onClick={() => setOpen(false)} disabled={busy} style={btn("#fff", "#0f172a", "rgba(15,23,42,0.15)")}>
              {tVerify(lang, "revoke.cancel")}
            </button>
          </div>
        </>
      ) : (
        <button onClick={() => setOpen(true)} style={btn("#fff", "#b45309", "#b45309")}>
          {tVerify(lang, "revoke.button")}
        </button>
      )}
      {msg ? (
        <div role="status" style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: msg.ok ? "#047857" : "#b91c1c" }}>
          {msg.text}
        </div>
      ) : null}
    </div>
  );
}
