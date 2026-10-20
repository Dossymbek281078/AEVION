"use client";

/**
 * «Скачать все мои записи» — архив всех записей аккаунта одним .zip.
 *
 * Повод (Продажи, 20.10.2026): бюро на пилоте спрашивает «а если уйдём?».
 * Ответ — GET /api/pipeline/certificates/export.zip: на каждую запись
 * <certId>/bundle.json (проверяется без AEVION) и index.json.
 *
 * Видна только вошедшему (isAuthenticated в useEffect — как на /pricing: на
 * сервере токена нет, поэтому первый кадр без кнопки, без расхождения гидратации).
 * Каждый исход показан словами: 404 no_records, 401, 413, сбой сети, иной ответ —
 * ни один отказ не проходит молча.
 *
 * Подписи приходят из page.tsx уже переведёнными через tq(lang, …): сторож
 * ruDictionaryIsWired требует, чтобы каждый ключ словаря был проведён в page.tsx.
 */
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { getAuthHeaders, isAuthenticated } from "@/lib/auth";

export type ExportAllLabels = {
  button: string;
  busy: string;
  hint: string;
  empty: string;
  signIn: string;
  tooMany: string;
  network: string;
  failed: string;
};

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; fileName: string }
  | { kind: "error"; text: string; signIn?: boolean };

/** Имя файла из Content-Disposition; нет заголовка — то же правило, что у сервера. */
export function exportFileName(disposition: string | null, now: Date = new Date()): string {
  const m = /filename="?([^";]+)"?/i.exec(disposition || "");
  return m ? m[1] : `aevion-records-${now.toISOString().slice(0, 10)}.zip`;
}

export function ExportAllButton({ labels, lang }: { labels: ExportAllLabels; lang?: string }) {
  const [вошёл, setВошёл] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  useEffect(() => {
    setВошёл(isAuthenticated());
  }, []);
  if (!вошёл) return null;

  const download = async () => {
    setState({ kind: "busy" });
    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/pipeline/certificates/export.zip?lang=${encodeURIComponent(lang === "ru" || lang === "kk" ? lang : "en")}`), { headers: getAuthHeaders() });
    } catch (e) {
      console.error("[qright] export.zip: network error", e);
      setState({ kind: "error", text: labels.network });
      return;
    }
    if (res.status === 200) {
      try {
        const blob = await res.blob();
        const fileName = exportFileName(res.headers.get("Content-Disposition"));
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setState({ kind: "done", fileName });
      } catch (e) {
        console.error("[qright] export.zip: could not save the archive", e);
        setState({ kind: "error", text: labels.network });
      }
      return;
    }
    if (res.status === 404) return setState({ kind: "error", text: labels.empty });
    if (res.status === 401) return setState({ kind: "error", text: labels.signIn, signIn: true });
    if (res.status === 413) return setState({ kind: "error", text: labels.tooMany });
    console.error("[qright] export.zip: unexpected status", res.status);
    setState({ kind: "error", text: `${labels.failed} (HTTP ${res.status})` });
  };

  return (
    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <button
        type="button"
        data-testid="qright-export-all"
        onClick={download}
        disabled={state.kind === "busy"}
        style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #0d9488", background: "#fff", fontWeight: 700, fontSize: 13, cursor: state.kind === "busy" ? "wait" : "pointer", color: "#0f766e" }}
      >
        ⬇ {state.kind === "busy" ? labels.busy : labels.button}
      </button>
      <span style={{ fontSize: 12, color: "#64748b" }}>{labels.hint}</span>
      {state.kind === "done" && (
        <span role="status" style={{ fontSize: 12, color: "#0f766e" }}>✓ {state.fileName}</span>
      )}
      {state.kind === "error" && (
        <span role="alert" style={{ fontSize: 12, color: "#b91c1c" }}>
          {state.text}
          {state.signIn && (
            <>
              {" "}
              <a href="/auth" style={{ color: "#4f46e5", fontWeight: 700 }}>→</a>
            </>
          )}
        </span>
      )}
    </div>
  );
}
