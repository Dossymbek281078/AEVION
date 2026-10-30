"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { usePsyT, AFFIRMATIONS } from "../i18n";

export default function Affirmation() {
  const [list, setList] = useState<string[]>([]);
  const [idx, setIdx] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { t, lang } = usePsyT();

  const refresh = useCallback((items: string[]) => {
    if (items.length === 0) return;
    setIdx(Math.floor(Math.random() * items.length));
  }, []);

  useEffect(() => {
    // Сервер отдаёт аффирмации только на русском; для en/kk — свой список из словаря.
    const местные = AFFIRMATIONS[lang];
    if (местные) {
      setList(местные);
      setIdx(Math.floor(Math.random() * местные.length));
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/psyapp-deps/affirmations"), { cache: "no-store" });
        const d = await r.json();
        if (d.ok && Array.isArray(d.affirmations) && d.affirmations.length > 0) {
          setList(d.affirmations);
          setIdx(Math.floor(Math.random() * d.affirmations.length));
        }
      } catch {
        // ignore — UI shows fallback
      } finally {
        setLoading(false);
      }
    })();
  }, [lang]);

  const current = list[idx] ?? t("aff.fallback");

  return (
    <div style={styles.card}>
      <div style={styles.eyebrow}>{t("aff.eyebrow")}</div>
      <blockquote style={styles.quote}>
        <span style={styles.openQuote}>«</span>
        {current}
        <span style={styles.closeQuote}>»</span>
      </blockquote>
      <button
        type="button"
        onClick={() => refresh(list)}
        disabled={loading || list.length === 0}
        style={styles.refreshBtn}
      >
        {t("aff.another")}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "linear-gradient(135deg, #2a3a2e 0%, #1f2a20 100%)",
    border: "1px solid #3f6f4f",
    borderRadius: 16,
    padding: "24px 28px",
    textAlign: "center",
  },
  eyebrow: {
    color: "#9bd4a8",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  quote: {
    color: "#f5ebd7",
    fontSize: 18,
    lineHeight: 1.5,
    fontStyle: "italic",
    margin: "0 0 16px 0",
  },
  openQuote: { color: "#9bd4a8", fontSize: 28, verticalAlign: "-6px", marginRight: 4 },
  closeQuote: { color: "#9bd4a8", fontSize: 28, verticalAlign: "-6px", marginLeft: 4 },
  refreshBtn: {
    background: "transparent",
    color: "#9bd4a8",
    border: "1px solid #3f6f4f",
    borderRadius: 20,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
};
